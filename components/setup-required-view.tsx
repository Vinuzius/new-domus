import { KeyRound } from 'lucide-react';

interface SetupRequiredViewProps {
  missingVars: string[];
}

export function SetupRequiredView({ missingVars }: SetupRequiredViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Domus Finance
            </h1>
            <p className="text-sm text-slate-600">
              Configuração inicial do servidor pendente
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-700">
          Para iniciar a aplicação com persistência em PostgreSQL e proteção por senha
          compartilhada, defina as variáveis obrigatórias no ambiente do servidor:
        </p>

        <ul className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800">
          {missingVars.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>

        <p className="mt-5 text-xs leading-relaxed text-slate-600">
          Consulte o arquivo <span className="font-mono">.env.example</span> e o{' '}
          <span className="font-mono">README.md</span> para configurar a string{' '}
          <span className="font-mono">DATABASE_URL</span> do Supabase, aplicar as
          migrações do Drizzle e definir <span className="font-mono">APP_ACCESS_PASSWORD</span>{' '}
          e <span className="font-mono">APP_SESSION_SECRET</span>.
        </p>
      </div>
    </main>
  );
}
