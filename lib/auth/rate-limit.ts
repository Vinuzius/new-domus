export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface AttemptBucket {
  failures: number[];
  blockedUntilMs: number | null;
}

export class LoginRateLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;

  constructor(options?: {
    maxAttempts?: number;
    windowMs?: number;
    blockDurationMs?: number;
  }) {
    this.maxAttempts = options?.maxAttempts ?? 5;
    this.windowMs = options?.windowMs ?? 5 * 60 * 1000;
    this.blockDurationMs = options?.blockDurationMs ?? 5 * 60 * 1000;
  }

  private pruneBucket(key: string, nowMs: number): AttemptBucket {
    const existing = this.buckets.get(key) ?? { failures: [], blockedUntilMs: null };
    const cutoff = nowMs - this.windowMs;
    const recentFailures = existing.failures.filter((ts) => ts > cutoff);
    const blockedUntilMs =
      existing.blockedUntilMs && existing.blockedUntilMs > nowMs
        ? existing.blockedUntilMs
        : null;

    const updated: AttemptBucket = {
      failures: recentFailures,
      blockedUntilMs,
    };

    if (recentFailures.length === 0 && blockedUntilMs === null) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, updated);
    }

    return updated;
  }

  check(key: string, nowMs = Date.now()): RateLimitResult {
    const bucket = this.pruneBucket(key, nowMs);
    if (bucket.blockedUntilMs && bucket.blockedUntilMs > nowMs) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntilMs - nowMs) / 1000)),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - bucket.failures.length),
      retryAfterSeconds: 0,
    };
  }

  recordFailure(key: string, nowMs = Date.now()): RateLimitResult {
    const bucket = this.pruneBucket(key, nowMs);

    if (bucket.blockedUntilMs && bucket.blockedUntilMs > nowMs) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntilMs - nowMs) / 1000)),
      };
    }

    bucket.failures.push(nowMs);

    if (bucket.failures.length >= this.maxAttempts) {
      bucket.blockedUntilMs = nowMs + this.blockDurationMs;
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(this.blockDurationMs / 1000),
      };
    }

    this.buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - bucket.failures.length),
      retryAfterSeconds: 0,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

declare global {
  var __domusLoginRateLimiter: LoginRateLimiter | undefined;
}

export function getLoginRateLimiter(): LoginRateLimiter {
  if (!globalThis.__domusLoginRateLimiter) {
    globalThis.__domusLoginRateLimiter = new LoginRateLimiter();
  }
  return globalThis.__domusLoginRateLimiter;
}

export function getClientRateLimitKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'default-client';
}
