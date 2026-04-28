export function createRateLimiter({ windowMs, maxRequests }) {
  const requests = new Map();

  return {
    isLimited(key, now = Date.now()) {
      const current = requests.get(key);

      if (!current || current.expiresAt <= now) {
        requests.set(key, { count: 1, expiresAt: now + windowMs });
        return false;
      }

      current.count += 1;
      return current.count > maxRequests;
    },
    clear() {
      requests.clear();
    }
  };
}
