import { and, asc, count, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { bankAccounts, categories, expenses, people } from '@/db/schema';
import {
  formatCycleRangeLabel,
  formatYearMonthLabelPTBR,
  getFinancialCycleRange,
} from '@/lib/domain/dates';
import {
  expenseFilterSchema,
  expenseInputSchema,
  financialSettingsSchema,
  idSchema,
  yearMonthSchema,
  type ExpenseInput,
  type ExpenseSortOption,
} from '@/lib/domain/schemas';
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

export interface ExpenseFilteredResult {
  items: ExpenseListItem[];
  filteredTotalCents: number;
  filteredCount: number;
}

export interface MonthlyCategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  totalCents: number;
  expenseCount: number;
  percentage: number;
}

export interface MonthlyLargestExpense {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  categoryName: string;
  personName: string;
}

export interface MonthlySummaryRawData {
  totalCents: number;
  expenseCount: number;
  largestExpense: MonthlyLargestExpense | null;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    totalCents: number;
    expenseCount: number;
  }>;
  recentExpenses: ExpenseListItem[];
}

export interface MonthlySummaryResult {
  yearMonth: string;
  startDate: string;
  endDate: string;
  cycleStartDay: number;
  periodLabel: string;
  rangeLabel: string;
  totalCents: number;
  expenseCount: number;
  averageCents: number;
  largestExpense: MonthlyLargestExpense | null;
  byCategory: MonthlyCategoryBreakdownItem[];
  recentExpenses: ExpenseListItem[];
}

export function buildMonthlySummary(
  yearMonth: string,
  startDate: string,
  endDate: string,
  raw: MonthlySummaryRawData,
  cycleStartDay = 1
): MonthlySummaryResult {
  const totalCents = Math.max(0, Math.trunc(raw.totalCents));
  const expenseCount = Math.max(0, Math.trunc(raw.expenseCount));
  const averageCents = expenseCount > 0 ? Math.round(totalCents / expenseCount) : 0;

  const byCategory = raw.byCategory
    .filter((item) => item.expenseCount > 0 && item.totalCents > 0)
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents ||
        a.categoryName.localeCompare(b.categoryName, 'pt-BR')
    )
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      totalCents: Math.trunc(item.totalCents),
      expenseCount: Math.trunc(item.expenseCount),
      percentage:
        totalCents > 0
          ? Math.round((item.totalCents / totalCents) * 1000) / 10
          : 0,
    }));

  const rangeLabel = formatCycleRangeLabel(startDate, endDate);
  const periodLabel =
    cycleStartDay === 1 ? formatYearMonthLabelPTBR(yearMonth) : rangeLabel;

  return {
    yearMonth,
    startDate,
    endDate,
    cycleStartDay,
    periodLabel,
    rangeLabel,
    totalCents,
    expenseCount,
    averageCents,
    largestExpense: raw.largestExpense,
    byCategory,
    recentExpenses: raw.recentExpenses,
  };
}

export interface NormalizedExpenseFilters {
  q?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  personId?: string;
  bankAccountId?: string;
  sort: ExpenseSortOption;
}

