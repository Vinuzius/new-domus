import { NextResponse } from 'next/server';
import { assertSameOriginRequest } from '@/lib/auth/guard';
import { getClientRateLimitKey, getLoginRateLimiter } from '@/lib/auth/rate-limit';
import {
  buildSessionCookieOptions,
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifyPasswordConstantTime,
} from '@/lib/auth/session';
import { loginSchema } from '@/lib/domain/schemas';
import { getAccessPassword, getServerConfigStatus, getSessionSecret } from '@/lib/env';

export async function POST(req: Request) {
  if (!assertSameOriginRequest(req)) {
    return NextResponse.json(
      { ok: false, error: 'Origem da requisição não autorizada.' },
      { status: 403 }
    );
  }

  const config = getServerConfigStatus();
  const expectedPassword = getAccessPassword();

  if (!config.isReady || !expectedPassword) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Configuração do servidor incompleta. Defina DATABASE_URL e APP_ACCESS_PASSWORD.',
      },
      { status: 503 }
    );
  }

  const limiter = getLoginRateLimiter();
  const clientKey = getClientRateLimitKey(req);
  const preCheck = limiter.check(clientKey);

  if (!preCheck.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Muitas tentativas incorretas. Aguarde ${preCheck.retryAfterSeconds} segundos para tentar novamente.`,
        retryAfterSeconds: preCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(preCheck.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Requisição inválida.' },
      { status: 400 }
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Informe a senha de acesso.',
      },
      { status: 400 }
    );
  }

  const isMatch = verifyPasswordConstantTime(parsed.data.password, expectedPassword);
  if (!isMatch) {
    const failureState = limiter.recordFailure(clientKey);
    if (!failureState.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Muitas tentativas incorretas. Aguarde ${failureState.retryAfterSeconds} segundos para tentar novamente.`,
          retryAfterSeconds: failureState.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(failureState.retryAfterSeconds) },
        }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Senha incorreta. Restam ${failureState.remaining} ${
          failureState.remaining === 1 ? 'tentativa' : 'tentativas'
        } antes do bloqueio temporário.`,
      },
      { status: 401 }
    );
  }

  limiter.reset(clientKey);
  const token = createSessionToken(getSessionSecret());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(req));
  return response;
}
