import { describe, expect, it } from 'vitest';
import { LoginRateLimiter } from '@/lib/auth/rate-limit';
import {
  createSessionToken,
  verifyPasswordConstantTime,
  verifySessionToken,
} from '@/lib/auth/session';

describe('Autenticação por senha compartilhada e sessão assinada', () => {
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
