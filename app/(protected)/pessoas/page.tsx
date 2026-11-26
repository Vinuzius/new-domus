import { DbErrorBanner } from '@/components/db-error-banner';
import { PeopleClient, type PersonItem } from '@/components/people-client';
import { requirePageAuth } from '@/lib/auth/guard';
import { personService } from '@/lib/services/people';

export const dynamic = 'force-dynamic';

export default async function PessoasPage() {
  await requirePageAuth();

  let items: PersonItem[] | null = null;
  let errorMessage: string | null = null;

  try {
    const people = await personService.list();
    items = people.map((item) => ({
      id: item.id,
      name: item.name,
      expenseCount: item.expenseCount,
    }));
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar responsáveis.';
  }

  if (!items) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return <PeopleClient initialPeople={items} />;
}
