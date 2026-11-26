'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface DbErrorBannerProps {
  message?: string;
}

export function DbErrorBanner({ message }: DbErrorBannerProps) {
  const router = useRouter();

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-white p-6 text-slate-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            Não foi possível consultar o banco de dados
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {message ||
              'Verifique se a variável DATABASE_URL aponta para um PostgreSQL acessível e se as migrações iniciais já foram aplicadas.'}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <RotateCw className="h-4 w-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
