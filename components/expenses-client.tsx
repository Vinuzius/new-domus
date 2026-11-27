'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiMutate } from '@/lib/api/client';
import {
  formatCivilDateBR,
  getTodayCivilDateBR,
  maskCivilDateBRInput,
  parseCivilDateBRToISO,
  type FinancialCyclePeriod,
} from '@/lib/domain/dates';
import { formatCentsToBRL, formatCentsToInput } from '@/lib/domain/money';
import { resolveDefaultPersonId } from '@/lib/domain/people';
import { expenseFormSchema, type ExpenseSortOption } from '@/lib/domain/schemas';
import { DatePickerInput } from './date-picker-input';
import { FeedbackBanner, type FeedbackState } from './feedback-banner';
import { Modal } from './modal';

export interface ExpenseRowItem {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  categoryId: string;
  categoryName: string;
  personId: string;
  personName: string;
  bankAccountId: string | null;
  bankAccountName: string | null;
  bankAccountArchived: boolean;
}

export interface SelectOptionItem {
  id: string;
  name: string;
  archived?: boolean;
  isDefault?: boolean;
}

export interface ExpenseFilterState {
  q: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  personId: string;
  bankAccountId: string;
  sort: ExpenseSortOption;
}

interface ExpensesClientProps {
  initialExpenses: ExpenseRowItem[];
  initialFilteredTotalCents: number;
  initialFilters: ExpenseFilterState;
  currentCycle: FinancialCyclePeriod;
  categories: SelectOptionItem[];
  people: SelectOptionItem[];
  bankAccounts: SelectOptionItem[];
}

function buildQueryParams(filters: ExpenseFilterState): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set('q', q);
  if (filters.startDate) params.set('inicio', filters.startDate);
  if (filters.endDate) params.set('fim', filters.endDate);
  if (filters.categoryId) params.set('categoria', filters.categoryId);
  if (filters.personId) params.set('pessoa', filters.personId);
  if (filters.bankAccountId) params.set('conta', filters.bankAccountId);
  if (filters.sort && filters.sort !== 'date_desc') {
    params.set('ordenar', filters.sort);
  }
  return params.toString();
}

