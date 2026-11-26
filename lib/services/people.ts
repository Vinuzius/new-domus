import { asc, count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { expenses, people } from '@/db/schema';
import { idSchema, personDefaultSchema, personSchema } from '@/lib/domain/schemas';
import { ServiceError, translateDbError } from './errors';

export interface PersonWithUsage {
  id: string;
  name: string;
  isDefault: boolean;
  expenseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonRepository {
  listWithUsage(): Promise<PersonWithUsage[]>;
  findById(id: string): Promise<{ id: string; name: string; isDefault: boolean } | null>;
  findByNameCaseInsensitive(name: string): Promise<{ id: string; name: string } | null>;
  countLinkedExpenses(id: string): Promise<number>;
  insert(name: string): Promise<PersonWithUsage>;
  updateName(id: string, name: string): Promise<PersonWithUsage | null>;
  setDefault(id: string, isDefault: boolean): Promise<PersonWithUsage | null>;
  deleteById(id: string): Promise<boolean>;
}

const drizzlePersonRepo: PersonRepository = {
  async listWithUsage() {
    const db = getDb();
    const rows = await db
      .select({
        id: people.id,
        name: people.name,
        isDefault: people.isDefault,
        createdAt: people.createdAt,
        updatedAt: people.updatedAt,
        expenseCount: count(expenses.id),
      })
      .from(people)
      .leftJoin(expenses, eq(expenses.personId, people.id))
      .groupBy(people.id)
      .orderBy(asc(people.name));

    return rows.map((row) => ({
      ...row,
      expenseCount: Number(row.expenseCount ?? 0),
    }));
  },

  async findById(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: people.id, name: people.name, isDefault: people.isDefault })
      .from(people)
      .where(eq(people.id, id))
      .limit(1);
    return row ?? null;
  },

  async findByNameCaseInsensitive(name) {
    const db = getDb();
    const [row] = await db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(sql`lower(${people.name}) = lower(${name})`)
      .limit(1);
    return row ?? null;
  },

  async countLinkedExpenses(id) {
    const db = getDb();
    const [row] = await db
      .select({ total: count(expenses.id) })
      .from(expenses)
      .where(eq(expenses.personId, id));
    return Number(row?.total ?? 0);
  },

  async insert(name) {
    const db = getDb();
    const [created] = await db.insert(people).values({ name }).returning();
    return {
      ...created,
      expenseCount: 0,
    };
  },

  async updateName(id, name) {
    const db = getDb();
    const [updated] = await db
      .update(people)
      .set({ name, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();

    if (!updated) return null;
    const expenseCount = await this.countLinkedExpenses(id);
    return { ...updated, expenseCount };
  },

  async setDefault(id, isDefault) {
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: people.id })
        .from(people)
        .where(eq(people.id, id))
        .limit(1);

      if (!target) {
        return null;
      }

      const now = new Date();
      if (isDefault) {
        await tx
          .update(people)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(people.isDefault, true));
      }

      const [updated] = await tx
        .update(people)
        .set({ isDefault, updatedAt: now })
        .where(eq(people.id, id))
        .returning();

      if (!updated) {
        return null;
      }

      const [usage] = await tx
        .select({ total: count(expenses.id) })
        .from(expenses)
        .where(eq(expenses.personId, id));

      return {
        ...updated,
        expenseCount: Number(usage?.total ?? 0),
      };
    });
  },

  async deleteById(id) {
    const db = getDb();
    const deleted = await db
      .delete(people)
      .where(eq(people.id, id))
      .returning({ id: people.id });
    return deleted.length > 0;
  },
};

export function createPersonService(repo: PersonRepository = drizzlePersonRepo) {
  return {
    async list(): Promise<PersonWithUsage[]> {
      try {
        return await repo.listWithUsage();
      } catch (error) {
        console.error('Erro ao listar responsáveis:', error);
        throw translateDbError(error, 'Não foi possível carregar os responsáveis.');
      }
    },

    async create(input: unknown): Promise<PersonWithUsage> {
      const parsed = personSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para responsável.',
          400
        );
      }

      try {
        const duplicate = await repo.findByNameCaseInsensitive(parsed.data.name);
        if (duplicate) {
          throw new ServiceError('CONFLICT', 'Já existe um responsável com esse nome.', 409);
        }
        return await repo.insert(parsed.data.name);
      } catch (error) {
        console.error('Erro ao criar responsável:', error);
        throw translateDbError(error, 'Não foi possível cadastrar o responsável.');
      }
    },

    async update(idRaw: string, input: unknown): Promise<PersonWithUsage> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de responsável inválido.', 400);
      }

      const parsed = personSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para responsável.',
          400
        );
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Responsável não encontrado.', 404);
        }

        const duplicate = await repo.findByNameCaseInsensitive(parsed.data.name);
        if (duplicate && duplicate.id !== idParsed.data) {
          throw new ServiceError('CONFLICT', 'Já existe outro responsável com esse nome.', 409);
        }

        const updated = await repo.updateName(idParsed.data, parsed.data.name);
        if (!updated) {
          throw new ServiceError('NOT_FOUND', 'Responsável não encontrado.', 404);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao atualizar responsável:', error);
        throw translateDbError(error, 'Não foi possível atualizar o responsável.');
      }
    },

    async setDefault(idRaw: string, input: unknown): Promise<PersonWithUsage> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de responsável inválido.', 400);
      }

      const parsed = personDefaultSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para responsável padrão.',
          400
        );
      }

      try {
        const updated = await repo.setDefault(idParsed.data, parsed.data.isDefault);
        if (!updated) {
          throw new ServiceError('NOT_FOUND', 'Responsável não encontrado.', 404);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao definir responsável padrão:', error);
        throw translateDbError(
          error,
          'Não foi possível atualizar o responsável padrão.'
        );
      }
    },

    async remove(idRaw: string): Promise<void> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de responsável inválido.', 400);
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Responsável não encontrado.', 404);
        }

        const linkedCount = await repo.countLinkedExpenses(idParsed.data);
        if (linkedCount > 0) {
          throw new ServiceError(
            'FORBIDDEN_DELETE',
            `Não é possível excluir "${existing.name}" porque existem ${linkedCount} ${
              linkedCount === 1 ? 'despesa vinculada' : 'despesas vinculadas'
            } a essa pessoa.`,
            409
          );
        }

        const deleted = await repo.deleteById(idParsed.data);
        if (!deleted) {
          throw new ServiceError('NOT_FOUND', 'Responsável não encontrado.', 404);
        }
      } catch (error) {
        console.error('Erro ao excluir responsável:', error);
        throw translateDbError(error, 'Não foi possível excluir o responsável.');
      }
    },
  };
}

export const personService = createPersonService();
