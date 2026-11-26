'use server';

import { revalidatePath } from 'next/cache';
import { requireActionAuth } from '@/lib/auth/guard';
import { bankAccountFormSchema } from '@/lib/domain/schemas';
import { bankAccountService, type BankAccountWithUsage } from '@/lib/services/bank-accounts';
import { ServiceError } from '@/lib/services/errors';
import { toActionError, type ActionResult } from './types';

export async function createBankAccountAction(input: {
  name: string;
  institution?: string;
  initialBalance: string;
}): Promise<ActionResult<BankAccountWithUsage>> {
  try {
    await requireActionAuth();
    const parsed = bankAccountFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(
        'VALIDATION',
        parsed.error.issues[0]?.message ?? 'Dados inválidos para conta bancária.',
        400
      );
    }

    const created = await bankAccountService.create({
      name: parsed.data.name,
      institution: parsed.data.institution,
      initialBalanceCents: parsed.data.initialBalance,
    });
    revalidatePath('/contas');
    revalidatePath('/');
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, 'Não foi possível cadastrar a conta bancária.');
  }
}

export async function updateBankAccountAction(
  id: string,
  input: {
    name: string;
    institution?: string;
    initialBalance: string;
  }
): Promise<ActionResult<BankAccountWithUsage>> {
  try {
    await requireActionAuth();
    const parsed = bankAccountFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(
        'VALIDATION',
        parsed.error.issues[0]?.message ?? 'Dados inválidos para conta bancária.',
        400
      );
    }

    const updated = await bankAccountService.update(id, {
      name: parsed.data.name,
      institution: parsed.data.institution,
      initialBalanceCents: parsed.data.initialBalance,
    });
    revalidatePath('/contas');
    revalidatePath('/');
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, 'Não foi possível atualizar a conta bancária.');
  }
}

export async function toggleArchiveBankAccountAction(
  id: string,
  archived: boolean
): Promise<ActionResult<BankAccountWithUsage>> {
  try {
    await requireActionAuth();
    const updated = await bankAccountService.setArchived(id, archived);
    revalidatePath('/contas');
    revalidatePath('/');
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, 'Não foi possível atualizar o status da conta.');
  }
}
