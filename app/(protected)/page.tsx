import { DbErrorBanner } from '@/components/db-error-banner';
import { MonthlySummaryView } from '@/components/monthly-summary-client';
import { requirePageAuth } from '@/lib/auth/guard';
import { getCurrentFinancialCycle, isValidYearMonth } from '@/lib/domain/dates';
import { expenseService, type MonthlySummaryResult } from '@/lib/services/expenses';
import { settingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ ciclo?: string | string[]; mes?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  await requirePageAuth();

  const resolvedParams = await searchParams;
  const rawCiclo = Array.isArray(resolvedParams.ciclo)
    ? resolvedParams.ciclo[0]
    : resolvedParams.ciclo;
  const rawMes = Array.isArray(resolvedParams.mes)
    ? resolvedParams.mes[0]
    : resolvedParams.mes;
  const candidateAnchor = rawCiclo ?? rawMes;

  let summary: MonthlySummaryResult | null = null;
  let currentCycleAnchor = '';
  let errorMessage: string | null = null;

  try {
    const settings = await settingsService.getFinancialSettings();
    const currentCycle = getCurrentFinancialCycle(settings.cycleStartDay);
    currentCycleAnchor = currentCycle.anchorYearMonth;

    const selectedAnchor =
      candidateAnchor && isValidYearMonth(candidateAnchor)
        ? candidateAnchor.trim()
        : currentCycleAnchor;

    summary = await expenseService.getCycleSummary(
      selectedAnchor,
      settings.cycleStartDay,
      6
    );
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Erro ao carregar resumo financeiro.';
  }

  if (!summary) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return (
    <MonthlySummaryView
      summary={summary}
      currentCycleAnchor={currentCycleAnchor}
    />
  );
}
