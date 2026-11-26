'use server';

import { revalidatePath } from 'next/cache';
import { requireActionAuth } from '@/lib/auth/guard';
import { categoryService, type CategoryWithUsage } from '@/lib/services/categories';
import { toActionError, type ActionResult } from './types';

export async function createCategoryAction(input: {
  name: string;
}): Promise<ActionResult<CategoryWithUsage>> {
  try {
    await requireActionAuth();
    const created = await categoryService.create(input);
    revalidatePath('/categorias');
    revalidatePath('/');
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, 'Não foi possível criar a categoria.');
  }
}

export async function updateCategoryAction(
  id: string,
  input: { name: string }
): Promise<ActionResult<CategoryWithUsage>> {
  try {
    await requireActionAuth();
    const updated = await categoryService.update(id, input);
    revalidatePath('/categorias');
    revalidatePath('/');
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, 'Não foi possível atualizar a categoria.');
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await requireActionAuth();
    await categoryService.remove(id);
    revalidatePath('/categorias');
    revalidatePath('/');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error, 'Não foi possível excluir a categoria.');
  }
}
