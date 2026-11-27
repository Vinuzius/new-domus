import { DbErrorBanner } from '@/components/db-error-banner';
import {
  ExpensesClient,
  type ExpenseFilterState,
  type ExpenseRowItem,
  type SelectOptionItem,
} from '@/components/expenses-client';
import { requirePageAuth } from '@/lib/auth/guard';
import {
  getCurrentFinancialCycle,
  isValidCivilDate,
  type FinancialCyclePeriod,
} from '@/lib/domain/dates';
import {
  EXPENSE_SORT_VALUES,
  idSchema,
  type ExpenseSortOption,
} from '@/lib/domain/schemas';
import { bankAccountService } from '@/lib/services/bank-accounts';
import { categoryService } from '@/lib/services/categories';
import { expenseService } from '@/lib/services/expenses';
import { personService } from '@/lib/services/people';
import { settingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

interface DespesasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickSingleParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInitialFilters(
  params: Record<string, string | string[] | undefined>
): ExpenseFilterState {
  const q = pickSingleParam(params.q).slice(0, 100);
  const rawStart = pickSingleParam(params.inicio);
  const rawEnd = pickSingleParam(params.fim);
  const rawCategory = pickSingleParam(params.categoria);
  const rawPerson = pickSingleParam(params.pessoa);
  const rawAccount = pickSingleParam(params.conta);
  const rawSort = pickSingleParam(params.ordenar);

  let startDate = isValidCivilDate(rawStart) ? rawStart : '';
  let endDate = isValidCivilDate(rawEnd) ? rawEnd : '';
  if (startDate && endDate && startDate > endDate) {
    startDate = '';
    endDate = '';
  }

  const categoryId = idSchema.safeParse(rawCategory).success ? rawCategory : '';
  const personId = idSchema.safeParse(rawPerson).success ? rawPerson : '';
  const bankAccountId = idSchema.safeParse(rawAccount).success ? rawAccount : '';
  const sort: ExpenseSortOption = (EXPENSE_SORT_VALUES as readonly string[]).includes(
    rawSort
  )
    ? (rawSort as ExpenseSortOption)
    : 'date_desc';

  return {
    q,
    startDate,
    endDate,
    categoryId,
    personId,
    bankAccountId,
    sort,
  };
}

export default async function DespesasPage({ searchParams }: DespesasPageProps) {
  await requirePageAuth();

  const resolvedParams = await searchParams;
  const initialFilters = parseInitialFilters(resolvedParams);

  let data: {
    expenses: ExpenseRowItem[];
    filteredTotalCents: number;
    categories: SelectOptionItem[];
    people: SelectOptionItem[];
    bankAccounts: SelectOptionItem[];
    currentCycle: FinancialCyclePeriod;
  } | null = null;
  let errorMessage: string | null = null;

  try {
    const [filteredResult, categories, people, bankAccounts, settings] =
      await Promise.all([
        expenseService.listFiltered({
          q: initialFilters.q || undefined,
          startDate: initialFilters.startDate || undefined,
          endDate: initialFilters.endDate || undefined,
          categoryId: initialFilters.categoryId || undefined,
          personId: initialFilters.personId || undefined,
          bankAccountId: initialFilters.bankAccountId || undefined,
          sort: initialFilters.sort,
        }),
        categoryService.list(),
        personService.list(),
        bankAccountService.list(),
        settingsService.getFinancialSettings(),
      ]);

    const currentCycle = getCurrentFinancialCycle(settings.cycleStartDay);

    data = {
      expenses: filteredResult.items.map((item) => ({
        id: item.id,
        description: item.description,
        amountCents: item.amountCents,
        date: item.date,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        personId: item.personId,
        personName: item.personName,
        bankAccountId: item.bankAccountId,
        bankAccountName: item.bankAccountName,
        bankAccountArchived: item.bankAccountArchived,
      })),
      filteredTotalCents: filteredResult.filteredTotalCents,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      people: people.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
      })),
      bankAccounts: bankAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        archived: a.archived,
      })),
      currentCycle,
    };
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar despesas.';
  }

  if (!data) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return (
    <ExpensesClient
      initialExpenses={data.expenses}
      initialFilteredTotalCents={data.filteredTotalCents}
      initialFilters={initialFilters}
      currentCycle={data.currentCycle}
      categories={data.categories}
      people={data.people}
      bankAccounts={data.bankAccounts}
    />
  );
}
