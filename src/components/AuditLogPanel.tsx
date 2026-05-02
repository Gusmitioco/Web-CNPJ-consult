import { CalendarDays, ClipboardList, FileJson, FileSpreadsheet, KeyRound, LockKeyhole, RefreshCw, Search, ShieldAlert, Unlock, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  createAuditUser,
  fetchAuditLogs,
  fetchAuditUsers,
  unblockAuditClient,
  type AuditLogEntry,
  type AuditUsersOverview
} from "../services/auditApi";
import { formatCnpj, onlyDigits } from "../utils/cnpj";
import { GlassPanel } from "./GlassPanel";

function sourceLabel(entry: AuditLogEntry) {
  const labels = [
    entry.sources?.brasilApi ? `BrasilAPI ${entry.sources.brasilApi.ok ? "ok" : "falha"}` : "",
    entry.sources?.sefazBa ? `SEFAZ-BA ${entry.sources.sefazBa.ok ? "ok" : "falha"}` : ""
  ].filter(Boolean);

  return labels.length ? labels.join(" / ") : "Sem fontes";
}

function resultLabel(value: string) {
  const labels: Record<string, string> = {
    "success-full": "Completa",
    "success-partial": "Parcial",
    "success-cache": "Cache",
    "success-refresh": "Atualizacao manual",
    success: "Concluida",
    error: "Falha"
  };

  return labels[value] || value;
}

function routeLabel(value: string) {
  const labels: Record<string, string> = {
    company: "Consulta unificada",
    cnpj: "BrasilAPI",
    "sefaz-ba": "SEFAZ-BA"
  };

  return labels[value] || value;
}

