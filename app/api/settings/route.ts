import { NextResponse } from 'next/server';
import { apiErrorResponse, guardMutationApi, guardReadApi } from '@/lib/api/http';
import { settingsService } from '@/lib/services/settings';

export async function GET() {
  const denied = await guardReadApi();
  if (denied) return denied;

  try {
    const settings = await settingsService.getFinancialSettings();
    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível carregar as configurações.');
  }
}

export async function PATCH(req: Request) {
  const denied = await guardMutationApi(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  try {
    const updated = await settingsService.updateCycleStartDay(body);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return apiErrorResponse(
      error,
      'Não foi possível salvar as configurações financeiras.'
    );
  }
}
