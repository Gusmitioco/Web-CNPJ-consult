import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAuditLogs, type AuditLogEntry } from "../services/auditApi";
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
    success: "Concluida",
    error: "Falha"
  };

  return labels[value] || value;
}

function matchesFilter(entry: AuditLogEntry, filter: string) {
  const text = [
    entry.cnpj,
    formatCnpj(entry.cnpj),
    entry.queriedAtLocal,
    entry.route,
    entry.result,
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

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const visibleLogs = useMemo(
    () => logs.filter((entry) => matchesFilter(entry, filter)).slice(0, 12),
    [logs, filter]
  );

  async function loadLogs() {
    setIsLoading(true);
    setError("");

    try {
      setLogs(await fetchAuditLogs());
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Nao foi possivel carregar os logs locais.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

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
          onClick={loadLogs}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#006465]" aria-hidden="true" />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar por CNPJ, IP, fonte ou resultado"
          className="h-11 w-full rounded-xl border border-[#00c9d2]/24 bg-white/50 px-10 text-sm font-bold text-[#484848] outline-none transition placeholder:text-[#484848]/42 focus:border-[#0f928c] focus:ring-4 focus:ring-[#00c9d2]/18"
        />
      </div>

      {error ? <p className="text-sm font-bold text-[#006465]">{error}</p> : null}

      <div className="grid gap-2">
        {visibleLogs.length ? (
          visibleLogs.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-3 rounded-xl border border-white/38 bg-white/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md lg:grid-cols-[1.1fr_0.8fr_0.9fr_1.3fr]"
            >
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">CNPJ</span>
                <strong className="mt-1 block text-sm text-[#484848]">{formatCnpj(entry.cnpj)}</strong>
              </div>
              <div>
                <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#006465]">Horario</span>
                <strong className="mt-1 block text-sm text-[#484848]">{entry.queriedAtLocal}</strong>
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
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-white/38 bg-white/24 p-4 text-sm font-bold text-[#484848]/70">
            {isLoading ? "Carregando logs locais..." : "Nenhum log encontrado."}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

