import { asc, count, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { bankAccounts, expenses } from '@/db/schema';
import { bankAccountInputSchema, idSchema } from '@/lib/domain/schemas';
import { ServiceError, translateDbError } from './errors';

export interface BankAccountWithUsage {
  id: string;
  name: string;
  institution: string | null;
  initialBalanceCents: number;
  archived: boolean;
  expenseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccountRepository {
  listWithUsage(): Promise<BankAccountWithUsage[]>;
  findById(id: string): Promise<{ id: string; name: string; archived: boolean } | null>;
  countLinkedExpenses(id: string): Promise<number>;
  insert(data: {
    name: string;
    institution: string | null;
    initialBalanceCents: number;
  }): Promise<BankAccountWithUsage>;
  update(
    id: string,
    data: { name: string; institution: string | null; initialBalanceCents: number }
  ): Promise<BankAccountWithUsage | null>;
  setArchived(id: string, archived: boolean): Promise<BankAccountWithUsage | null>;
}

const drizzleBankAccountRepo: BankAccountRepository = {
  async listWithUsage() {
    const db = getDb();
    const rows = await db
      .select({
        id: bankAccounts.id,
        name: bankAccounts.name,
        institution: bankAccounts.institution,
        initialBalanceCents: bankAccounts.initialBalanceCents,
        archived: bankAccounts.archived,
        createdAt: bankAccounts.createdAt,
        updatedAt: bankAccounts.updatedAt,
        expenseCount: count(expenses.id),
      })
      .from(bankAccounts)
      .leftJoin(expenses, eq(expenses.bankAccountId, bankAccounts.id))
      .groupBy(bankAccounts.id)
      .orderBy(asc(bankAccounts.archived), asc(bankAccounts.name));

    return rows.map((row) => ({
      ...row,
      expenseCount: Number(row.expenseCount ?? 0),
    }));
  },

  async findById(id) {
    const db = getDb();
    const [row] = await db
      .select({
        id: bankAccounts.id,
        name: bankAccounts.name,
        archived: bankAccounts.archived,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1);
    return row ?? null;
  },

  async countLinkedExpenses(id) {
    const db = getDb();
    const [row] = await db
      .select({ total: count(expenses.id) })
      .from(expenses)
      .where(eq(expenses.bankAccountId, id));
    return Number(row?.total ?? 0);
  },

  async insert(data) {
    const db = getDb();
    const [created] = await db
      .insert(bankAccounts)
      .values({
        name: data.name,
        institution: data.institution,
        initialBalanceCents: data.initialBalanceCents,
        archived: false,
      })
      .returning();

    return {
      ...created,
      expenseCount: 0,
    };
  },

  async update(id, data) {
    const db = getDb();
    const [updated] = await db
      .update(bankAccounts)
      .set({
        name: data.name,
        institution: data.institution,
        initialBalanceCents: data.initialBalanceCents,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id))
      .returning();

    if (!updated) return null;
    const expenseCount = await this.countLinkedExpenses(id);
    return { ...updated, expenseCount };
  },

  async setArchived(id, archived) {
    const db = getDb();
    const [updated] = await db
      .update(bankAccounts)
      .set({
        archived,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id))
      .returning();

    if (!updated) return null;
    const expenseCount = await this.countLinkedExpenses(id);
    return { ...updated, expenseCount };
  },
};

export function createBankAccountService(repo: BankAccountRepository = drizzleBankAccountRepo) {
  return {
    async list(): Promise<BankAccountWithUsage[]> {
      try {
        return await repo.listWithUsage();
      } catch (error) {
        console.error('Erro ao listar contas bancárias:', error);
        throw translateDbError(error, 'Não foi possível carregar as contas bancárias.');
      }
    },

    async create(input: unknown): Promise<BankAccountWithUsage> {
      const parsed = bankAccountInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para conta bancária.',
          400
        );
      }

      try {
        return await repo.insert(parsed.data);
      } catch (error) {
        console.error('Erro ao criar conta bancária:', error);
        throw translateDbError(error, 'Não foi possível cadastrar a conta bancária.');
      }
    },

    async update(idRaw: string, input: unknown): Promise<BankAccountWithUsage> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de conta inválido.', 400);
      }

      const parsed = bankAccountInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para conta bancária.',
          400
        );
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Conta bancária não encontrada.', 404);
        }

        const updated = await repo.update(idParsed.data, parsed.data);
        if (!updated) {
          throw new ServiceError('NOT_FOUND', 'Conta bancária não encontrada.', 404);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao atualizar conta bancária:', error);
        throw translateDbError(error, 'Não foi possível atualizar a conta bancária.');
      }
    },

    async setArchived(idRaw: string, archived: boolean): Promise<BankAccountWithUsage> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de conta inválido.', 400);
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Conta bancária não encontrada.', 404);
        }

        const updated = await repo.setArchived(idParsed.data, archived);
        if (!updated) {
          throw new ServiceError('NOT_FOUND', 'Conta bancária não encontrada.', 404);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao arquivar/reativar conta bancária:', error);
        throw translateDbError(error, 'Não foi possível atualizar o estado da conta.');
      }
    },
  };
}

export const bankAccountService = createBankAccountService();
