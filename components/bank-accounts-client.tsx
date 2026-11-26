'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Landmark, Pencil, Plus } from 'lucide-react';
import { apiMutate } from '@/lib/api/client';
import { formatCentsToBRL, formatCentsToInput } from '@/lib/domain/money';
import { bankAccountFormSchema } from '@/lib/domain/schemas';
import { FeedbackBanner, type FeedbackState } from './feedback-banner';
import { Modal } from './modal';

export interface BankAccountItem {
  id: string;
  name: string;
  institution: string | null;
  initialBalanceCents: number;
  archived: boolean;
  expenseCount: number;
}

interface BankAccountsClientProps {
  initialAccounts: BankAccountItem[];
}

export function BankAccountsClient({ initialAccounts }: BankAccountsClientProps) {
  const router = useRouter();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [institutionInput, setInstitutionInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('0,00');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [archiving, setArchiving] = useState<BankAccountItem | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const activeAccounts = initialAccounts.filter((account) => !account.archived);
  const archivedAccounts = initialAccounts.filter((account) => account.archived);
  const visibleAccounts = view === 'active' ? activeAccounts : archivedAccounts;

  function openCreate() {
    setEditing(null);
    setNameInput('');
    setInstitutionInput('');
    setBalanceInput('0,00');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(account: BankAccountItem) {
    setEditing(account);
    setNameInput(account.name);
    setInstitutionInput(account.institution ?? '');
    setBalanceInput(formatCentsToInput(account.initialBalanceCents));
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = bankAccountFormSchema.safeParse({
      name: nameInput,
      institution: institutionInput,
      initialBalance: balanceInput,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos para conta.');
      return;
    }

    setSaving(true);
    const payload = {
      name: nameInput.trim(),
      institution: institutionInput.trim(),
      initialBalance: balanceInput.trim(),
    };

    const result = editing
      ? await apiMutate(`/api/bank-accounts/${editing.id}`, 'PATCH', payload)
      : await apiMutate('/api/bank-accounts', 'POST', payload);

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
        ? 'Conta bancária atualizada com sucesso.'
        : 'Conta bancária cadastrada com sucesso.',
    });
    router.refresh();
  }

  async function handleConfirmArchive() {
    if (!archiving || archiveBusy) return;
    const nextArchived = !archiving.archived;
    setArchiveBusy(true);

    const result = await apiMutate(`/api/bank-accounts/${archiving.id}`, 'PATCH', {
      archived: nextArchived,
    });
    setArchiveBusy(false);

    if (!result.ok) {
      if (result.unauthorized) {
        router.replace('/login');
        return;
      }
      setArchiving(null);
      setFeedback({ type: 'error', message: result.error });
      return;
    }

    setArchiving(null);
    setFeedback({
      type: 'success',
      message: nextArchived
        ? 'Conta arquivada com sucesso. Despesas antigas continuam preservadas.'
        : 'Conta reativada com sucesso.',
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Contas bancárias
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Cadastre contas opcionais para associar às despesas. O saldo inicial é
            apenas informativo nesta versão.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="h-4 w-4" />
          <span>Nova conta</span>
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="flex items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filtrar contas por situação"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'active'}
            onClick={() => setView('active')}
            className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              view === 'active'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ativas ({activeAccounts.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'archived'}
            onClick={() => setView('archived')}
            className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              view === 'archived'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Arquivadas ({archivedAccounts.length})
          </button>
        </div>
      </div>

      {visibleAccounts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <Landmark className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            {view === 'active'
              ? 'Nenhuma conta bancária ativa'
              : 'Nenhuma conta arquivada'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {view === 'active'
              ? 'Você pode cadastrar contas bancárias para organizar seus lançamentos, embora a vinculação nas despesas seja opcional.'
              : 'Contas arquivadas deixam de aparecer em novos lançamentos, mantendo seu histórico intacto.'}
          </p>
          {view === 'active' ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar primeira conta</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                  <th className="px-5 py-3">Conta</th>
                  <th className="px-5 py-3">Instituição</th>
                  <th className="px-5 py-3">Vínculos</th>
                  <th className="px-5 py-3 text-right">Saldo inicial (informativo)</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleAccounts.map((account) => (
                  <tr key={account.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {account.name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {account.institution ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 tabular-nums">
                      {account.expenseCount === 0
                        ? 'Sem vínculos'
                        : `${account.expenseCount} ${
                            account.expenseCount === 1 ? 'despesa' : 'despesas'
                          }`}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-900 tabular-nums">
                      {formatCentsToBRL(account.initialBalanceCents)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiving(account)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          {account.archived ? (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5" />
                              <span>Reativar</span>
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" />
                              <span>Arquivar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {visibleAccounts.map((account) => (
              <li key={account.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{account.name}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {account.institution ?? 'Instituição não informada'}
                      <span aria-hidden="true"> · </span>
                      {account.expenseCount === 0
                        ? 'Sem vínculos'
                        : `${account.expenseCount} ${
                            account.expenseCount === 1 ? 'despesa' : 'despesas'
                          }`}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-medium text-slate-900 tabular-nums">
                    {formatCentsToBRL(account.initialBalanceCents)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(account)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiving(account)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    {account.archived ? (
                      <>
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        <span>Reativar</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5" />
                        <span>Arquivar</span>
                      </>
                    )}
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
        title={editing ? 'Editar conta bancária' : 'Nova conta bancária'}
        description="O saldo inicial serve apenas como referência informativa."
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="account-name"
              className="block text-sm font-medium text-slate-800"
            >
              Nome da conta
            </label>
            <input
              id="account-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex.: Conta Principal"
              maxLength={80}
              disabled={saving}
              autoFocus
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="account-institution"
              className="block text-sm font-medium text-slate-800"
            >
              Instituição <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <input
              id="account-institution"
              type="text"
              value={institutionInput}
              onChange={(e) => setInstitutionInput(e.target.value)}
              placeholder="Ex.: Banco do Brasil, Nubank"
              maxLength={80}
              disabled={saving}
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="account-balance"
              className="block text-sm font-medium text-slate-800"
            >
              Saldo inicial informativo (R$)
            </label>
            <input
              id="account-balance"
              type="text"
              inputMode="decimal"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="0,00"
              disabled={saving}
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Armazenado em centavos inteiros. Não é alterado automaticamente pelas
              despesas.
            </p>
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
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar conta'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(archiving)}
        onClose={() => !archiveBusy && setArchiving(null)}
        title={archiving?.archived ? 'Reativar conta bancária' : 'Arquivar conta bancária'}
      >
        {archiving ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">
              {archiving.archived
                ? `Deseja reativar a conta "${archiving.name}" para que ela volte a ficar disponível em novos lançamentos?`
                : `Deseja arquivar a conta "${archiving.name}"? As despesas já vinculadas a ela continuarão preservadas no histórico.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setArchiving(null)}
                disabled={archiveBusy}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={archiveBusy}
                className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {archiveBusy
                  ? 'Atualizando...'
                  : archiving.archived
                  ? 'Confirmar reativação'
                  : 'Confirmar arquivamento'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
