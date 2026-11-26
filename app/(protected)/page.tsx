import { DbErrorBanner } from '@/components/db-error-banner';
import { ExpensesClient, type ExpenseRowItem, type SelectOptionItem } from '@/components/expenses-client';
import { requirePageAuth } from '@/lib/auth/guard';
import { bankAccountService } from '@/lib/services/bank-accounts';
import { categoryService } from '@/lib/services/categories';
import { expenseService } from '@/lib/services/expenses';
import { personService } from '@/lib/services/people';

export const dynamic = 'force-dynamic';

export default async function DespesasPage() {
  await requirePageAuth();

  let data: {
    expenses: ExpenseRowItem[];
    categories: SelectOptionItem[];
    people: SelectOptionItem[];
    bankAccounts: SelectOptionItem[];
  } | null = null;
  let errorMessage: string | null = null;

  try {
    const [expenses, categories, people, bankAccounts] = await Promise.all([
      expenseService.list(),
      categoryService.list(),
      personService.list(),
      bankAccountService.list(),
    ]);

    data = {
      expenses: expenses.map((item) => ({
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
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      people: people.map((p) => ({ id: p.id, name: p.name })),
      bankAccounts: bankAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        archived: a.archived,
      })),
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
      categories={data.categories}
      people={data.people}
      bankAccounts={data.bankAccounts}
    />
  );
}
