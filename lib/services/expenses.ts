import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { bankAccounts, categories, expenses, people } from '@/db/schema';
import { expenseInputSchema, idSchema, type ExpenseInput } from '@/lib/domain/schemas';
import { ServiceError, translateDbError } from './errors';

export interface ExpenseListItem {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  categoryId: string;
  categoryName: string;
  personId: string;
  personName: string;
  bankAccountId: string | null;
  bankAccountName: string | null;
  bankAccountArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseRepository {
  listAll(): Promise<ExpenseListItem[]>;
  findById(id: string): Promise<{ id: string; bankAccountId: string | null } | null>;
  categoryExists(id: string): Promise<boolean>;
  personExists(id: string): Promise<boolean>;
  findBankAccount(id: string): Promise<{ id: string; archived: boolean } | null>;
  insert(data: ExpenseInput): Promise<string>;
  update(id: string, data: ExpenseInput): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
}

const drizzleExpenseRepo: ExpenseRepository = {
  async listAll() {
    const db = getDb();
    const rows = await db
      .select({
        id: expenses.id,
        description: expenses.description,
        amountCents: expenses.amountCents,
        date: expenses.date,
        categoryId: expenses.categoryId,
        categoryName: categories.name,
        personId: expenses.personId,
        personName: people.name,
        bankAccountId: expenses.bankAccountId,
        bankAccountName: bankAccounts.name,
        bankAccountArchived: bankAccounts.archived,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .innerJoin(people, eq(expenses.personId, people.id))
      .leftJoin(bankAccounts, eq(expenses.bankAccountId, bankAccounts.id))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));

    return rows.map((row) => ({
      ...row,
      bankAccountName: row.bankAccountName ?? null,
      bankAccountArchived: Boolean(row.bankAccountArchived),
    }));
  },

  async findById(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: expenses.id, bankAccountId: expenses.bankAccountId })
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);
    return row ?? null;
  },

  async categoryExists(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return Boolean(row);
  },

  async personExists(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, id))
      .limit(1);
    return Boolean(row);
  },

  async findBankAccount(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: bankAccounts.id, archived: bankAccounts.archived })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1);
    return row ?? null;
  },

  async insert(data) {
    const db = getDb();
    const [created] = await db
      .insert(expenses)
      .values({
        description: data.description,
        amountCents: data.amountCents,
        date: data.date,
        categoryId: data.categoryId,
        personId: data.personId,
        bankAccountId: data.bankAccountId ?? null,
      })
      .returning({ id: expenses.id });
    return created.id;
  },

  async update(id, data) {
    const db = getDb();
    const updated = await db
      .update(expenses)
      .set({
        description: data.description,
        amountCents: data.amountCents,
        date: data.date,
        categoryId: data.categoryId,
        personId: data.personId,
        bankAccountId: data.bankAccountId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning({ id: expenses.id });
    return updated.length > 0;
  },

  async deleteById(id) {
    const db = getDb();
    const deleted = await db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning({ id: expenses.id });
    return deleted.length > 0;
  },
};

export function createExpenseService(repo: ExpenseRepository = drizzleExpenseRepo) {
  async function validateRelationships(
    data: ExpenseInput,
    currentBankAccountId?: string | null
  ) {
    const [catOk, personOk] = await Promise.all([
      repo.categoryExists(data.categoryId),
      repo.personExists(data.personId),
    ]);

    if (!catOk) {
      throw new ServiceError(
        'VALIDATION',
        'A categoria selecionada não existe mais. Escolha outra categoria.',
        400
      );
    }

    if (!personOk) {
      throw new ServiceError(
        'VALIDATION',
        'O responsável selecionado não existe mais. Escolha outro responsável.',
        400
      );
    }

    if (data.bankAccountId) {
      const account = await repo.findBankAccount(data.bankAccountId);
      if (!account) {
        throw new ServiceError(
          'VALIDATION',
          'A conta bancária selecionada não foi encontrada.',
          400
        );
      }

      const isKeepingExistingArchivedAccount =
        currentBankAccountId !== undefined && currentBankAccountId === data.bankAccountId;

      if (account.archived && !isKeepingExistingArchivedAccount) {
        throw new ServiceError(
          'VALIDATION',
          'Não é possível vincular uma nova despesa a uma conta bancária arquivada.',
          400
        );
      }
    }
  }

  return {
    async list(): Promise<ExpenseListItem[]> {
      try {
        return await repo.listAll();
      } catch (error) {
        console.error('Erro ao listar despesas:', error);
        throw translateDbError(error, 'Não foi possível carregar as despesas.');
      }
    },

    async create(input: unknown): Promise<{ id: string }> {
      const parsed = expenseInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.',
          400
        );
      }

      try {
        await validateRelationships(parsed.data);
        const id = await repo.insert(parsed.data);
        return { id };
      } catch (error) {
        console.error('Erro ao registrar despesa:', error);
        throw translateDbError(error, 'Não foi possível registrar a despesa.');
      }
    },

    async update(idRaw: string, input: unknown): Promise<{ id: string }> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de despesa inválido.', 400);
      }

      const parsed = expenseInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.',
          400
        );
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Despesa não encontrada.', 404);
        }

        await validateRelationships(parsed.data, existing.bankAccountId);

        const ok = await repo.update(idParsed.data, parsed.data);
        if (!ok) {
          throw new ServiceError('NOT_FOUND', 'Despesa não encontrada.', 404);
        }

        return { id: idParsed.data };
      } catch (error) {
        console.error('Erro ao atualizar despesa:', error);
        throw translateDbError(error, 'Não foi possível atualizar a despesa.');
      }
    },

    async remove(idRaw: string): Promise<void> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de despesa inválido.', 400);
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Despesa não encontrada.', 404);
        }

        const ok = await repo.deleteById(idParsed.data);
        if (!ok) {
          throw new ServiceError('NOT_FOUND', 'Despesa não encontrada.', 404);
        }
      } catch (error) {
        console.error('Erro ao excluir despesa:', error);
        throw translateDbError(error, 'Não foi possível excluir a despesa.');
      }
    },
  };
}

export const expenseService = createExpenseService();
