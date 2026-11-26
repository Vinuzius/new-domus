import { DbErrorBanner } from '@/components/db-error-banner';
import { MonthlySummaryView } from '@/components/monthly-summary-client';
import { requirePageAuth } from '@/lib/auth/guard';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/domain/dates';
import { expenseService, type MonthlySummaryResult } from '@/lib/services/expenses';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ mes?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  await requirePageAuth();

  const resolvedParams = await searchParams;
  const rawMes = Array.isArray(resolvedParams.mes)
    ? resolvedParams.mes[0]
    : resolvedParams.mes;
  const currentYearMonth = getCurrentYearMonth();
  const selectedYearMonth =
    rawMes && isValidYearMonth(rawMes) ? rawMes.trim() : currentYearMonth;

  let summary: MonthlySummaryResult | null = null;
  let errorMessage: string | null = null;

  try {
    summary = await expenseService.getMonthlySummary(selectedYearMonth, 6);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar resumo mensal.';
  }

  if (!summary) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return (
    <MonthlySummaryView
      summary={summary}
      currentYearMonth={currentYearMonth}
    />
  );
}
