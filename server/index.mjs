import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasRequiredBrasilApiPayload, isValidCnpj, onlyDigits } from "./cnpj.mjs";
import { config } from "./config.mjs";
import { createRateLimiter } from "./rateLimit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const cnpjCache = new Map();
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

async function handleCnpjRequest(request, response, pathname) {
  const cnpj = onlyDigits(pathname.replace("/api/cnpj/", ""));

  if (isRateLimited(request)) {
    sendJson(response, 429, { message: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente." });
    return;
  }

  if (!isValidCnpj(cnpj)) {
    sendJson(response, 400, { message: "Informe um CNPJ valido com 14 digitos." });
    return;
  }

  const cached = cnpjCache.get(cnpj);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload);
    return;
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
      sendJson(response, upstream.status, {
        message: payload.message || payload.name || "Nao foi possivel consultar o CNPJ."
      });
      return;
    }

    if (!hasRequiredBrasilApiPayload(payload)) {
      sendJson(response, 502, { message: "A fonte publica retornou dados em formato inesperado." });
      return;
    }

    cnpjCache.set(cnpj, {
      expiresAt: Date.now() + config.cacheTtlMs,
      payload
    });
    sendJson(response, 200, payload);
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "Tempo limite excedido ao consultar a fonte publica."
        : "Falha ao conectar com a fonte publica de CNPJ.";
    sendJson(response, 502, { message });
  } finally {
    clearTimeout(timeout);
  }
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
