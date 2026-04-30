import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultUsersPath = path.join(rootDir, "server", "data", "audit-users.json");
const usersPath = process.env.AUDIT_USERS_PATH ? path.resolve(process.env.AUDIT_USERS_PATH) : defaultUsersPath;
const dataDir = path.dirname(usersPath);
const maxFailures = 3;
const tokenAlphabet = "023456789acdefghjklmnpqrstuvwxyz";

function nowIso() {
  return new Date().toISOString();
}

export function createAuditToken() {
  const bytes = randomBytes(36);
  let suffix = "";

  for (const byte of bytes) {
    suffix += tokenAlphabet[byte % tokenAlphabet.length];
  }

  return `bc1q${suffix}`;
}

function hashToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function previewToken(token) {
  const value = String(token || "");
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function safeEquals(first, second) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (firstBuffer.length !== secondBuffer.length) return false;
  return timingSafeEqual(firstBuffer, secondBuffer);
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(usersPath, "utf8"));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      blockedClients: Array.isArray(parsed.blockedClients) ? parsed.blockedClients : [],
      failedAttempts: Array.isArray(parsed.failedAttempts) ? parsed.failedAttempts : []
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { users: [], blockedClients: [], failedAttempts: [] };
    }

    return { users: [], blockedClients: [], failedAttempts: [] };
  }
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(usersPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function ensureMasterUser(config) {
  const store = await readStore();

  if (store.users.length || !config.masterToken) {
    return store;
  }

  store.users.push({
    id: "master",
    name: "GustavoB",
    role: "master",
    tokenHash: hashToken(config.masterToken),
    tokenPreview: previewToken(config.masterToken),
    allowedIps: ["*"],
    blocked: false,
    createdAt: nowIso(),
    lastLoginAt: ""
  });
  await writeStore(store);
  return store;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    tokenPreview: user.tokenPreview,
    allowedIps: user.allowedIps || [],
    blocked: Boolean(user.blocked),
    createdAt: user.createdAt || "",
    lastLoginAt: user.lastLoginAt || ""
  };
}

function findFailedAttempt(store, clientIp) {
  let attempt = store.failedAttempts.find((item) => item.ip === clientIp);

  if (!attempt) {
    attempt = { ip: clientIp, attempts: 0, lastAttemptAt: "", userAgent: "" };
    store.failedAttempts.push(attempt);
  }

  return attempt;
}

function isClientBlocked(store, clientIp) {
  return store.blockedClients.some((item) => item.ip === clientIp);
}

async function registerFailure(store, { clientIp, userAgent }) {
  const attempt = findFailedAttempt(store, clientIp);
  attempt.attempts += 1;
  attempt.lastAttemptAt = nowIso();
  attempt.userAgent = userAgent || "";

  if (attempt.attempts >= maxFailures && !isClientBlocked(store, clientIp)) {
    store.blockedClients.push({
      ip: clientIp,
      reason: "token_failed_3_times",
      attempts: attempt.attempts,
      blockedAt: nowIso(),
      userAgent: userAgent || ""
    });
  }

  await writeStore(store);

  return {
    blocked: attempt.attempts >= maxFailures,
    attemptsLeft: Math.max(0, maxFailures - attempt.attempts)
  };
}

async function clearFailures(store, clientIp) {
  const nextAttempts = store.failedAttempts.filter((item) => item.ip !== clientIp);

  if (nextAttempts.length !== store.failedAttempts.length) {
    store.failedAttempts = nextAttempts;
    await writeStore(store);
  }
}

function findUserByToken(store, token) {
  const tokenHash = hashToken(token);
  return store.users.find((user) => safeEquals(user.tokenHash || "", tokenHash));
}

function userCanUseIp(user, clientIp, globalAllowedIps) {
  if (user.role === "master") return true;

  const allowedIps = user.allowedIps?.length ? user.allowedIps : globalAllowedIps;
  return allowedIps.includes("*") || allowedIps.includes(clientIp);
}

export async function authenticateAuditUser({ token, clientIp, userAgent, config }) {
  const store = await ensureMasterUser(config);
  const tokenRequired = true;

  if (isClientBlocked(store, clientIp)) {
    return {
      allowed: false,
      authenticated: false,
      tokenRequired,
      blocked: true,
      attemptsLeft: 0,
      clientIp,
      user: null
    };
  }

  if (!token) {
    return {
      allowed: true,
      authenticated: false,
      tokenRequired,
      blocked: false,
      attemptsLeft: maxFailures,
      clientIp,
      user: null
    };
  }

  const user = findUserByToken(store, token);

  if (!user || user.blocked) {
    const failure = await registerFailure(store, { clientIp, userAgent });
    return {
      allowed: !failure.blocked,
      authenticated: false,
      tokenRequired,
      blocked: failure.blocked,
      attemptsLeft: failure.attemptsLeft,
      clientIp,
      user: null
    };
  }

  if (!userCanUseIp(user, clientIp, config.allowedIps)) {
    return {
      allowed: false,
      authenticated: false,
      tokenRequired,
      blocked: false,
      attemptsLeft: maxFailures,
      clientIp,
      user: sanitizeUser(user)
    };
  }

  user.lastLoginAt = nowIso();
  await writeStore(store);
  await clearFailures(store, clientIp);

  return {
    allowed: true,
    authenticated: true,
    tokenRequired,
    blocked: false,
    attemptsLeft: maxFailures,
    clientIp,
    user: sanitizeUser(user)
  };
}

export async function readAuditUsersForMaster(access) {
  if (access?.user?.role !== "master") {
    return null;
  }

  const store = await readStore();
  return {
    users: store.users.map(sanitizeUser),
    blockedClients: store.blockedClients,
    failedAttempts: store.failedAttempts
  };
}

export async function createAuditUserForMaster(access, input) {
  if (access?.user?.role !== "master") {
    return null;
  }

  const store = await readStore();
  const token = createAuditToken();
  const id = `user-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const role = input.role === "master" ? "master" : "viewer";
  const name = String(input.name || "").trim().slice(0, 80) || "Usuario auditoria";
  const allowedIps = Array.isArray(input.allowedIps)
    ? input.allowedIps.map((item) => String(item).trim()).filter(Boolean)
    : ["*"];

  const user = {
    id,
    name,
    role,
    tokenHash: hashToken(token),
    tokenPreview: previewToken(token),
    allowedIps: allowedIps.length ? allowedIps : ["*"],
    blocked: false,
    createdAt: nowIso(),
    lastLoginAt: ""
  };

  store.users.push(user);
  await writeStore(store);

  return {
    user: sanitizeUser(user),
    token
  };
}

export async function unblockAuditClientForMaster(access, input) {
  if (access?.user?.role !== "master") {
    return null;
  }

  const ip = String(input?.ip || "").trim().slice(0, 80);

  if (!ip) {
    const error = new Error("Informe o IP que sera desbloqueado.");
    error.statusCode = 400;
    throw error;
  }

  const store = await readStore();
  const previousBlockedCount = store.blockedClients.length;
  const previousFailedCount = store.failedAttempts.length;

  store.blockedClients = store.blockedClients.filter((item) => item.ip !== ip);
  store.failedAttempts = store.failedAttempts.filter((item) => item.ip !== ip);

  await writeStore(store);

  return {
    ip,
    removedBlocked: previousBlockedCount - store.blockedClients.length,
    removedFailures: previousFailedCount - store.failedAttempts.length,
    blockedClients: store.blockedClients,
    failedAttempts: store.failedAttempts
  };
}
