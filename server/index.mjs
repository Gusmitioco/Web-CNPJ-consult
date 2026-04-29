import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordConsultation } from "./auditLog.mjs";
import { hasRequiredBrasilApiPayload, isValidCnpj, onlyDigits } from "./cnpj.mjs";
import { config } from "./config.mjs";
import { createRateLimiter } from "./rateLimit.mjs";
import { classifySefazError, consultaCadastroBahia, hasSefazBaConfig } from "./sefazBa.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const cnpjCache = new Map();
const companyCache = new Map();
const rateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  maxRequests: config.maxRequestsPerWindow
});

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function getClientIp(request) {
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(request) {
  return rateLimiter.isLimited(getClientIp(request));
}

function sourceSummary(result) {
  return {
    ok: Boolean(result.ok),
    status: result.status,
    message: result.message,
    code: result.code,
    configured: result.configured
  };
}

async function recordConsultationSafe(request, details) {
  try {
    await recordConsultation(request, details);
  } catch {
    // O log local e auxiliar; falha de escrita nao deve bloquear a consulta.
  }
}

function validateApiRequest(request, response, cnpj) {
  if (!isValidCnpj(cnpj)) {
    sendJson(response, 400, { message: "Informe um CNPJ valido com 14 digitos." });
    return false;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, { message: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente." });
    return false;
  }

  return true;
}

async function fetchBrasilApiPayload(cnpj) {
  const cached = cnpjCache.get(cnpj);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, status: 200, payload: cached.payload, message: "Dados publicos retornados do cache." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);

  try {
    const upstream = await fetch(`${config.brasilApiBaseUrl}/${cnpj}`, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "consulta-cnpj-sefaz/0.1 (+local development)"
      }
    });

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        message: payload.message || payload.name || "Nao foi possivel consultar o CNPJ."
      };
    }

    if (!hasRequiredBrasilApiPayload(payload)) {
      return { ok: false, status: 502, message: "A fonte publica retornou dados em formato inesperado." };
    }

    cnpjCache.set(cnpj, {
      expiresAt: Date.now() + config.cacheTtlMs,
      payload
    });
    return { ok: true, status: 200, payload, message: "Dados publicos retornados." };
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "Tempo limite excedido ao consultar a fonte publica."
        : "Falha ao conectar com a fonte publica de CNPJ.";
    return { ok: false, status: 502, message };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSefazBahiaPayload(cnpj) {
  if (!hasSefazBaConfig()) {
    return { ok: false, status: 503, configured: false, message: "Consulta SEFAZ-BA nao configurada neste ambiente." };
  }

  try {
    const payload = await consultaCadastroBahia(cnpj);
    return { ok: true, status: 200, configured: true, payload, message: payload.statusMessage || "Consulta SEFAZ-BA concluida." };
  } catch (error) {
    const details = classifySefazError(error);
    return { ok: false, status: 502, configured: true, ...details };
  }
}

async function handleCnpjRequest(request, response, pathname) {
  const cnpj = onlyDigits(pathname.replace("/api/cnpj/", ""));

  if (!validateApiRequest(request, response, cnpj)) {
    return;
  }

  const result = await fetchBrasilApiPayload(cnpj);
  if (!result.ok) {
    await recordConsultationSafe(request, {
      cnpj,
      route: "cnpj",
      result: "error",
      sources: { brasilApi: sourceSummary(result) }
    });
    sendJson(response, result.status, { message: result.message });
    return;
  }

  await recordConsultationSafe(request, {
    cnpj,
    route: "cnpj",
    result: "success",
    sources: { brasilApi: sourceSummary(result) }
  });
  sendJson(response, 200, result.payload);
}

