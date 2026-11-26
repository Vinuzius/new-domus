'use server';

import { revalidatePath } from 'next/cache';
import { requireActionAuth } from '@/lib/auth/guard';
import { expenseFormSchema } from '@/lib/domain/schemas';
import { ServiceError } from '@/lib/services/errors';
import { expenseService } from '@/lib/services/expenses';
import { toActionError, type ActionResult } from './types';

export async function createExpenseAction(input: {
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  personId: string;
  bankAccountId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requireActionAuth();
    const parsed = expenseFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(
        'VALIDATION',
        parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.',
        400
      );
    }

    const created = await expenseService.create({
      description: parsed.data.description,
      amountCents: parsed.data.amount,
      date: parsed.data.date,
      categoryId: parsed.data.categoryId,
      personId: parsed.data.personId,
      bankAccountId: parsed.data.bankAccountId,
    });
    revalidatePath('/');
    revalidatePath('/categorias');
    revalidatePath('/pessoas');
    revalidatePath('/contas');
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, 'Não foi possível registrar a despesa.');
  }
}

export async function updateExpenseAction(
  id: string,
  input: {
    description: string;
    amount: string;
    date: string;
    categoryId: string;
    personId: string;
    bankAccountId?: string | null;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireActionAuth();
    const parsed = expenseFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(
        'VALIDATION',
        parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.',
        400
      );
    }

    const updated = await expenseService.update(id, {
      description: parsed.data.description,
      amountCents: parsed.data.amount,
      date: parsed.data.date,
      categoryId: parsed.data.categoryId,
      personId: parsed.data.personId,
      bankAccountId: parsed.data.bankAccountId,
    });
    revalidatePath('/');
    revalidatePath('/categorias');
    revalidatePath('/pessoas');
    revalidatePath('/contas');
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, 'Não foi possível atualizar a despesa.');
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    await requireActionAuth();
    await expenseService.remove(id);
    revalidatePath('/');
    revalidatePath('/categorias');
    revalidatePath('/pessoas');
    revalidatePath('/contas');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error, 'Não foi possível excluir a despesa.');
  }
}
