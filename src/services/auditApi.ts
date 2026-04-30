export type AuditSource = {
  ok?: boolean;
  status?: number;
  message?: string;
  code?: string;
  configured?: boolean;
};

export type AuditLogEntry = {
  id: string;
  queriedAt: string;
  queriedAtLocal: string;
  cnpj: string;
  route: string;
  result: string;
  sources?: {
    brasilApi?: AuditSource;
    sefazBa?: AuditSource;
  };
  client?: {
    ip?: string;
    host?: string;
    userAgent?: string;
    origin?: string;
  };
};

type AuditLogResponse = {
  entries: AuditLogEntry[];
  total: number;
};

export type AuditAccess = {
  allowed: boolean;
  authenticated: boolean;
  tokenRequired: boolean;
  blocked?: boolean;
  attemptsLeft?: number;
  clientIp: string;
  user?: {
    id: string;
    name: string;
    role: string;
    tokenPreview: string;
    allowedIps: string[];
    blocked: boolean;
    createdAt: string;
    lastLoginAt: string;
  } | null;
};

export type AuditUsersOverview = {
  users: NonNullable<AuditAccess["user"]>[];
  blockedClients: Array<{ ip: string; reason: string; attempts: number; blockedAt: string; userAgent?: string }>;
  failedAttempts: Array<{ ip: string; attempts: number; lastAttemptAt: string; userAgent?: string }>;
};

export type CreatedAuditUser = {
  user: NonNullable<AuditAccess["user"]>;
  token: string;
};

export async function fetchAuditAccess(token = "") {
  const headers: HeadersInit = token ? { "x-admin-token": token } : {};
  const response = await fetch("/api/audit/access", { headers });

  if (!response.ok) {
    return { allowed: false, authenticated: false, tokenRequired: true, clientIp: "unknown" } satisfies AuditAccess;
  }

  return (await response.json()) as AuditAccess;
}

export async function fetchAuditLogs(limit = 80, token = "") {
  const headers: HeadersInit = token ? { "x-admin-token": token } : {};
  const response = await fetch(`/api/audit/logs?limit=${limit}`, { headers });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    const error = new Error(payload.message || "Nao foi possivel carregar os logs locais.");
    error.name = String(response.status);
    throw error;
  }

  const data = (await response.json()) as AuditLogResponse;
  return data.entries;
}

export async function fetchAuditUsers(token = "") {
  const headers: HeadersInit = token ? { "x-admin-token": token } : {};
  const response = await fetch("/api/audit/users", { headers });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    const error = new Error(payload.message || "Nao foi possivel carregar os perfis de auditoria.");
    error.name = String(response.status);
    throw error;
  }

  return (await response.json()) as AuditUsersOverview;
}

export async function createAuditUser(token: string, input: { name: string; role: string; allowedIps: string[] }) {
  const response = await fetch("/api/audit/users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": token
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    const error = new Error(payload.message || "Nao foi possivel criar o usuario de auditoria.");
    error.name = String(response.status);
    throw error;
  }

  return (await response.json()) as CreatedAuditUser;
}
