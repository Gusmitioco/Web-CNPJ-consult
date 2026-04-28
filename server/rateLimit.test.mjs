import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rateLimit.mjs";

test("rate limiter bloqueia acima do limite e libera nova janela", () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });

  assert.equal(limiter.isLimited("127.0.0.1", 1000), false);
  assert.equal(limiter.isLimited("127.0.0.1", 1001), false);
  assert.equal(limiter.isLimited("127.0.0.1", 1002), true);
  assert.equal(limiter.isLimited("127.0.0.1", 2101), false);
});

test("rate limiter separa contadores por chave", () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });

  assert.equal(limiter.isLimited("a", 1000), false);
  assert.equal(limiter.isLimited("b", 1000), false);
  assert.equal(limiter.isLimited("a", 1001), true);
});
