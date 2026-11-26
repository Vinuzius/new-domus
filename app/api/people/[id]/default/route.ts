import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi } from '@/lib/api/http';
import { personService } from '@/lib/services/people';

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
    const updated = await personService.setDefault(id, body);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível definir o responsável padrão.');
  }
}
