import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { SetupRequiredView } from '@/components/setup-required-view';
import { getAuthenticatedSession } from '@/lib/auth/guard';
import { getServerConfigStatus } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const config = getServerConfigStatus();
  if (!config.isReady) {
    return <SetupRequiredView missingVars={config.missingVars} />;
  }

  const authenticated = await getAuthenticatedSession();
  if (authenticated) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8">
        <div className="border-b border-slate-100 pb-5">
          <p className="text-xs font-medium tracking-wide text-slate-500">
            Organização financeira doméstica
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Domus Finance
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Informe a senha compartilhada configurada no servidor para acessar despesas,
            categorias, responsáveis e contas bancárias.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
