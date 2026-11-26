import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { categoryService } from '@/lib/services/categories';

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

  try {
    const updated = await categoryService.update(id, body);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível atualizar a categoria.');
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
    await categoryService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível excluir a categoria.');
  }
}
