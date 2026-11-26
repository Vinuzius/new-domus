import { AppShell } from '@/components/app-shell';
import { SetupRequiredView } from '@/components/setup-required-view';
import { requirePageAuth } from '@/lib/auth/guard';
import { getServerConfigStatus } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await requirePageAuth();
  if (!authResult.ready) {
    const config = getServerConfigStatus();
    return <SetupRequiredView missingVars={config.missingVars} />;
  }

  return <AppShell>{children}</AppShell>;
}
