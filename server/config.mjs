import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");

function loadLocalEnv() {
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !["0", "false", "nao", "não", "no"].includes(value.toLowerCase());
}

function listFromEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

loadLocalEnv();

export const config = {
  port: numberFromEnv("PORT", 5173),
  host: process.env.HOST || "0.0.0.0",
  brasilApiBaseUrl: process.env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api/cnpj/v1",
  cacheTtlMs: numberFromEnv("CACHE_TTL_MS", 10 * 60 * 1000),
  upstreamTimeoutMs: numberFromEnv("UPSTREAM_TIMEOUT_MS", 8000),
  rateLimitWindowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 60 * 1000),
  maxRequestsPerWindow: numberFromEnv("RATE_LIMIT_MAX", 40),
  refreshWindowMs: numberFromEnv("REFRESH_WINDOW_MS", 2 * 60 * 1000),
  sefazBa: {
    endpoint:
      process.env.SEFAZ_BA_ENDPOINT ||
      "https://nfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx",
    certPath: process.env.SEFAZ_CERT_PATH || "",
    certPassword: process.env.SEFAZ_CERT_PASSWORD || "",
    caPath: process.env.SEFAZ_CA_PATH || "",
    rejectUnauthorized: booleanFromEnv("SEFAZ_REJECT_UNAUTHORIZED", true),
    timeoutMs: numberFromEnv("SEFAZ_TIMEOUT_MS", 12000)
  },
  audit: {
    allowedIps: listFromEnv("AUDIT_ALLOWED_IPS", ["127.0.0.1", "::1"]),
    masterToken: process.env.AUDIT_MASTER_TOKEN || process.env.AUDIT_ADMIN_TOKEN || ""
  }
};
