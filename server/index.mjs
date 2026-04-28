import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const cnpjCache = new Map();
const rateLimit = new Map();
const cacheTtlMs = 10 * 60 * 1000;
const upstreamTimeoutMs = 8000;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 40;

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

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calcDigit = (base) => {
    let weight = base.length - 7;
    let sum = 0;

    for (const digit of base) {
      sum += Number(digit) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }

    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = calcDigit(cnpj.slice(0, 12));
  const second = calcDigit(cnpj.slice(0, 12) + first);

  return cnpj.endsWith(`${first}${second}`);
}

function getClientIp(request) {
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(request) {
  const now = Date.now();
  const key = getClientIp(request);
  const current = rateLimit.get(key);

  if (!current || current.expiresAt <= now) {
    rateLimit.set(key, { count: 1, expiresAt: now + rateLimitWindowMs });
    return false;
  }

  current.count += 1;
  return current.count > maxRequestsPerWindow;
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
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const upstream = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
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

    cnpjCache.set(cnpj, {
      expiresAt: Date.now() + cacheTtlMs,
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

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { ...securityHeaders, "content-type": "text/plain; charset=utf-8" });
    response.end("Metodo nao permitido.");
    return;
  }

  await serveStatic(request, response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`Servidor pronto em http://localhost:${port}/`);
});
