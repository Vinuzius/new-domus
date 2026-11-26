import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'domus_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
}

function sha256Digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyPasswordConstantTime(input: string, expected: string): boolean {
  if (!input || !expected) {
    return false;
  }
  const inputHash = sha256Digest(input);
  const expectedHash = sha256Digest(expected);
  return timingSafeEqual(inputHash, expectedHash);
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createSessionToken(secret: string, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now()
): boolean {
  if (!token || !secret) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, receivedSignature] = parts;
  if (!encodedPayload || !receivedSignature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const receivedBuf = Buffer.from(receivedSignature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (receivedBuf.length !== expectedBuf.length) {
    return false;
  }

  if (!timingSafeEqual(receivedBuf, expectedBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<SessionPayload>;

    if (
      parsed.v !== 1 ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      return false;
    }

    const nowSec = Math.floor(nowMs / 1000);
    return parsed.exp > nowSec;
  } catch {
    return false;
  }
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  maxAge: number;
  partitioned?: boolean;
}

export function buildSessionCookieOptions(req?: Request): SessionCookieOptions {
  const forwardedProto = req?.headers.get('x-forwarded-proto') ?? '';
  const origin = req?.headers.get('origin') ?? '';
  const referer = req?.headers.get('referer') ?? '';
  const forwardedHost = req?.headers.get('x-forwarded-host') ?? '';
  const host = req?.headers.get('host') ?? '';
  const appUrl = process.env.APP_URL ?? '';

  const isHttps =
    process.env.NODE_ENV === 'production' ||
    forwardedProto.split(',')[0]?.trim() === 'https' ||
    origin.startsWith('https://') ||
    referer.startsWith('https://') ||
    appUrl.startsWith('https://') ||
    Boolean(req?.url?.startsWith('https://'));

  const secFetchSite = req?.headers.get('sec-fetch-site') ?? '';
  const isEmbeddedIframe =
    secFetchSite === 'cross-site' ||
    origin.includes('.run.app') ||
    forwardedHost.includes('.run.app') ||
    host.includes('.run.app') ||
    appUrl.includes('.run.app');

  const usePartitionedCrossSiteCookie = isHttps && isEmbeddedIframe;

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: usePartitionedCrossSiteCookie ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    ...(usePartitionedCrossSiteCookie ? { partitioned: true } : {}),
  };
}