function formatDateTime(value?: string) {
  if (!value) return "Nunca";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function roleLabel(value: string) {
  return value === "master" ? "Master" : "Visualizador";
}

function isOnOrAfterDay(value: string, day: string) {
  if (!day) return true;

  const entryDate = new Date(value);
  const startDate = new Date(`${day}T00:00:00`);

  return !Number.isNaN(entryDate.getTime()) && entryDate >= startDate;
}

function isOnOrBeforeDay(value: string, day: string) {
  if (!day) return true;

  const entryDate = new Date(value);
  const endDate = new Date(`${day}T23:59:59.999`);

  return !Number.isNaN(entryDate.getTime()) && entryDate <= endDate;
}

type AuditFilters = {
  text: string;
  cnpj: string;
  ip: string;
  route: string;
  result: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: AuditFilters = {
  text: "",
  cnpj: "",
  ip: "",
  route: "",
  result: "",
  dateFrom: "",
  dateTo: ""
};

function matchesText(entry: AuditLogEntry, filter: string) {
  if (!filter.trim()) return true;

  const text = [
    entry.cnpj,
    formatCnpj(entry.cnpj),
    entry.queriedAtLocal,
    entry.route,
    routeLabel(entry.route),
    entry.result,
    resultLabel(entry.result),
    sourceLabel(entry),
    entry.client?.ip,
    entry.client?.host,
    entry.client?.userAgent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(filter.toLowerCase()) || onlyDigits(entry.cnpj).includes(onlyDigits(filter));
}

function matchesFilters(entry: AuditLogEntry, filters: AuditFilters) {
  const cnpjFilter = onlyDigits(filters.cnpj);
  const entryCnpj = onlyDigits(entry.cnpj);
  const ip = entry.client?.ip || "";

  return (
    matchesText(entry, filters.text) &&
    (!cnpjFilter || entryCnpj.includes(cnpjFilter)) &&
    (!filters.ip.trim() || ip.toLowerCase().includes(filters.ip.trim().toLowerCase())) &&
    (!filters.route || entry.route === filters.route) &&
    (!filters.result || entry.result === filters.result) &&
    isOnOrAfterDay(entry.queriedAt, filters.dateFrom) &&
    isOnOrBeforeDay(entry.queriedAt, filters.dateTo)
  );
}

function escapeCsv(value: string | number | boolean | undefined | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function logsToCsv(entries: AuditLogEntry[]) {
  const rows = [
    ["data_iso", "data_local", "cnpj", "ip", "rota", "resultado", "fontes", "host", "origem", "user_agent"],
    ...entries.map((entry) => [
      entry.queriedAt,
      entry.queriedAtLocal,
      formatCnpj(entry.cnpj),
      entry.client?.ip || "",
      routeLabel(entry.route),
      resultLabel(entry.result),
      sourceLabel(entry),
      entry.client?.host || "",
      entry.client?.origin || "",
      entry.client?.userAgent || ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
}

type AuditLogPanelProps = {
  tokenRequired?: boolean;
  onBlocked?: () => void;
};

const auditTokenKey = "consulta-cnpj-sefaz:audit-token";

export function AuditLogPanel({ tokenRequired = false, onBlocked }: AuditLogPanelProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [selectedLogId, setSelectedLogId] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(auditTokenKey) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(!tokenRequired);
  const [isMaster, setIsMaster] = useState(false);
  const [usersOverview, setUsersOverview] = useState<AuditUsersOverview | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");
  const [newUserIps, setNewUserIps] = useState("*");
  const [generatedToken, setGeneratedToken] = useState("");
  const [unlockingIp, setUnlockingIp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredLogs = useMemo(
    () => logs.filter((entry) => matchesFilters(entry, filters)),
    [logs, filters]
  );
  const visibleLogs = useMemo(() => filteredLogs.slice(0, 40), [filteredLogs]);
  const selectedLog = useMemo(
    () => logs.find((entry) => entry.id === selectedLogId) || null,
    [logs, selectedLogId]
  );
  const routeOptions = useMemo(() => [...new Set(logs.map((entry) => entry.route).filter(Boolean))], [logs]);
  const resultOptions = useMemo(() => [...new Set(logs.map((entry) => entry.result).filter(Boolean))], [logs]);

  function updateFilter<Key extends keyof AuditFilters>(key: Key, value: AuditFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSelectedLogId("");
  }

  async function loadLogs(currentToken = token) {
    if (tokenRequired && !currentToken) {
      setIsAuthenticated(false);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      setLogs(await fetchAuditLogs(80, currentToken));
      setIsAuthenticated(true);
      const overview = await fetchAuditUsers(currentToken).catch(() => null);
      setUsersOverview(overview);
      setIsMaster(Boolean(overview));
    } catch (currentError) {
      if (currentError instanceof Error && currentError.name === "401") {
        sessionStorage.removeItem(auditTokenKey);
        setToken("");
        setIsAuthenticated(false);
      }

      if (currentError instanceof Error && currentError.name === "403") {
        sessionStorage.removeItem(auditTokenKey);
        setToken("");
        setLogs([]);
        setIsAuthenticated(false);
        setIsMaster(false);
        setUsersOverview(null);
        onBlocked?.();
      }

      setError(currentError instanceof Error ? currentError.message : "Nao foi possivel carregar os logs locais.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();

    if (!nextToken) {
      setError("Informe o token de auditoria.");
      return;
    }

    sessionStorage.setItem(auditTokenKey, nextToken);
    setToken(nextToken);
    setTokenInput("");
    loadLogs(nextToken);
  }

  function clearToken() {
    sessionStorage.removeItem(auditTokenKey);
    setToken("");
    setLogs([]);
    setUsersOverview(null);
    setIsMaster(false);
    setIsAuthenticated(false);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGeneratedToken("");

    try {
      const created = await createAuditUser(token, {
        name: newUserName,
        role: newUserRole,
        allowedIps: newUserIps.split(",").map((item) => item.trim()).filter(Boolean)
      });
      setGeneratedToken(created.token);
      setNewUserName("");
      setNewUserRole("viewer");
      setNewUserIps("*");
      setUsersOverview(await fetchAuditUsers(token));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Nao foi possivel criar o usuario de auditoria.");
    }
  }

  async function handleUnblockClient(ip: string) {
    setError("");
    setUnlockingIp(ip);

    try {
      await unblockAuditClient(token, ip);
      setUsersOverview(await fetchAuditUsers(token));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Nao foi possivel desbloquear o cliente.");
    } finally {
      setUnlockingIp("");
    }
  }

  function handleExportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "consulta-cnpj-sefaz:audit",
      total: filteredLogs.length,
      filters,
      entries: filteredLogs
    };

    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `auditoria-cnpj-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json;charset=utf-8"
    );
  }

  function handleExportCsv() {
    downloadTextFile(
      logsToCsv(filteredLogs),
      `auditoria-cnpj-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  useEffect(() => {
    if (!tokenRequired || token) {
      loadLogs(token);
    }
  }, [tokenRequired]);

  return (
    <GlassPanel className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Auditoria local
          </p>
          <h2 className="text-base font-black text-[#484848]">Logs de CNPJ pesquisados</h2>
        </div>
        <button
          type="button"
          onClick={() => loadLogs()}
          disabled={tokenRequired && !isAuthenticated}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {tokenRequired && !isAuthenticated ? (
        <form onSubmit={handleTokenSubmit} className="grid gap-3 rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md sm:grid-cols-[1fr_auto]">
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#006465]">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Token de admin
            </span>
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              autoComplete="off"
              placeholder="Informe o token para visualizar os logs"
              className="h-11 w-full rounded-xl border border-[#00c9d2]/24 bg-white/50 px-4 text-sm font-bold text-[#484848] outline-none transition placeholder:text-[#484848]/42 focus:border-[#0f928c] focus:ring-4 focus:ring-[#00c9d2]/18"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center self-end rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
          >
            Acessar
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm font-bold text-[#006465]">{error}</p> : null}

      {tokenRequired && isAuthenticated ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearToken}
            className="text-xs font-black uppercase tracking-[0.08em] text-[#006465] transition hover:text-[#0f928c]"
          >
            Sair da auditoria
          </button>
        </div>
      ) : null}

      {!tokenRequired || isAuthenticated ? (
        <>
      {isMaster && usersOverview ? (
        <div className="grid gap-3 rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md">
          <div>
            <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Perfil master</span>
            <strong className="mt-1 block text-sm text-[#484848]">Usuarios, tokens e bloqueios de auditoria</strong>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/34 bg-white/20 p-3">
              <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">
                <Users className="h-4 w-4" aria-hidden="true" />
                Tokens cadastrados
              </span>
              <div className="mt-2 grid gap-2">
                {usersOverview.users.map((user) => (
                  <div key={user.id} className="rounded-lg border border-white/30 bg-white/18 p-3 text-sm font-bold text-[#484848]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{user.name}</strong>
                      <span className="rounded-full bg-[#00c9d2]/13 px-2 py-1 text-[0.68rem] font-black uppercase text-[#006465]">
                        {roleLabel(user.role)}
                      </span>
                    </div>
                    <span className="mt-2 flex items-center gap-2 break-all text-xs text-[#484848]/70">
                      <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#006465]" aria-hidden="true" />
                      {user.tokenPreview}
                    </span>
                    <span className="mt-1 block text-xs text-[#484848]/70">
                      IPs: {user.allowedIps.join(", ") || "Padrao do ambiente"} - Ultimo acesso: {formatDateTime(user.lastLoginAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/34 bg-white/20 p-3">
              <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Bloqueios ativos
              </span>
              <div className="mt-2 grid gap-2">
                {usersOverview.blockedClients.length ? (
                  usersOverview.blockedClients.map((client) => (
                    <div key={`${client.ip}-${client.blockedAt}`} className="grid gap-2 rounded-lg border border-white/30 bg-white/18 p-3 text-sm font-bold text-[#484848]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <strong className="block break-all">{client.ip}</strong>
                          <span className="mt-1 block text-xs text-[#484848]/70">
                            {client.attempts} tentativas - Bloqueado em {formatDateTime(client.blockedAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnblockClient(client.ip)}
                          disabled={unlockingIp === client.ip}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-3 text-xs font-black uppercase tracking-[0.06em] text-[#006465] transition hover:bg-[#beee3b]/28 disabled:opacity-55"
                        >
                          <Unlock className="h-4 w-4" aria-hidden="true" />
                          {unlockingIp === client.ip ? "Liberando" : "Liberar"}
                        </button>
                      </div>
                      {client.userAgent ? (
                        <span className="block break-words text-xs text-[#484848]/62">{client.userAgent}</span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-bold text-[#484848]/66">Nenhum bloqueio ativo.</div>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/34 bg-white/20 p-3">
            <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Tentativas recentes negadas</span>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {usersOverview.failedAttempts.length ? (
                usersOverview.failedAttempts.map((attempt) => (
                  <div key={`${attempt.ip}-${attempt.lastAttemptAt}`} className="rounded-lg border border-white/30 bg-white/18 p-3 text-sm font-bold text-[#484848]">
                    <strong className="block break-all">{attempt.ip}</strong>
                    <span className="mt-1 block text-xs text-[#484848]/70">
                      {attempt.attempts} tentativa(s) - Ultima em {formatDateTime(attempt.lastAttemptAt)}
                    </span>
                    {attempt.userAgent ? (
                      <span className="mt-1 block break-words text-xs text-[#484848]/62">{attempt.userAgent}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm font-bold text-[#484848]/66">Nenhuma tentativa negada registrada.</div>
              )}
            </div>
          </div>
          <form onSubmit={handleCreateUser} className="grid gap-3 rounded-xl border border-white/34 bg-white/20 p-3 lg:grid-cols-[1fr_160px_1fr_auto]">
            <input
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              placeholder="Nome do usuario"
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none placeholder:text-[#484848]/42 focus:border-[#0f928c]"
            />
            <select
              value={newUserRole}
              onChange={(event) => setNewUserRole(event.target.value)}
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none focus:border-[#0f928c]"
            >
              <option value="viewer">viewer</option>
              <option value="master">master</option>
            </select>
            <input
              value={newUserIps}
              onChange={(event) => setNewUserIps(event.target.value)}
              placeholder="IPs liberados, ou *"
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none placeholder:text-[#484848]/42 focus:border-[#0f928c]"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] transition hover:bg-[#beee3b]/28"
            >
              Gerar
            </button>
          </form>
          {generatedToken ? (
            <div className="rounded-xl border border-[#0f928c]/24 bg-[#00c9d2]/10 p-3">
              <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Token gerado</span>
              <strong className="mt-1 block break-all text-sm text-[#484848]">{generatedToken}</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">
              <Search className="h-4 w-4" aria-hidden="true" />
              Filtros
            </span>
            <strong className="mt-1 block text-sm text-[#484848]">
              {filteredLogs.length} de {logs.length} registros
            </strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!filteredLogs.length}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-3 text-xs font-black uppercase tracking-[0.06em] text-[#006465] transition hover:bg-[#beee3b]/28 disabled:opacity-55"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!filteredLogs.length}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-3 text-xs font-black uppercase tracking-[0.06em] text-[#006465] transition hover:bg-[#beee3b]/28 disabled:opacity-55"
            >
              <FileJson className="h-4 w-4" aria-hidden="true" />
              JSON
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/42 bg-white/42 px-3 text-xs font-black uppercase tracking-[0.06em] text-[#006465] transition hover:bg-[#beee3b]/28"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          <label className="grid gap-1">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Busca geral</span>
            <input
              value={filters.text}
              onChange={(event) => updateFilter("text", event.target.value)}
              placeholder="Fonte, resultado, host ou navegador"
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none placeholder:text-[#484848]/42 focus:border-[#0f928c]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">CNPJ</span>
            <input
              value={filters.cnpj}
              onChange={(event) => updateFilter("cnpj", formatCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none placeholder:text-[#484848]/42 focus:border-[#0f928c]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">IP</span>
            <input
              value={filters.ip}
              onChange={(event) => updateFilter("ip", event.target.value)}
              placeholder="192.168.0.10"
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none placeholder:text-[#484848]/42 focus:border-[#0f928c]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Rota</span>
            <select
              value={filters.route}
              onChange={(event) => updateFilter("route", event.target.value)}
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none focus:border-[#0f928c]"
            >
              <option value="">Todas</option>
              {routeOptions.map((route) => (
                <option key={route} value={route}>
                  {routeLabel(route)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Resultado</span>
            <select
              value={filters.result}
              onChange={(event) => updateFilter("result", event.target.value)}
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none focus:border-[#0f928c]"
            >
              <option value="">Todos</option>
              {resultOptions.map((result) => (
                <option key={result} value={result}>
                  {resultLabel(result)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <label className="grid gap-1">
            <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Data inicial
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none focus:border-[#0f928c]"
            />
          </label>
          <label className="grid gap-1">
            <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Data final
            </span>
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="h-10 rounded-xl border border-[#00c9d2]/24 bg-white/50 px-3 text-sm font-bold text-[#484848] outline-none focus:border-[#0f928c]"
            />
          </label>
        </div>
      </div>

      {selectedLog ? (
        <div className="grid gap-3 rounded-xl border border-[#0f928c]/24 bg-[#00c9d2]/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Detalhe do log</span>
              <strong className="mt-1 block text-sm text-[#484848]">{formatCnpj(selectedLog.cnpj)} - {resultLabel(selectedLog.result)}</strong>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLogId("")}
              className="text-xs font-black uppercase tracking-[0.08em] text-[#006465] transition hover:text-[#0f928c]"
            >
              Fechar
            </button>
          </div>
          <div className="grid gap-2 text-sm font-bold text-[#484848] sm:grid-cols-2 lg:grid-cols-4">
            <span>Horario: {formatDateTime(selectedLog.queriedAt)}</span>
            <span>IP: {selectedLog.client?.ip || "Nao informado"}</span>
            <span>Rota: {routeLabel(selectedLog.route)}</span>
            <span>Fontes: {sourceLabel(selectedLog)}</span>
          </div>
          <div className="grid gap-2 text-xs font-bold text-[#484848]/70">
            <span className="break-words">Host: {selectedLog.client?.host || "Nao informado"}</span>
            <span className="break-words">Origem: {selectedLog.client?.origin || "Nao informada"}</span>
            <span className="break-words">Navegador: {selectedLog.client?.userAgent || "Nao informado"}</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        {visibleLogs.length ? (
          visibleLogs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedLogId(entry.id)}
              className="grid gap-3 rounded-xl border border-white/38 bg-white/24 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md transition hover:bg-white/38 lg:grid-cols-[1.1fr_0.8fr_0.9fr_1.3fr]"
            >
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">CNPJ</span>
                <strong className="mt-1 block text-sm text-[#484848]">{formatCnpj(entry.cnpj)}</strong>
              </div>
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Horario</span>
                <strong className="mt-1 block text-sm text-[#484848]">{entry.queriedAtLocal || formatDateTime(entry.queriedAt)}</strong>
              </div>
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Cliente</span>
                <strong className="mt-1 block break-words text-sm text-[#484848]">{entry.client?.ip || "Nao informado"}</strong>
              </div>
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Resultado</span>
                <strong className="mt-1 block text-sm text-[#484848]">{resultLabel(entry.result)}</strong>
                <span className="mt-1 block break-words text-xs font-bold text-[#484848]/66">{sourceLabel(entry)}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-white/38 bg-white/24 p-4 text-sm font-bold text-[#484848]/70">
            {isLoading ? "Carregando logs locais..." : "Nenhum log encontrado."}
          </div>
        )}
      </div>
        </>
      ) : null}
    </GlassPanel>
  );
}
