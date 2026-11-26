import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { bankAccountFormSchema } from '@/lib/domain/schemas';
import { bankAccountService } from '@/lib/services/bank-accounts';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'archived' in body &&
    typeof (body as { archived?: unknown }).archived === 'boolean' &&
    !('name' in body)
  ) {
    try {
      const updated = await bankAccountService.setArchived(
        id,
        (body as { archived: boolean }).archived
      );
      return NextResponse.json({ ok: true, data: updated });
    } catch (error) {
      return apiErrorResponse(error, 'Não foi possível atualizar o status da conta.');
    }
  }

  const parsed = bankAccountFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos para conta bancária.',
      },
      { status: 400 }
    );
  }

  try {
    const updated = await bankAccountService.update(id, {
      name: parsed.data.name,
      institution: parsed.data.institution,
      initialBalanceCents: parsed.data.initialBalance,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível atualizar a conta bancária.');
  }
}
