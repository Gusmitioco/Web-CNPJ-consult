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
const cacheTtlMs = 10 * 60 * 1000;

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
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function handleCnpjRequest(request, response, pathname) {
  const cnpj = onlyDigits(pathname.replace("/api/cnpj/", ""));

  if (cnpj.length !== 14) {
    sendJson(response, 400, { message: "Informe um CNPJ com 14 digitos." });
    return;
  }

  const cached = cnpjCache.get(cnpj);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload);
    return;
  }

  try {
    const upstream = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
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
  } catch {
    sendJson(response, 502, { message: "Falha ao conectar com a fonte publica de CNPJ." });
  }
}

async function serveStatic(response, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = path.normalize(path.join(distDir, cleanPath));
  const fallbackPath = path.join(distDir, "index.html");
  const filePath = requestedPath.startsWith(distDir) && existsSync(requestedPath) ? requestedPath : fallbackPath;
  const extension = path.extname(filePath);

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
      "cache-control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable"
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
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
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    response.end("Metodo nao permitido.");
    return;
  }

  await serveStatic(response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`Servidor pronto em http://localhost:${port}/`);
});
