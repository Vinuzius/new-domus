'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na interface:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              A conexão foi interrompida
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              O servidor reiniciou ou a página ficou desatualizada. Recarregue para
              continuar usando o Domus Finance.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <RotateCw className="h-4 w-4" />
                <span>Recarregar página</span>
              </button>
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
