import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi, guardReadApi } from '@/lib/api/http';
import { expenseFormSchema } from '@/lib/domain/schemas';
import { expenseService } from '@/lib/services/expenses';

export async function GET(req: Request) {
  const denied = await guardReadApi();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const rawFilters = {
    q: searchParams.get('q') ?? undefined,
    startDate: searchParams.get('inicio') ?? undefined,
    endDate: searchParams.get('fim') ?? undefined,
    categoryId: searchParams.get('categoria') ?? undefined,
    personId: searchParams.get('pessoa') ?? undefined,
    bankAccountId: searchParams.get('conta') ?? undefined,
    sort: searchParams.get('ordenar') ?? undefined,
  };

  try {
    const result = await expenseService.listFiltered(rawFilters);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível consultar as despesas.');
  }
}

export async function POST(req: Request) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

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
    const created = await expenseService.create({
      description: parsed.data.description,
      amountCents: parsed.data.amount,
      date: parsed.data.date,
      categoryId: parsed.data.categoryId,
      personId: parsed.data.personId,
      bankAccountId: parsed.data.bankAccountId,
    });
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível registrar a despesa.');
  }
}
