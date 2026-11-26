import { afterEach, describe, expect, it } from 'vitest';
import { LoginRateLimiter } from '@/lib/auth/rate-limit';
import {
  createSessionToken,
  verifyPasswordConstantTime,
  verifySessionToken,
} from '@/lib/auth/session';
import {
  getServerConfigStatus,
  getSessionSecret,
  MIN_SESSION_SECRET_LENGTH,
} from '@/lib/env';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_ACCESS_PASSWORD: process.env.APP_ACCESS_PASSWORD,
  APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
};

function restoreEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.DATABASE_URL = ORIGINAL_ENV.DATABASE_URL;
  process.env.APP_ACCESS_PASSWORD = ORIGINAL_ENV.APP_ACCESS_PASSWORD;
  process.env.APP_SESSION_SECRET = ORIGINAL_ENV.APP_SESSION_SECRET;
}

describe('Autenticação por senha compartilhada e sessão assinada', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('valida senha em tempo constante corretamente', () => {
    expect(verifyPasswordConstantTime('segredo-casa-2026', 'segredo-casa-2026')).toBe(true);
    expect(verifyPasswordConstantTime('segredo-errado', 'segredo-casa-2026')).toBe(false);
    expect(verifyPasswordConstantTime('', 'segredo-casa-2026')).toBe(false);
  });

  it('assina e verifica token de sessão válido, rejeita adulterado e expirado', () => {
    const secret = 'chave-super-secreta-com-mais-de-32-caracteres';
    const now = 1_700_000_000_000;
    const token = createSessionToken(secret, now);

    expect(verifySessionToken(token, secret, now + 1000)).toBe(true);
    expect(verifySessionToken(token, 'outra-chave-incorreta', now + 1000)).toBe(false);

    const tampered = `${token.slice(0, -2)}xx`;
    expect(verifySessionToken(tampered, secret, now + 1000)).toBe(false);

    // Após 8 dias (expira em 7 dias)
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    expect(verifySessionToken(token, secret, now + eightDaysMs)).toBe(false);
  });

  it('exige APP_SESSION_SECRET com pelo menos 32 caracteres em produção', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/postgres';
    process.env.APP_ACCESS_PASSWORD = 'senha-forte-teste';

    process.env.APP_SESSION_SECRET = 'curta-demais';
    const shortStatus = getServerConfigStatus();
    expect(shortStatus.isReady).toBe(false);
    expect(shortStatus.hasSessionSecret).toBe(false);
    expect(() => getSessionSecret()).toThrow();

    process.env.APP_SESSION_SECRET = 'a'.repeat(MIN_SESSION_SECRET_LENGTH);
    const validStatus = getServerConfigStatus();
    expect(validStatus.isReady).toBe(true);
    expect(validStatus.hasSessionSecret).toBe(true);
    expect(getSessionSecret()).toBe('a'.repeat(MIN_SESSION_SECRET_LENGTH));
  });

  it('bloqueia tentativas repetidas de login e libera após reset ou expiração', () => {
    const limiter = new LoginRateLimiter({
      maxAttempts: 3,
      windowMs: 60_000,
      blockDurationMs: 120_000,
    });

    const t0 = 1_000_000;
    expect(limiter.check('10.0.0.1', t0).allowed).toBe(true);

    expect(limiter.recordFailure('10.0.0.1', t0 + 100)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(limiter.recordFailure('10.0.0.1', t0 + 200)).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });

    const thirdFailure = limiter.recordFailure('10.0.0.1', t0 + 300);
    expect(thirdFailure.allowed).toBe(false);
    expect(thirdFailure.retryAfterSeconds).toBe(120);
    expect(limiter.check('10.0.0.1', t0 + 1000).allowed).toBe(false);

    // Após reset (login bem-sucedido), volta a permitir
    limiter.reset('10.0.0.1');
    expect(limiter.check('10.0.0.1', t0 + 2000).allowed).toBe(true);
  });
});
