import { randomBytes } from 'node:crypto';

export interface ServerConfigStatus {
  isReady: boolean;
  hasDatabaseUrl: boolean;
  hasAccessPassword: boolean;
  hasSessionSecret: boolean;
  missingVars: string[];
}

declare global {
  var __domusEphemeralSessionSecret: string | undefined;
}

export const MIN_SESSION_SECRET_LENGTH = 32;

export function getServerConfigStatus(): ServerConfigStatus {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasAccessPassword = Boolean(process.env.APP_ACCESS_PASSWORD?.trim());
  const rawSessionSecret = process.env.APP_SESSION_SECRET?.trim() ?? '';
  const hasSessionSecret =
    process.env.NODE_ENV === 'production'
      ? rawSessionSecret.length >= MIN_SESSION_SECRET_LENGTH
      : rawSessionSecret.length > 0;

  const missingVars: string[] = [];
  if (!hasDatabaseUrl) missingVars.push('DATABASE_URL');
  if (!hasAccessPassword) missingVars.push('APP_ACCESS_PASSWORD');
  if (process.env.NODE_ENV === 'production' && !hasSessionSecret) {
    missingVars.push(
      rawSessionSecret.length > 0
        ? `APP_SESSION_SECRET (mínimo ${MIN_SESSION_SECRET_LENGTH} caracteres em produção)`
        : 'APP_SESSION_SECRET'
    );
  }

  return {
    isReady: missingVars.length === 0,
    hasDatabaseUrl,
    hasAccessPassword,
    hasSessionSecret,
    missingVars,
  };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Variável de ambiente DATABASE_URL não configurada no servidor.');
  }
  return url;
}

export function getAccessPassword(): string | null {
  const password = process.env.APP_ACCESS_PASSWORD?.trim();
  return password && password.length > 0 ? password : null;
}

export function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET?.trim() ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (secret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(
        `Variável de ambiente APP_SESSION_SECRET deve possuir ao menos ${MIN_SESSION_SECRET_LENGTH} caracteres em produção.`
      );
    }
    return secret;
  }
  if (secret.length > 0) {
    return secret;
  }
  if (!globalThis.__domusEphemeralSessionSecret) {
    globalThis.__domusEphemeralSessionSecret = randomBytes(32).toString('hex');
  }
  return globalThis.__domusEphemeralSessionSecret;
}
