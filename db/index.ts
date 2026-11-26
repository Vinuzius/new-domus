import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { getDatabaseUrl } from '@/lib/env';
import * as schema from './schema';

export type DomusDatabase = PostgresJsDatabase<typeof schema>;

declare global {
  var __domusPostgresClient: Sql | undefined;
  var __domusDrizzleDb: DomusDatabase | undefined;
}

function resolveSslOption(connectionString: string): 'require' | undefined {
  try {
    const parsed = new URL(connectionString);
    const explicitMode =
      parsed.searchParams.get('sslmode') ?? parsed.searchParams.get('ssl');
    if (explicitMode) {
      return undefined;
    }
    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    return isLocal ? undefined : 'require';
  } catch {
    return undefined;
  }
}

export function getDb(): DomusDatabase {
  if (globalThis.__domusDrizzleDb) {
    return globalThis.__domusDrizzleDb;
  }

  const connectionString = getDatabaseUrl();
  const ssl = resolveSslOption(connectionString);

  // prepare: false garante compatibilidade com Transaction Pooler do Supabase em ambiente serverless.
  const client =
    globalThis.__domusPostgresClient ??
    postgres(connectionString, {
      prepare: false,
      ...(ssl ? { ssl } : {}),
      max: process.env.NODE_ENV === 'production' ? 1 : 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });

  const db = drizzle(client, { schema });

  globalThis.__domusPostgresClient = client;
  globalThis.__domusDrizzleDb = db;

  return db;
}
