import { DbErrorBanner } from '@/components/db-error-banner';
import { SettingsClient } from '@/components/settings-client';
import { requirePageAuth } from '@/lib/auth/guard';
import { settingsService, type FinancialSettingsData } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  await requirePageAuth();

  let settings: FinancialSettingsData | null = null;
  let errorMessage: string | null = null;

  try {
    settings = await settingsService.getFinancialSettings();
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : 'Erro ao carregar as configurações.';
  }

  if (!settings) {
    return <DbErrorBanner message={errorMessage ?? undefined} />;
  }

  return <SettingsClient initialCycleStartDay={settings.cycleStartDay} />;
}
