import { BankAccountsClient, type BankAccountItem } from '@/components/bank-accounts-client';
import { DbErrorBanner } from '@/components/db-error-banner';
import { requirePageAuth } from '@/lib/auth/guard';
import { bankAccountService } from '@/lib/services/bank-accounts';

export const dynamic = 'force-dynamic';

export default async function ContasPage() {
  await requirePageAuth();

  let items: BankAccountItem[] | null = null;
  let errorMessage: string | null = null;

  try {
    const accounts = await bankAccountService.list();
    items = accounts.map((item) => ({
      id: item.id,
      name: item.name,
      institution: item.institution,
      initialBalanceCents: item.initialBalanceCents,
      archived: item.archived,
      expenseCount: item.expenseCount,
    }));
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar contas bancárias.';
  }

  if (!items) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return <BankAccountsClient initialAccounts={items} />;
}
