import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "server", "data");
const auditLogPath = path.join(dataDir, "query-log.json");
let writeQueue = Promise.resolve();

function formatLocalDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function normalizeIp(value) {
  if (!value) return "unknown";
  return value.replace(/^::ffff:/, "");
}

function headerValue(request, name) {
  const value = request.headers[name];
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function truncate(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getClientData(request) {
  return {
    ip: normalizeIp(request.socket.remoteAddress),
    host: truncate(headerValue(request, "host"), 180),
    userAgent: truncate(headerValue(request, "user-agent"), 320),
    origin: truncate(headerValue(request, "origin"), 180)
  };
}

async function readCurrentLog() {
  try {
    const content = await readFile(auditLogPath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    return [];
  }
}

async function appendLogEntry(entry) {
  await mkdir(dataDir, { recursive: true });
  const currentLog = await readCurrentLog();
  currentLog.push(entry);
  await writeFile(auditLogPath, `${JSON.stringify(currentLog, null, 2)}\n`, "utf8");
}

export function recordConsultation(request, details) {
  const now = new Date();
  const entry = {
    id: `${now.toISOString()}-${Math.random().toString(36).slice(2, 10)}`,
    queriedAt: now.toISOString(),
    queriedAtLocal: formatLocalDate(now),
    cnpj: details.cnpj,
    route: details.route,
    result: details.result,
    sources: details.sources,
    client: getClientData(request)
  };

  writeQueue = writeQueue.then(() => appendLogEntry(entry)).catch(() => undefined);
  return writeQueue;
}

