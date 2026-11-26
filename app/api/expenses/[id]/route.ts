import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { expenseFormSchema } from '@/lib/domain/schemas';
import { expenseService } from '@/lib/services/expenses';

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

  const parsed = expenseFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos para a despesa.',
      },
      { status: 400 }
    );
  }

  try {
    const updated = await expenseService.update(id, {
      description: parsed.data.description,
      amountCents: parsed.data.amount,
      date: parsed.data.date,
      categoryId: parsed.data.categoryId,
      personId: parsed.data.personId,
      bankAccountId: parsed.data.bankAccountId,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível atualizar a despesa.');
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

  const { id } = await context.params;
  try {
    await expenseService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível excluir a despesa.');
  }
}
