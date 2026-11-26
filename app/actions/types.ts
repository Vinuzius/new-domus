import { UnauthorizedError } from '@/lib/auth/guard';
import { ServiceError } from '@/lib/services/errors';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function toActionError(error: unknown, fallbackMessage: string): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ServiceError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallbackMessage };
}
