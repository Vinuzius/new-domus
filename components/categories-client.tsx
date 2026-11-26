'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { apiMutate } from '@/lib/api/client';
import { categorySchema } from '@/lib/domain/schemas';
import { FeedbackBanner, type FeedbackState } from './feedback-banner';
import { Modal } from './modal';

export interface CategoryItem {
  id: string;
  name: string;
  expenseCount: number;
}

interface CategoriesClientProps {
  initialCategories: CategoryItem[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<CategoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setNameInput('');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: CategoryItem) {
    setEditing(item);
    setNameInput(item.name);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = categorySchema.safeParse({ name: nameInput });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Nome inválido.');
      return;
    }

    setSaving(true);
    const result = editing
      ? await apiMutate(`/api/categories/${editing.id}`, 'PATCH', parsed.data)
      : await apiMutate('/api/categories', 'POST', parsed.data);

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
        ? 'Categoria atualizada com sucesso.'
        : 'Categoria criada com sucesso.',
    });
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    const result = await apiMutate(`/api/categories/${deleting.id}`, 'DELETE');
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
    setFeedback({ type: 'success', message: 'Categoria excluída com sucesso.' });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Categorias
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Classifique suas despesas domésticas. Categorias vinculadas a despesas não
            podem ser excluídas para preservar o histórico.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="h-4 w-4" />
          <span>Nova categoria</span>
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {initialCategories.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <Tag className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            Nenhuma categoria cadastrada
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Crie categorias como Alimentação, Moradia ou Transporte antes de lançar
            despesas.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            <span>Criar primeira categoria</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Vínculos</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialCategories.map((category) => (
                <tr
                  key={category.id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    {category.name}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 tabular-nums">
                    {category.expenseCount === 0
                      ? 'Sem despesas vinculadas'
                      : `${category.expenseCount} ${
                          category.expenseCount === 1
                            ? 'despesa vinculada'
                            : 'despesas vinculadas'
                        }`}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(category)}
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
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        description="Escolha um nome claro para agrupar despesas semelhantes."
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="category-name"
              className="block text-sm font-medium text-slate-800"
            >
              Nome da categoria
            </label>
            <input
              id="category-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex.: Alimentação"
              maxLength={60}
              disabled={saving}
              autoFocus
              className="mt-1.5 block min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
            />
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
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar categoria'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir categoria"
      >
        {deleting ? (
          <div className="space-y-4">
            {deleting.expenseCount > 0 ? (
              <p className="text-sm leading-relaxed text-slate-700">
                A categoria <strong>{deleting.name}</strong> possui{' '}
                <strong>{deleting.expenseCount}</strong>{' '}
                {deleting.expenseCount === 1
                  ? 'despesa vinculada'
                  : 'despesas vinculadas'}
                . Para evitar despesas órfãs, reclassifique ou exclua essas despesas antes
                de remover esta categoria.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-slate-700">
                Tem certeza que deseja excluir a categoria{' '}
                <strong>{deleting.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {deleting.expenseCount > 0 ? 'Entendi' : 'Cancelar'}
              </button>
              {deleting.expenseCount === 0 ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteBusy}
                  className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteBusy ? 'Excluindo...' : 'Confirmar exclusão'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