export function ExpensesClient({
  initialExpenses,
  initialFilteredTotalCents,
  initialFilters,
  currentCycle,
  categories,
  people,
  bankAccounts,
}: ExpensesClientProps) {
  const router = useRouter();
  const [prevInitialExpenses, setPrevInitialExpenses] = useState(initialExpenses);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [filteredTotalCents, setFilteredTotalCents] = useState(initialFilteredTotalCents);

  if (prevInitialExpenses !== initialExpenses) {
    setPrevInitialExpenses(initialExpenses);
    setExpenses(initialExpenses);
    setFilteredTotalCents(initialFilteredTotalCents);
  }

  const [filters, setFilters] = useState<ExpenseFilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const [filterDateError, setFilterDateError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRowItem | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [personId, setPersonId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ExpenseRowItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const missingDependencies = categories.length === 0 || people.length === 0;
  const activeAccounts = bankAccounts.filter((account) => !account.archived);

  const hasActiveFilters = Boolean(
    filters.q.trim() ||
      filters.startDate ||
      filters.endDate ||
      filters.categoryId ||
      filters.personId ||
      filters.bankAccountId ||
      filters.sort !== 'date_desc' ||
      searchInput.trim() ||
      filterDateError
  );

  const isUsingCurrentCycle =
    filters.startDate === currentCycle.startDate &&
    filters.endDate === currentCycle.endDate;

  async function executeFetch(nextFilters: ExpenseFilterState, syncUrl = true) {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const query = buildQueryParams(nextFilters);
    if (syncUrl && typeof window !== 'undefined') {
      const nextUrl = query ? `/despesas?${query}` : '/despesas';
      window.history.replaceState(null, '', nextUrl);
    }

    setLoadingList(true);
    setListError(null);

    try {
      const response = await fetch(`/api/expenses${query ? `?${query}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { items: ExpenseRowItem[]; filteredTotalCents: number };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        setListError(payload.error ?? 'Não foi possível filtrar as despesas.');
        setLoadingList(false);
        return;
      }

      setExpenses(payload.data.items);
      setFilteredTotalCents(payload.data.filteredTotalCents);
      setLoadingList(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setListError('Erro de conexão ao consultar despesas.');
      setLoadingList(false);
    }
  }

  function applyImmediateFilter(nextFilters: ExpenseFilterState) {
    setFilters(nextFilters);
    void executeFetch(nextFilters);
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const nextFilters: ExpenseFilterState = {
        ...filters,
        q: value.trim(),
      };
      setFilters(nextFilters);
      void executeFetch(nextFilters);
    }, 280);
  }

  function handleApplyCurrentCycle() {
    setFilterDateError(null);
    setListError(null);
    applyImmediateFilter({
      ...filters,
      startDate: currentCycle.startDate,
      endDate: currentCycle.endDate,
    });
  }

  function handleClearFilters() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchInput('');
    setFilterDateError(null);
    setListError(null);
    applyImmediateFilter({
      q: '',
      startDate: '',
      endDate: '',
      categoryId: '',
      personId: '',
      bankAccountId: '',
      sort: 'date_desc',
    });
  }

  function openCreate() {
    setEditing(null);
    setDescription('');
    setAmount('');
    setDate(getTodayCivilDateBR());
    setCategoryId(categories[0]?.id ?? '');
    setPersonId(resolveDefaultPersonId(people));
    setBankAccountId('');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(expense: ExpenseRowItem) {
    setEditing(expense);
    setDescription(expense.description);
    setAmount(formatCentsToInput(expense.amountCents));
    setDate(formatCivilDateBR(expense.date));
    setCategoryId(expense.categoryId);
    setPersonId(expense.personId);
    setBankAccountId(expense.bankAccountId ?? '');
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const isoDate = parseCivilDateBRToISO(date);
    if (!isoDate) {
      setFormError('Informe uma data válida no padrão DD/MM/AAAA.');
      return;
    }

    const parsed = expenseFormSchema.safeParse({
      description,
      amount,
      date: isoDate,
      categoryId,
      personId,
      bankAccountId: bankAccountId || null,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.');
      return;
    }

    setSaving(true);
    const payload = {
      description: description.trim(),
      amount: amount.trim(),
      date: isoDate,
      categoryId,
      personId,
      bankAccountId: bankAccountId || null,
    };

    const result = editing
      ? await apiMutate(`/api/expenses/${editing.id}`, 'PATCH', payload)
      : await apiMutate('/api/expenses', 'POST', payload);

    setSaving(false);

    if (!result.ok) {
      if (result.unauthorized) {
        router.replace('/login');
        return;
      }
      setFormError(result.error);
      return;
    }

    setFormOpen(false);
    setFeedback({
      type: 'success',
      message: editing
        ? 'Despesa atualizada com sucesso.'
        : 'Despesa registrada com sucesso.',
    });
    await executeFetch(filters, false);
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    const result = await apiMutate(`/api/expenses/${deleting.id}`, 'DELETE');
    setDeleteBusy(false);

    if (!result.ok) {
      if (result.unauthorized) {
        router.replace('/login');
        return;
      }
      setDeleting(null);
      setFeedback({ type: 'error', message: result.error });
      return;
    }

    setDeleting(null);
    setFeedback({ type: 'success', message: 'Despesa excluída com sucesso.' });
    await executeFetch(filters, false);
    router.refresh();
  }

  const selectableAccounts = bankAccounts.filter(
    (account) => !account.archived || account.id === editing?.bankAccountId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Despesas
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Consulte, filtre e registre os gastos da casa em reais (BRL).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={missingDependencies}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="h-4 w-4" />
          <span>Nova despesa</span>
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {missingDependencies ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-950">
          <p className="font-semibold">Cadastros prévios necessários</p>
          <p className="mt-1 leading-relaxed text-amber-900">
            Toda despesa exige uma categoria e um responsável. Para começar, cadastre
            pelo menos uma opção nos links abaixo:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {categories.length === 0 ? (
              <Link
                href="/categorias"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
              >
                Cadastrar categoria
              </Link>
            ) : null}
            {people.length === 0 ? (
              <Link
                href="/pessoas"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
              >
                Cadastrar responsável
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section
        aria-label="Pesquisa e filtros de despesas"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="expense-search"
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Pesquisar despesas pela descrição..."
                aria-label="Pesquisar despesas pela descrição"
                maxLength={100}
                className="block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Limpar pesquisa"
                  className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 sm:w-56">
              <label htmlFor="filter-sort" className="sr-only">
                Ordenação
              </label>
              <select
                id="filter-sort"
                value={filters.sort}
                onChange={(e) =>
                  applyImmediateFilter({
                    ...filters,
                    sort: e.target.value as ExpenseSortOption,
                  })
                }
                aria-label="Ordenar despesas"
                className="block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="date_desc">Mais recentes primeiro</option>
                <option value="date_asc">Mais antigas primeiro</option>
                <option value="amount_desc">Maior valor</option>
                <option value="amount_asc">Menor valor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <DatePickerInput
              id="filter-start-date"
              label="Data inicial"
              value={filters.startDate}
              maxDate={filters.endDate || undefined}
              onInvalidInput={setFilterDateError}
              onChange={(iso) => {
                setFilterDateError(null);
                applyImmediateFilter({ ...filters, startDate: iso });
              }}
            />

            <DatePickerInput
              id="filter-end-date"
              label="Data final"
              value={filters.endDate}
              minDate={filters.startDate || undefined}
              onInvalidInput={setFilterDateError}
              onChange={(iso) => {
                setFilterDateError(null);
                applyImmediateFilter({ ...filters, endDate: iso });
              }}
            />

            <div>
              <label
                htmlFor="filter-category"
                className="block text-xs font-medium text-slate-600"
              >
                Categoria
              </label>
              <select
                id="filter-category"
                value={filters.categoryId}
                onChange={(e) =>
                  applyImmediateFilter({ ...filters, categoryId: e.target.value })
                }
                className="mt-1 block min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">Todas as categorias</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-person"
                className="block text-xs font-medium text-slate-600"
              >
                Responsável
              </label>
              <select
                id="filter-person"
                value={filters.personId}
                onChange={(e) =>
                  applyImmediateFilter({ ...filters, personId: e.target.value })
                }
                className="mt-1 block min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">Todos os responsáveis</option>
                {people.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-account"
                className="block text-xs font-medium text-slate-600"
              >
                Conta bancária
              </label>
              <select
                id="filter-account"
                value={filters.bankAccountId}
                onChange={(e) =>
                  applyImmediateFilter({ ...filters, bankAccountId: e.target.value })
                }
                className="mt-1 block min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">Todas as contas</option>
                {bankAccounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.archived ? ' (arquivada)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filterDateError ? (
            <p role="alert" className="text-xs font-medium text-red-700">
              {filterDateError}
            </p>
          ) : null}

          {listError ? (
            <p role="alert" className="text-xs font-medium text-red-700">
              {listError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="text-slate-600">
                {hasActiveFilters
                  ? 'Total dos resultados filtrados:'
                  : 'Total das despesas listadas:'}
              </span>
              <span className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                {formatCentsToBRL(filteredTotalCents)}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                · {expenses.length}{' '}
                {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
                {loadingList ? ' · Atualizando...' : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyCurrentCycle}
                aria-pressed={isUsingCurrentCycle}
                title={`Preencher período com o ciclo financeiro atual (${currentCycle.rangeLabel})`}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isUsingCurrentCycle
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Usar ciclo atual</span>
                <span
                  className={`hidden sm:inline font-mono tabular-nums ${
                    isUsingCurrentCycle ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  ({currentCycle.rangeLabel})
                </span>
              </button>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpar filtros</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {expenses.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
              <Search className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Nenhuma despesa encontrada para os filtros selecionados
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              Tente ajustar o texto da pesquisa, ampliar o período ou limpar os filtros
              para visualizar todos os lançamentos.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Limpar filtros</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Nenhuma despesa registrada ainda
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              Quando você registrar despesas, elas aparecerão aqui ordenadas pela data
              civil selecionada.
            </p>
            {!missingDependencies ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar primeira despesa</span>
              </button>
            ) : null}
          </div>
        )
      ) : (
        <div
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white transition-opacity ${
            loadingList ? 'opacity-70' : 'opacity-100'
          }`}
        >
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Conta</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatCivilDateBR(expense.date)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {expense.description}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{expense.categoryName}</td>
                    <td className="px-5 py-3.5 text-slate-700">{expense.personName}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {expense.bankAccountName ? (
                        <span>
                          {expense.bankAccountName}
                          {expense.bankAccountArchived ? ' (arquivada)' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCentsToBRL(expense.amountCents)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(expense)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {expenses.map((expense) => (
              <li key={expense.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
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
                      {expense.bankAccountName ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {expense.bankAccountName}
                            {expense.bankAccountArchived ? ' (arquivada)' : ''}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCentsToBRL(expense.amountCents)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(expense)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(expense)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Editar despesa' : 'Nova despesa'}
        description="Preencha os dados da despesa. Valores são salvos exatamente em centavos."
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="expense-description"
              className="block text-sm font-medium text-slate-800"
            >
              Descrição
            </label>
            <input
              id="expense-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Supermercado da semana"
              maxLength={140}
              disabled={saving}
              autoFocus
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-sm font-medium text-slate-800"
              >
                Valor (R$)
              </label>
              <input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex.: 149,90"
                disabled={saving}
                className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="expense-date"
                className="block text-sm font-medium text-slate-800"
              >
                Data (DD/MM/AAAA)
              </label>
              <input
                id="expense-date"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={date}
                onChange={(e) => setDate(maskCivilDateBRInput(e.target.value))}
                placeholder="DD/MM/AAAA"
                disabled={saving}
                className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="expense-category"
                className="block text-sm font-medium text-slate-800"
              >
                Categoria
              </label>
              <select
                id="expense-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving}
                className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expense-person"
                className="block text-sm font-medium text-slate-800"
              >
                Responsável
              </label>
              <select
                id="expense-person"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                disabled={saving}
                className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
              >
                {people.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="expense-account"
              className="block text-sm font-medium text-slate-800"
            >
              Conta bancária <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <select
              id="expense-account"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              disabled={saving}
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            >
              <option value="">Sem conta vinculada</option>
              {selectableAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.archived ? ' (arquivada)' : ''}
                </option>
              ))}
            </select>
            {activeAccounts.length === 0 && selectableAccounts.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Nenhuma conta ativa cadastrada. Você pode registrar sem conta ou criar
                uma na aba Contas.
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={saving}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Registrar despesa'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir despesa"
      >
        {deleting ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">
              Tem certeza que deseja excluir a despesa{' '}
              <strong>{deleting.description}</strong> no valor de{' '}
              <strong className="font-mono">
                {formatCentsToBRL(deleting.amountCents)}
              </strong>
              ? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deleteBusy ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
