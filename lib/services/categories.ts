import { asc, count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { categories, expenses } from '@/db/schema';
import { categorySchema, idSchema } from '@/lib/domain/schemas';
import { ServiceError, translateDbError } from './errors';

export interface CategoryWithUsage {
  id: string;
  name: string;
  expenseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRepository {
  listWithUsage(): Promise<CategoryWithUsage[]>;
  findById(id: string): Promise<{ id: string; name: string } | null>;
  findByNameCaseInsensitive(name: string): Promise<{ id: string; name: string } | null>;
  countLinkedExpenses(id: string): Promise<number>;
  insert(name: string): Promise<CategoryWithUsage>;
  updateName(id: string, name: string): Promise<CategoryWithUsage | null>;
  deleteById(id: string): Promise<boolean>;
}

const drizzleCategoryRepo: CategoryRepository = {
  async listWithUsage() {
    const db = getDb();
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        expenseCount: count(expenses.id),
      })
      .from(categories)
      .leftJoin(expenses, eq(expenses.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));

    return rows.map((row) => ({
      ...row,
      expenseCount: Number(row.expenseCount ?? 0),
    }));
  },

  async findById(id) {
    const db = getDb();
    const [row] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return row ?? null;
  },

  async findByNameCaseInsensitive(name) {
    const db = getDb();
    const [row] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(sql`lower(${categories.name}) = lower(${name})`)
      .limit(1);
    return row ?? null;
  },

  async countLinkedExpenses(id) {
    const db = getDb();
    const [row] = await db
      .select({ total: count(expenses.id) })
      .from(expenses)
      .where(eq(expenses.categoryId, id));
    return Number(row?.total ?? 0);
  },

  async insert(name) {
    const db = getDb();
    const [created] = await db.insert(categories).values({ name }).returning();
    return {
      ...created,
      expenseCount: 0,
    };
  },

  async updateName(id, name) {
    const db = getDb();
    const [updated] = await db
      .update(categories)
      .set({ name, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) return null;
    const expenseCount = await this.countLinkedExpenses(id);
    return { ...updated, expenseCount };
  },

  async deleteById(id) {
    const db = getDb();
    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return deleted.length > 0;
  },
};

export function createCategoryService(repo: CategoryRepository = drizzleCategoryRepo) {
  return {
    async list(): Promise<CategoryWithUsage[]> {
      try {
        return await repo.listWithUsage();
      } catch (error) {
        console.error('Erro ao listar categorias:', error);
        throw translateDbError(error, 'Não foi possível carregar as categorias.');
      }
    },

    async create(input: unknown): Promise<CategoryWithUsage> {
      const parsed = categorySchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para categoria.',
          400
        );
      }

      try {
        const duplicate = await repo.findByNameCaseInsensitive(parsed.data.name);
        if (duplicate) {
          throw new ServiceError('CONFLICT', 'Já existe uma categoria com esse nome.', 409);
        }
        return await repo.insert(parsed.data.name);
      } catch (error) {
        console.error('Erro ao criar categoria:', error);
        throw translateDbError(error, 'Não foi possível criar a categoria.');
      }
    },

    async update(idRaw: string, input: unknown): Promise<CategoryWithUsage> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de categoria inválido.', 400);
      }

      const parsed = categorySchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Dados inválidos para categoria.',
          400
        );
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Categoria não encontrada.', 404);
        }

        const duplicate = await repo.findByNameCaseInsensitive(parsed.data.name);
        if (duplicate && duplicate.id !== idParsed.data) {
          throw new ServiceError('CONFLICT', 'Já existe outra categoria com esse nome.', 409);
        }

        const updated = await repo.updateName(idParsed.data, parsed.data.name);
        if (!updated) {
          throw new ServiceError('NOT_FOUND', 'Categoria não encontrada.', 404);
        }
        return updated;
      } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        throw translateDbError(error, 'Não foi possível atualizar a categoria.');
      }
    },

    async remove(idRaw: string): Promise<void> {
      const idParsed = idSchema.safeParse(idRaw);
      if (!idParsed.success) {
        throw new ServiceError('VALIDATION', 'Identificador de categoria inválido.', 400);
      }

      try {
        const existing = await repo.findById(idParsed.data);
        if (!existing) {
          throw new ServiceError('NOT_FOUND', 'Categoria não encontrada.', 404);
        }

        const linkedCount = await repo.countLinkedExpenses(idParsed.data);
        if (linkedCount > 0) {
          throw new ServiceError(
            'FORBIDDEN_DELETE',
            `Não é possível excluir "${existing.name}" porque existem ${linkedCount} ${
              linkedCount === 1 ? 'despesa vinculada' : 'despesas vinculadas'
            } a ela.`,
            409
          );
        }

        const deleted = await repo.deleteById(idParsed.data);
        if (!deleted) {
          throw new ServiceError('NOT_FOUND', 'Categoria não encontrada.', 404);
        }
      } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        throw translateDbError(error, 'Não foi possível excluir a categoria.');
      }
    },
  };
}

export const categoryService = createCategoryService();
