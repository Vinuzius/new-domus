import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react';
import {
  formatCivilDateBR,
  formatYearMonthLabelPTBR,
  shiftYearMonth,
} from '@/lib/domain/dates';
import { formatCentsToBRL } from '@/lib/domain/money';
import type { MonthlySummaryResult } from '@/lib/services/expenses';

interface MonthlySummaryViewProps {
  summary: MonthlySummaryResult;
  currentYearMonth: string;
}

function formatPercentagePTBR(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function MonthlySummaryView({
  summary,
  currentYearMonth,
}: MonthlySummaryViewProps) {
  const prevMonth = shiftYearMonth(summary.yearMonth, -1);
  const nextMonth = shiftYearMonth(summary.yearMonth, 1);
  const monthLabel = formatYearMonthLabelPTBR(summary.yearMonth);
  const isCurrentMonth = summary.yearMonth === currentYearMonth;
  const monthExpensesHref = `/despesas?inicio=${summary.startDate}&fim=${summary.endDate}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Resumo mensal
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe os gastos consolidados da casa entre{' '}
            <span className="font-mono tabular-nums">
              {formatCivilDateBR(summary.startDate)}
            </span>{' '}
            e{' '}
            <span className="font-mono tabular-nums">
              {formatCivilDateBR(summary.endDate)}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav
            aria-label="Navegação mensal"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1"
          >
            <Link
              href={`/?mes=${prevMonth}`}
              prefetch={true}
              aria-label={`Mês anterior (${formatYearMonthLabelPTBR(prevMonth)})`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <span className="min-w-[164px] px-3 text-center text-sm font-semibold text-slate-900 whitespace-nowrap">
              {monthLabel}
            </span>

            <Link
              href={`/?mes=${nextMonth}`}
              prefetch={true}
              aria-label={`Mês seguinte (${formatYearMonthLabelPTBR(nextMonth)})`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </nav>

          {!isCurrentMonth ? (
            <Link
              href="/"
              prefetch={true}
              className="inline-flex min-h-[42px] items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Mês atual
            </Link>
          ) : null}

          <Link
            href="/despesas"
            prefetch={true}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <span>Gerenciar despesas</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <section aria-label="Indicadores principais do mês">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-600">
              Total de despesas do mês
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatCentsToBRL(summary.totalCents)}
            </p>
            <p className="mt-2 text-xs text-slate-500">{monthLabel}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-600">
              Quantidade de despesas
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {summary.expenseCount}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {summary.expenseCount === 0
                ? 'Nenhum lançamento no período'
                : summary.expenseCount === 1
                  ? 'lançamento registrado'
                  : 'lançamentos registrados'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-600">Média por despesa</p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatCentsToBRL(summary.averageCents)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {summary.expenseCount > 0
                ? 'Total dividido pelos lançamentos'
                : 'Sem despesas para calcular média'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-600">Maior despesa</p>
            {summary.largestExpense ? (
              <>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {formatCentsToBRL(summary.largestExpense.amountCents)}
                </p>
                <p
                  className="mt-2 truncate text-xs font-medium text-slate-700"
                  title={summary.largestExpense.description}
                >
                  {summary.largestExpense.description}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  R$ 0,00
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Nenhuma despesa neste mês
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {summary.expenseCount === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <ReceiptText className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            Nenhuma despesa registrada em {monthLabel}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Use as setas acima para consultar outros meses ou acesse a lista completa de
            despesas para registrar um novo lançamento.
          </p>
          <Link
            href="/despesas"
            prefetch={true}
            className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <span>Ir para despesas</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section
            aria-label="Distribuição por categoria"
            className="rounded-xl border border-slate-200 bg-white lg:col-span-5"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Gastos por categoria
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Selecione uma categoria para abrir as despesas filtradas do mês.
              </p>
            </div>

            {summary.byCategory.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-600">
                Sem gastos agrupados por categoria neste período.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.byCategory.map((category, index) => {
                  const barWidth = Math.max(
                    3,
                    Math.min(100, Math.round(category.percentage))
                  );
                  const categoryFilterHref = `/despesas?categoria=${category.categoryId}&inicio=${summary.startDate}&fim=${summary.endDate}`;

                  return (
                    <li key={category.categoryId}>
                      <Link
                        href={categoryFilterHref}
                        prefetch={true}
                        className="group block px-5 py-3.5 transition-colors hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 group-hover:underline">
                              {category.categoryName}
                            </span>
                            <span className="ml-2 text-xs text-slate-500 tabular-nums">
                              {category.expenseCount}{' '}
                              {category.expenseCount === 1 ? 'despesa' : 'despesas'}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2.5 text-right shrink-0">
                            <span className="font-mono text-sm font-medium text-slate-900 tabular-nums">
                              {formatCentsToBRL(category.totalCents)}
                            </span>
                            <span className="w-14 font-mono text-xs text-slate-600 tabular-nums">
                              {formatPercentagePTBR(category.percentage)}
                            </span>
                          </div>
                        </div>

                        <div
                          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full rounded-full transition-all ${
                              index === 0 ? 'bg-teal-700' : 'bg-slate-800'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Despesas recentes do mês"
            className="rounded-xl border border-slate-200 bg-white lg:col-span-7"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Despesas recentes
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Últimos lançamentos registrados em {monthLabel}.
                </p>
              </div>

              <Link
                href={monthExpensesHref}
                prefetch={true}
                className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Ver lista completa</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="hidden md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-600">
                    <th className="px-5 py-2.5">Data</th>
                    <th className="px-5 py-2.5">Descrição</th>
                    <th className="px-5 py-2.5">Categoria</th>
                    <th className="px-5 py-2.5">Responsável</th>
                    <th className="px-5 py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatCivilDateBR(expense.date)}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {expense.description}
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {expense.categoryName}
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {expense.personName}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCentsToBRL(expense.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {summary.recentExpenses.map((expense) => (
                <li key={expense.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{expense.description}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-mono tabular-nums">
                        {formatCivilDateBR(expense.date)}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{expense.categoryName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{expense.personName}</span>
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCentsToBRL(expense.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
