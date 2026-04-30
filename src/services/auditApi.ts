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
  clientIp: string;
};

export async function fetchAuditAccess() {
  const response = await fetch("/api/audit/access");

  if (!response.ok) {
    return { allowed: false, clientIp: "unknown" } satisfies AuditAccess;
  }

  return (await response.json()) as AuditAccess;
}

export async function fetchAuditLogs(limit = 80) {
  const response = await fetch(`/api/audit/logs?limit=${limit}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || "Nao foi possivel carregar os logs locais.");
  }

  const data = (await response.json()) as AuditLogResponse;
  return data.entries;
}
