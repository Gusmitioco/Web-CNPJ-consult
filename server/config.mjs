function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  port: numberFromEnv("PORT", 5173),
  host: process.env.HOST || "0.0.0.0",
  brasilApiBaseUrl: process.env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api/cnpj/v1",
  cacheTtlMs: numberFromEnv("CACHE_TTL_MS", 10 * 60 * 1000),
  upstreamTimeoutMs: numberFromEnv("UPSTREAM_TIMEOUT_MS", 8000),
  rateLimitWindowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 60 * 1000),
  maxRequestsPerWindow: numberFromEnv("RATE_LIMIT_MAX", 40)
};