export interface ExpenseRepository {
  listAll(): Promise<ExpenseListItem[]>;
  listFiltered(filters: NormalizedExpenseFilters): Promise<ExpenseListItem[]>;
  getMonthlySummaryRaw(
    startDate: string,
    endDate: string,
    recentLimit: number
  ): Promise<MonthlySummaryRawData>;
  findById(id: string): Promise<{ id: string; bankAccountId: string | null } | null>;
  categoryExists(id: string): Promise<boolean>;
  personExists(id: string): Promise<boolean>;
  findBankAccount(id: string): Promise<{ id: string; archived: boolean } | null>;
  insert(data: ExpenseInput): Promise<string>;
  update(id: string, data: ExpenseInput): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function getOrderByColumns(sort: ExpenseSortOption) {
  switch (sort) {
    case 'date_asc':
      return [asc(expenses.date), asc(expenses.createdAt)];
    case 'amount_desc':
      return [desc(expenses.amountCents), desc(expenses.date), desc(expenses.createdAt)];
    case 'amount_asc':
      return [asc(expenses.amountCents), desc(expenses.date), desc(expenses.createdAt)];
    case 'date_desc':
    default:
      return [desc(expenses.date), desc(expenses.createdAt)];
  }
}

const drizzleExpenseRepo: ExpenseRepository = {
  async listAll() {
    return this.listFiltered({ sort: 'date_desc' });
  },

  async listFiltered(filters) {
    const db = getDb();
    const conditions: SQL[] = [];

    if (filters.q) {
      conditions.push(ilike(expenses.description, `%${escapeIlikePattern(filters.q)}%`));
    }
    if (filters.startDate) {
      conditions.push(gte(expenses.date, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(expenses.date, filters.endDate));
    }
    if (filters.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }
    if (filters.personId) {
      conditions.push(eq(expenses.personId, filters.personId));
    }
    if (filters.bankAccountId) {
      conditions.push(eq(expenses.bankAccountId, filters.bankAccountId));
    }

    const baseQuery = db
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
      .leftJoin(bankAccounts, eq(expenses.bankAccountId, bankAccounts.id));

    const rows = await (
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery
    ).orderBy(...getOrderByColumns(filters.sort));

    return rows.map((row) => ({
      ...row,
      bankAccountName: row.bankAccountName ?? null,
      bankAccountArchived: Boolean(row.bankAccountArchived),
    }));
  },

  async getMonthlySummaryRaw(startDate, endDate, recentLimit) {
    const db = getDb();
    const periodCondition = and(
      gte(expenses.date, startDate),
      lte(expenses.date, endDate)
    );

    const [totalsRows, largestRows, categoryRows, recentRows] = await Promise.all([
      db
        .select({
          totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::bigint`,
          expenseCount: count(expenses.id),
        })
        .from(expenses)
        .where(periodCondition),

      db
        .select({
          id: expenses.id,
          description: expenses.description,
          amountCents: expenses.amountCents,
          date: expenses.date,
          categoryName: categories.name,
          personName: people.name,
        })
        .from(expenses)
        .innerJoin(categories, eq(expenses.categoryId, categories.id))
        .innerJoin(people, eq(expenses.personId, people.id))
        .where(periodCondition)
        .orderBy(desc(expenses.amountCents), desc(expenses.date), desc(expenses.createdAt))
        .limit(1),

      db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::bigint`,
          expenseCount: count(expenses.id),
        })
        .from(expenses)
        .innerJoin(categories, eq(expenses.categoryId, categories.id))
        .where(periodCondition)
        .groupBy(categories.id, categories.name)
        .orderBy(
          desc(sql`coalesce(sum(${expenses.amountCents}), 0)`),
          asc(categories.name)
        ),

      db
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
        .where(periodCondition)
        .orderBy(desc(expenses.date), desc(expenses.createdAt))
        .limit(recentLimit),
    ]);

    const totals = totalsRows[0];
    return {
      totalCents: Number(totals?.totalCents ?? 0),
      expenseCount: Number(totals?.expenseCount ?? 0),
      largestExpense: largestRows[0] ?? null,
      byCategory: categoryRows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totalCents: Number(row.totalCents ?? 0),
        expenseCount: Number(row.expenseCount ?? 0),
      })),
      recentExpenses: recentRows.map((row) => ({
        ...row,
        bankAccountName: row.bankAccountName ?? null,
        bankAccountArchived: Boolean(row.bankAccountArchived),
      })),
    };
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

    async listFiltered(rawFilters: unknown): Promise<ExpenseFilteredResult> {
      const parsed = expenseFilterSchema.safeParse(rawFilters ?? {});
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Parâmetros de filtro inválidos.',
          400
        );
      }

      try {
        const items = await repo.listFiltered(parsed.data);
        const filteredTotalCents = items.reduce(
          (acc, item) => acc + Math.trunc(item.amountCents),
          0
        );
        return {
          items,
          filteredTotalCents,
          filteredCount: items.length,
        };
      } catch (error) {
        console.error('Erro ao filtrar despesas:', error);
        throw translateDbError(error, 'Não foi possível consultar as despesas.');
      }
    },

    async getCycleSummary(
      anchorYearMonthRaw: string,
      cycleStartDay = 1,
      recentLimit = 6
    ): Promise<MonthlySummaryResult> {
      const parsed = yearMonthSchema.safeParse(anchorYearMonthRaw);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ?? 'Competência mensal inválida.',
          400
        );
      }

      const dayParsed = financialSettingsSchema.safeParse({ cycleStartDay });
      if (!dayParsed.success) {
        throw new ServiceError(
          'VALIDATION',
          dayParsed.error.issues[0]?.message ?? 'Dia de início do ciclo inválido.',
          400
        );
      }

      const safeLimit = Math.max(1, Math.min(20, Math.trunc(recentLimit)));
      const { startDate, endDate } = getFinancialCycleRange(
        parsed.data,
        dayParsed.data.cycleStartDay
      );

      try {
        const raw = await repo.getMonthlySummaryRaw(startDate, endDate, safeLimit);
        return buildMonthlySummary(
          parsed.data,
          startDate,
          endDate,
          raw,
          dayParsed.data.cycleStartDay
        );
      } catch (error) {
        console.error('Erro ao calcular resumo do ciclo financeiro:', error);
        throw translateDbError(error, 'Não foi possível carregar o resumo financeiro.');
      }
    },

    async getMonthlySummary(
      yearMonthRaw: string,
      recentLimit = 6
    ): Promise<MonthlySummaryResult> {
      return this.getCycleSummary(yearMonthRaw, 1, recentLimit);
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
