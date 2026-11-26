import { NextResponse } from 'next/server';
import { assertSameOriginRequest, requireActionAuth, UnauthorizedError } from '@/lib/auth/guard';
import { ServiceError } from '@/lib/services/errors';

export async function guardMutationApi(req: Request): Promise<NextResponse | null> {
  if (!assertSameOriginRequest(req)) {
    return NextResponse.json(
      { ok: false, error: 'Origem da requisição não autorizada.' },
      { status: 403 }
    );
  }

  try {
    await requireActionAuth();
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, error: 'Sessão inválida ou expirada.' },
      { status: 401 }
    );
  }
}

export function apiErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json({ ok: false, error: fallbackMessage }, { status: 500 });
}