async function handleSefazBahiaRequest(request, response, pathname) {
  const cnpj = onlyDigits(pathname.replace("/api/fiscal/ba/", ""));

  if (!validateApiRequest(request, response, cnpj)) {
    return;
  }

  const result = await fetchSefazBahiaPayload(cnpj);
  if (!result.ok) {
    await recordConsultationSafe(request, {
      cnpj,
      route: "sefaz-ba",
      result: "error",
      sources: { sefazBa: sourceSummary(result) }
    });
    sendJson(response, result.status, { code: result.code, message: result.message });
    return;
  }

  await recordConsultationSafe(request, {
    cnpj,
    route: "sefaz-ba",
    result: "success",
    sources: { sefazBa: sourceSummary(result) }
  });
  sendJson(response, 200, result.payload);
}

async function handleCompanyRequest(request, response, pathname) {
  const cnpj = onlyDigits(pathname.replace("/api/company/", ""));

  if (!validateApiRequest(request, response, cnpj)) {
    return;
  }

  const cached = companyCache.get(cnpj);
  if (cached && cached.expiresAt > Date.now()) {
    await recordConsultationSafe(request, {
      cnpj,
      route: "company",
      result: "success-cache",
      sources: cached.payload.sources
    });
    sendJson(response, 200, cached.payload);
    return;
  }

  const [publicData, fiscalData] = await Promise.all([fetchBrasilApiPayload(cnpj), fetchSefazBahiaPayload(cnpj)]);
  const hasFiscalRegistration = Boolean(fiscalData.ok && fiscalData.payload?.registrations?.length);

  if (!publicData.ok && !hasFiscalRegistration) {
    await recordConsultationSafe(request, {
      cnpj,
      route: "company",
      result: "error",
      sources: {
        brasilApi: sourceSummary(publicData),
        sefazBa: sourceSummary(fiscalData)
      }
    });
    sendJson(response, publicData.status || fiscalData.status || 502, {
      message: publicData.message || fiscalData.message || "Nao foi possivel consultar o CNPJ."
    });
    return;
  }

  const payload = {
    cnpj,
    publicData: publicData.ok ? publicData.payload : null,
    fiscalData: fiscalData.ok ? fiscalData.payload : null,
    sources: {
      brasilApi: {
        ok: publicData.ok,
        status: publicData.status,
        message: publicData.message
      },
      sefazBa: {
        ok: fiscalData.ok,
        configured: fiscalData.configured,
        status: fiscalData.status,
        message: fiscalData.message,
        code: fiscalData.code
      }
    }
  };

  companyCache.set(cnpj, {
    expiresAt: Date.now() + config.cacheTtlMs,
    payload
  });
  await recordConsultationSafe(request, {
    cnpj,
    route: "company",
    result: publicData.ok && hasFiscalRegistration ? "success-full" : "success-partial",
    sources: payload.sources
  });
  sendJson(response, 200, payload);
}

async function serveStatic(request, response, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = path.normalize(path.join(distDir, cleanPath));
  const fallbackPath = path.join(distDir, "index.html");
  const filePath = requestedPath.startsWith(distDir) && existsSync(requestedPath) ? requestedPath : fallbackPath;
  const extension = path.extname(filePath);

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      ...securityHeaders,
      "content-type": contentTypes[extension] || "application/octet-stream",
      "cache-control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable"
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    response.writeHead(404, { ...securityHeaders, "content-type": "text/plain; charset=utf-8" });
    response.end("Arquivo nao encontrado.");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname.startsWith("/api/cnpj/")) {
    await handleCnpjRequest(request, response, url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/company/")) {
    await handleCompanyRequest(request, response, url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/fiscal/ba/")) {
    await handleSefazBahiaRequest(request, response, url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { ...securityHeaders, "content-type": "text/plain; charset=utf-8" });
    response.end("Metodo nao permitido.");
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { message: "Rota de API nao encontrada." });
    return;
  }

  await serveStatic(request, response, url.pathname);
});

server.listen(config.port, config.host, () => {
  console.log(`Servidor pronto em http://localhost:${config.port}/`);
});
