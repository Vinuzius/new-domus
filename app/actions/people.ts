'use server';

import { revalidatePath } from 'next/cache';
import { requireActionAuth } from '@/lib/auth/guard';
import { personService, type PersonWithUsage } from '@/lib/services/people';
import { toActionError, type ActionResult } from './types';

export async function createPersonAction(input: {
  name: string;
}): Promise<ActionResult<PersonWithUsage>> {
  try {
    await requireActionAuth();
    const created = await personService.create(input);
    revalidatePath('/pessoas');
    revalidatePath('/');
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, 'Não foi possível cadastrar o responsável.');
  }
}

export async function updatePersonAction(
  id: string,
  input: { name: string }
): Promise<ActionResult<PersonWithUsage>> {
  try {
    await requireActionAuth();
    const updated = await personService.update(id, input);
    revalidatePath('/pessoas');
    revalidatePath('/');
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, 'Não foi possível atualizar o responsável.');
  }
}

export async function deletePersonAction(id: string): Promise<ActionResult> {
  try {
    await requireActionAuth();
    await personService.remove(id);
    revalidatePath('/pessoas');
    revalidatePath('/');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error, 'Não foi possível excluir o responsável.');
  }
}
