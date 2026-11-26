import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { bankAccountFormSchema } from '@/lib/domain/schemas';
import { bankAccountService } from '@/lib/services/bank-accounts';

export async function POST(req: Request) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
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
    const created = await bankAccountService.create({
      name: parsed.data.name,
      institution: parsed.data.institution,
      initialBalanceCents: parsed.data.initialBalance,
    });
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível cadastrar a conta bancária.');
  }
}
