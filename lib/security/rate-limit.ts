import "server-only";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
};

type GlobalWithRateLimiter = typeof globalThis & {
  __madnessRateLimiter?: Map<string, Bucket>;
};

function getStore() {
  const g = globalThis as GlobalWithRateLimiter;
  if (!g.__madnessRateLimiter) {
    g.__madnessRateLimiter = new Map<string, Bucket>();
  }
  return g.__madnessRateLimiter;
}

export function enforceWindowRateLimit(options: RateLimitOptions) {
  const now = Date.now();
  const store = getStore();
  const current = store.get(options.key);

  if (!current || current.resetAt <= now) {
    store.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (current.count >= options.max) {
    throw new Error("Muitas tentativas em pouco tempo. Aguarde e tente novamente.");
  }

  current.count += 1;
  store.set(options.key, current);
}
