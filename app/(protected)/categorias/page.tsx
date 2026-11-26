import { CategoriesClient, type CategoryItem } from '@/components/categories-client';
import { DbErrorBanner } from '@/components/db-error-banner';
import { requirePageAuth } from '@/lib/auth/guard';
import { categoryService } from '@/lib/services/categories';

export const dynamic = 'force-dynamic';

export default async function CategoriasPage() {
  await requirePageAuth();

  let items: CategoryItem[] | null = null;
  let errorMessage: string | null = null;

  try {
    const categories = await categoryService.list();
    items = categories.map((item) => ({
      id: item.id,
      name: item.name,
      expenseCount: item.expenseCount,
    }));
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar categorias.';
  }

  if (!items) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return <CategoriesClient initialCategories={items} />;
}
