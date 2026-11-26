import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { categoryService } from '@/lib/services/categories';

export async function POST(req: Request) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  try {
    const created = await categoryService.create(body);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível criar a categoria.');
  }
}
