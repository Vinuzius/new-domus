import { NextResponse } from 'next/server';
import { assertSameOriginRequest } from '@/lib/auth/guard';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: Request) {
  if (!assertSameOriginRequest(req)) {
    return NextResponse.json(
      { ok: false, error: 'Origem da requisição não autorizada.' },
      { status: 403 }
    );
  }

  const baseOptions = buildSessionCookieOptions(req);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...baseOptions,
    maxAge: 0,
  });
  return response;
}
