import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerConfigStatus, getSessionSecret } from '@/lib/env';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session';

export class UnauthorizedError extends Error {
  constructor(message = 'Sessão expirada ou não autenticada. Faça login novamente.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export const getAuthenticatedSession = cache(async (): Promise<boolean> => {
  const config = getServerConfigStatus();
  if (!config.isReady) {
    return false;
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const secret = getSessionSecret();
    return verifySessionToken(token, secret);
  } catch {
    return false;
  }
});

export async function requirePageAuth(): Promise<{ ready: boolean }> {
  const config = getServerConfigStatus();
  if (!config.isReady) {
    return { ready: false };
  }

  const authenticated = await getAuthenticatedSession();
  if (!authenticated) {
    redirect('/login');
  }

  return { ready: true };
}

export async function requireActionAuth(): Promise<void> {
  const config = getServerConfigStatus();
  if (!config.isReady) {
    throw new UnauthorizedError(
      'Configuração do servidor incompleta. Defina as variáveis de ambiente obrigatórias.'
    );
  }

  const authenticated = await getAuthenticatedSession();
  if (!authenticated) {
    throw new UnauthorizedError();
  }
}

export function assertSameOriginRequest(req: Request): boolean {
  const originHeader = req.headers.get('origin');
  if (!originHeader) {
    return (
      req.headers.get('x-requested-with') === 'XMLHttpRequest' ||
      req.headers.get('sec-fetch-site') === 'same-origin'
    );
  }

  const allowedHosts = new Set<string>();
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = req.headers.get('host')?.trim();

  if (forwardedHost) allowedHosts.add(forwardedHost);
  if (host) allowedHosts.add(host);

  if (process.env.APP_URL) {
    try {
      const appHost = new URL(process.env.APP_URL).host;
      allowedHosts.add(appHost);
      if (appHost.startsWith('ais-dev-')) {
        allowedHosts.add(appHost.replace(/^ais-dev-/, 'ais-pre-'));
      }
    } catch {
      // ignora APP_URL malformada
    }
  }

  if (allowedHosts.size === 0) {
    return false;
  }

  try {
    const parsedOrigin = new URL(originHeader);
    return allowedHosts.has(parsedOrigin.host);
  } catch {
    return false;
  }
}
