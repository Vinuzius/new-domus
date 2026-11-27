'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Check } from 'lucide-react';
import { apiMutate } from '@/lib/api/client';
import {
  formatCivilDateBR,
  getCurrentFinancialCycle,
  MAX_CYCLE_START_DAY,
  MIN_CYCLE_START_DAY,
} from '@/lib/domain/dates';
import { financialSettingsSchema } from '@/lib/domain/schemas';
import { FeedbackBanner, type FeedbackState } from './feedback-banner';

interface SettingsClientProps {
  initialCycleStartDay: number;
}

const CYCLE_DAY_OPTIONS = Array.from(
  { length: MAX_CYCLE_START_DAY - MIN_CYCLE_START_DAY + 1 },
  (_, index) => MIN_CYCLE_START_DAY + index
);

export function SettingsClient({ initialCycleStartDay }: SettingsClientProps) {
  const router = useRouter();
  const [prevInitialDay, setPrevInitialDay] = useState(initialCycleStartDay);
  const [cycleStartDay, setCycleStartDay] = useState(initialCycleStartDay);
  const [savedDay, setSavedDay] = useState(initialCycleStartDay);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  if (prevInitialDay !== initialCycleStartDay) {
    setPrevInitialDay(initialCycleStartDay);
    setCycleStartDay(initialCycleStartDay);
    setSavedDay(initialCycleStartDay);
  }

  const previewCycle = getCurrentFinancialCycle(cycleStartDay);
  const hasChanges = cycleStartDay !== savedDay;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const parsed = financialSettingsSchema.safeParse({ cycleStartDay });
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message:
          parsed.error.issues[0]?.message ??
          'Informe um dia de início entre 1 e 28.',
      });
      return;
    }

    setSaving(true);
    const result = await apiMutate<{ cycleStartDay: number }>(
      '/api/settings',
      'PATCH',
      { cycleStartDay: parsed.data.cycleStartDay }
    );
    setSaving(false);

    if (!result.ok) {
      if (result.unauthorized) {
        router.replace('/login');
        return;
      }
      setFeedback({ type: 'error', message: result.error });
      return;
    }

    const updatedDay = result.data?.cycleStartDay ?? parsed.data.cycleStartDay;
    setSavedDay(updatedDay);
    setCycleStartDay(updatedDay);
    setFeedback({
      type: 'success',
      message:
        updatedDay === 1
          ? 'Ciclo financeiro atualizado para meses completos do calendário (início no dia 1).'
          : `Ciclo financeiro atualizado para iniciar todo dia ${updatedDay}.`,
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajuste como o Domus Finance agrupa o período do seu resumo financeiro.
        </p>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <section
        aria-labelledby="financial-cycle-heading"
        className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2
              id="financial-cycle-heading"
              className="text-base font-semibold text-slate-900"
            >
              Ciclo financeiro
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Defina em qual dia começa seu período financeiro. Se escolher 4, cada
              ciclo compreenderá do dia 4 de um mês até o dia 3 do mês seguinte.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div className="max-w-xs">
            <label
              htmlFor="cycle-start-day"
              className="block text-sm font-medium text-slate-800"
            >
              Dia de início do ciclo
            </label>
            <select
              id="cycle-start-day"
              value={cycleStartDay}
              onChange={(e) => {
                setCycleStartDay(Number.parseInt(e.target.value, 10));
                if (feedback) setFeedback(null);
              }}
              disabled={saving}
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            >
              {CYCLE_DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  Dia {day}
                  {day === 1 ? ' (mês do calendário)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              Prévia do ciclo atual com dia {cycleStartDay}:
            </p>
            <p className="mt-1 font-mono text-xs text-slate-700 tabular-nums">
              {formatCivilDateBR(previewCycle.startDate)} até{' '}
              {formatCivilDateBR(previewCycle.endDate)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {cycleStartDay === 1
                ? 'Com o dia 1, o resumo segue exatamente do primeiro ao último dia de cada mês.'
                : 'As datas inicial e final são inclusivas e aplicadas ao resumo e ao atalho de ciclo nos filtros.'}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'Salvando...' : 'Salvar configuração'}</span>
            </button>
            {hasChanges ? (
              <span className="text-xs text-slate-500">Alteração não salva</span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
