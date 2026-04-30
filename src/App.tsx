import { ArrowLeft, CircleCheck, ClipboardList, DatabaseZap, Download, FileJson, Landmark, Layers3, Moon, RefreshCw, Sparkles, Sun, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuditLogPanel } from "./components/AuditLogPanel";
import { CopyButton } from "./components/CopyButton";
import { FieldItem } from "./components/FieldItem";
import { GlassPanel } from "./components/GlassPanel";
import { MobileNav } from "./components/MobileNav";
import { SearchPanel } from "./components/SearchPanel";
import { SectionCard } from "./components/SectionCard";
import { navItems } from "./components/Sidebar";
import { fetchAuditAccess } from "./services/auditApi";
import { fetchCompanyByCnpj } from "./services/cnpjApi";
import { fetchConsultationHistory, saveConsultationHistory, type ConsultationHistoryItem } from "./services/historyApi";
import type { Company, Field } from "./types";
import { exportCompanyJson, exportCompanyPdf } from "./utils/exportCompany";

function fieldsToText(title: string, fields: Field[]) {
  return [title, ...fields.map((field) => `${field.label}: ${field.value}`)].join("\n");
}

function companyText(company: Company) {
  return [
    fieldsToText("IDENTIFICACAO", [
      { label: "Razao social", value: company.legalName },
      { label: "Nome fantasia", value: company.tradeName },
      { label: "CNPJ", value: company.cnpj },
      { label: "Situacao", value: company.status },
      { label: "Abertura", value: company.openingDate },
      { label: "Natureza juridica", value: company.legalNature },
      { label: "Porte", value: company.size },
      { label: "Capital social", value: company.capital }
    ]),
    fieldsToText("ENDERECO", company.address),
    fieldsToText("FISCAL", company.fiscal),
    ["ATIVIDADES", `Principal: ${company.mainCnae}`, ...company.secondaryCnaes].join("\n"),
    ["QSA", ...company.partners.map((partner) => `${partner.name}: ${partner.role} desde ${partner.since}`)].join("\n"),
    ["HISTORICO", ...company.history.map((item) => `${item.source}: ${item.status} em ${item.date}`)].join("\n")
  ].join("\n\n");
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function findField(fields: Field[], label: string) {
  return fields.find((field) => field.label === label)?.value || "Nao informado";
}

function findFirstField(fields: Field[], labels: string[]) {
  for (const label of labels) {
    const value = findField(fields, label);
    if (value !== "Nao informado") return value;
  }

  return "Nao informado";
}

function knownFieldValue(fields: Field[], labels: string[]) {
  const value = findFirstField(fields, labels);
  return value === "Nao informado" ? "" : value;
}

function App() {
  const [company, setCompany] = useState<Company | null>(null);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [toast, setToast] = useState("");
  const [activeSection, setActiveSection] = useState("consulta");
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [auditTokenRequired, setAuditTokenRequired] = useState(true);
  const [currentPage, setCurrentPage] = useState<"main" | "audit">("main");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const activeSectionRef = useRef(activeSection);
  const navigationLockRef = useRef<number | null>(null);
  const identification = useMemo(
    () =>
      company
        ? [
            { label: "Razao social", value: company.legalName },
            { label: "Nome fantasia", value: company.tradeName },
            { label: "CNPJ", value: company.cnpj },
            { label: "Situacao cadastral", value: company.status },
            { label: "Abertura", value: company.openingDate },
            { label: "Natureza juridica", value: company.legalNature },
            { label: "Porte", value: company.size },
            { label: "Capital social", value: company.capital }
          ]
        : [],
    [company]
  );
  const fiscalSummary = useMemo(() => {
    if (!company) {
      return {
        status: "Aguardando consulta",
        detail: "Os dados fiscais serao avaliados apos informar um CNPJ.",
        source: "Sem fonte consultada"
      };
    }

    const ie = findFirstField(company.fiscal, ["Inscricao estadual", "Inscricao estadual SEFAZ-BA"]);
    const status = findFirstField(company.fiscal, ["Situacao IE SEFAZ-BA", "Situacao cadastral RF"]);
    const regime = findFirstField(company.fiscal, ["Regime SEFAZ-BA", "Simples Nacional"]);

    return {
      status,
      detail: `IE: ${ie} - Regime: ${regime}`,
      source: findField(company.fiscal, "Fonte fiscal")
    };
  }, [company]);

  function notify(message = "Informacoes copiadas") {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function loadHistory() {
    try {
      setHistory(await fetchConsultationHistory());
    } catch {
      setHistory([]);
    }
  }

  async function handleSearch(cnpj: string) {
    setIsLoading(true);
    setQueryError("");

    try {
      const result = await fetchCompanyByCnpj(cnpj);
      setCompany(result);
      setLastQuery(nowLabel());
      setHistory(saveConsultationHistory(result));
      notify("Consulta carregada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel consultar o CNPJ.";
      setQueryError(message);
      notify("Consulta nao concluida");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function handleExportJson() {
    if (!company) return;

    exportCompanyJson(company);
    notify("JSON exportado");
  }

  function handleExportPdf() {
    if (!company) return;

    const opened = exportCompanyPdf(company);
    notify(opened ? "Relatorio PDF aberto" : "Popup bloqueado pelo navegador");
  }

  function handleAuditBlocked() {
    setCanViewAudit(false);
    setCompany(null);
    setQueryError("");
    setCurrentPage("main");
    notify("Acesso aos logs bloqueado");
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    fetchAuditAccess()
      .then((access) => {
        setCanViewAudit(access.allowed);
        setAuditTokenRequired(access.tokenRequired);
      })
      .catch(() => {
        setCanViewAudit(false);
        setAuditTokenRequired(true);
      });
  }, []);

  useEffect(() => {
    if (!canViewAudit && currentPage === "audit") {
      setCurrentPage("main");
    }
  }, [canViewAudit, currentPage]);

  function handleNavigate(href: string) {
    const id = href.replace("#", "");
    const section = document.getElementById(id);

    if (!section) return;

    activeSectionRef.current = id;
    setActiveSection(id);

    if (navigationLockRef.current) {
      window.clearTimeout(navigationLockRef.current);
    }

    const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - 132);
    window.scrollTo({ top, behavior: "smooth" });
    navigationLockRef.current = window.setTimeout(() => {
      activeSectionRef.current = id;
      setActiveSection(id);
      navigationLockRef.current = null;
    }, 850);
  }

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (!company) return;

    let frame = 0;
    const ids = navItems.map((item) => item.href.slice(1));

    function updateActiveSection() {
      if (navigationLockRef.current) return;

      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (window.scrollY < 170) {
          activeSectionRef.current = "consulta";
          setActiveSection("consulta");
          return;
        }

        const anchor = 160;
        const current =
          ids
            .map((id) => {
              const element = document.getElementById(id);
              return element ? { id, top: element.getBoundingClientRect().top } : null;
            })
            .filter((item): item is { id: string; top: number } => item !== null && item.top <= anchor)
            .sort((first, second) => second.top - first.top)[0]?.id ?? "consulta";

        if (current !== activeSectionRef.current) {
          activeSectionRef.current = current;
          setActiveSection(current);
        }
      });
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => {
      if (navigationLockRef.current) {
        window.clearTimeout(navigationLockRef.current);
      }
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveSection);
    };
  }, [company]);

  return (
    <div className="min-h-screen text-[#484848]">
      {currentPage !== "audit" ? (
        <div className="fixed right-4 top-4 z-30 grid gap-2 sm:right-6 sm:top-6">
          {canViewAudit ? (
            <button
              type="button"
              onClick={() => setCurrentPage("audit")}
              aria-label="Abrir logs de auditoria"
              title="Logs"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/42 bg-white/42 text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.1)] backdrop-blur-md transition hover:bg-[#beee3b]/28"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar modo dia" : "Ativar modo noite"}
            title={theme === "dark" ? "Modo dia" : "Modo noite"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/42 bg-white/42 text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.1)] backdrop-blur-md transition hover:bg-[#beee3b]/28"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      ) : null}

      {currentPage === "audit" && canViewAudit ? (
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-[1180px] gap-5">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Auditoria local
                </p>
                <h1 className="text-3xl font-black leading-tight text-[#484848] sm:text-4xl">
                  Logs de consultas
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage("main")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar
              </button>
            </header>
            <AuditLogPanel tokenRequired={auditTokenRequired} onBlocked={handleAuditBlocked} />
          </div>
        </main>
      ) : (
        <>
      {company ? <MobileNav activeSection={activeSection} onNavigate={handleNavigate} /> : null}

        <main className={`min-w-0 px-4 sm:px-6 lg:px-8 ${company ? "py-5" : "grid min-h-screen place-items-center py-8"}`}>
          <div className={`mx-auto grid w-full gap-5 ${company ? "max-w-[1500px]" : "max-w-[840px]"}`}>
            {company ? (
            <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Prototipo visual
                </p>
                <h1 className="max-w-3xl text-3xl font-black leading-[1.05] text-[#484848] sm:text-4xl">
                  Consulta fiscal de CNPJ
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {company ? (
                  <>
                    <CopyButton text={companyText(company)} label="Copiar tudo" onCopied={() => notify()} />
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
                    >
                      <FileJson className="h-4 w-4" aria-hidden="true" />
                      JSON
                    </button>
                  </>
                ) : null}
              </div>
            </header>
            ) : null}

            <SearchPanel
              initialCnpj={company?.cnpj ?? ""}
              hasCompany={Boolean(company)}
              isLoading={isLoading}
              lastQuery={lastQuery}
              queryError={queryError}
              companyStatus={company?.status ?? ""}
              stateRegistration={company ? knownFieldValue(company.fiscal, ["Inscricao estadual", "Inscricao estadual SEFAZ-BA"]) : ""}
              onSearch={handleSearch}
            />

            {!company ? (
              <>
                <p className="mx-auto max-w-xl text-center text-sm font-semibold leading-relaxed text-[#484848]/68">
                  Consulte dados publicos de cadastro, endereco, atividades economicas e socios por CNPJ.
                </p>
                {history.length ? (
                  <GlassPanel className="mx-auto grid w-full max-w-xl gap-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
                          Historico
                        </p>
                        <h2 className="text-base font-black">Ultimos CNPJs</h2>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      {history.slice(0, 2).map((item) => (
                        <button
                          key={`${item.cnpj}-${item.queriedAt}`}
                          type="button"
                          onClick={() => handleSearch(item.cnpj)}
                          className="rounded-xl border border-white/38 bg-white/24 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md transition hover:bg-white/38"
                        >
                          <strong className="block text-sm text-[#484848]">{item.legalName}</strong>
                          <span className="mt-1 block text-xs font-bold text-[#006465]">
                            {item.cnpj} {item.uf ? `- ${item.uf}` : ""} - {formatHistoryDate(item.queriedAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </GlassPanel>
                ) : null}
                {canViewAudit ? (
                  <GlassPanel className="mx-auto flex w-full max-w-xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
                        Auditoria local
                      </p>
                      <strong className="text-sm text-[#484848]">Visualizar logs de consultas</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage("audit")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
                    >
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      Abrir logs
                    </button>
                  </GlassPanel>
                ) : null}
              </>
            ) : (
              <>
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <SectionCard
                eyebrow="Receita Federal"
                title="Identificacao cadastral"
                copyText={fieldsToText("IDENTIFICACAO", identification)}
                id="cadastro"
                className="xl:col-span-1"
                onCopied={() => notify()}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {identification.map((field) => (
                    <FieldItem key={field.label} {...field} onCopied={() => notify()} />
                  ))}
                </div>
              </SectionCard>

              <GlassPanel className="grid content-start gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[0.7rem] font-black uppercase tracking-[0.09em] text-[#0f928c]">
                      Saude da consulta
                    </p>
                    <h2 className="text-base font-black">Fontes da consulta</h2>
                  </div>
                  <RefreshCw className="h-5 w-5 text-[#0f928c]" aria-hidden="true" />
                </div>

                {(company.sources?.length ? company.sources : [
                  { name: "BrasilAPI", ok: true, status: "Concluida", message: "Cadastro publico consultado." },
                  { name: "SEFAZ-BA", ok: false, status: "Nao retornada", message: "Fonte fiscal sem retorno nesta consulta." }
                ]).map((source) => (
                  <div key={source.name} className="rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_22px_rgba(0,100,101,0.08)] backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="flex items-center gap-2 text-sm">
                          {source.ok ? (
                            <CircleCheck className="h-4 w-4 text-[#0f928c]" aria-hidden="true" />
                          ) : (
                            <TriangleAlert className="h-4 w-4 text-[#006465]" aria-hidden="true" />
                          )}
                          {source.name}
                        </strong>
                        <span className="mt-1 block text-sm font-semibold text-[#484848]/72">{source.message}</span>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        source.ok ? "bg-[#beee3b]/55 text-[#006465]" : "bg-[#00c9d2]/13 text-[#006465]"
                      }`}>
                        {source.status}
                      </span>
                    </div>
                  </div>
                ))}
              </GlassPanel>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <SectionCard
                eyebrow="Localizacao"
                title="Endereco e contato"
                copyText={fieldsToText("ENDERECO", company.address)}
                onCopied={() => notify()}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {company.address.map((field) => (
                    <FieldItem key={field.label} {...field} onCopied={() => notify()} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="CNAE"
                title="Atividades economicas"
                copyText={["ATIVIDADES", `Principal: ${company.mainCnae}`, ...company.secondaryCnaes].join("\n")}
                onCopied={() => notify()}
              >
                <div className="rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_22px_rgba(0,100,101,0.08)] backdrop-blur-md">
                  <span className="block text-[0.69rem] font-black uppercase tracking-[0.08em] text-[#006465]">
                    Principal
                  </span>
                  <strong className="mt-2 block break-words text-sm">{company.mainCnae}</strong>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {company.secondaryCnaes.map((cnae) => (
                    <span key={cnae} className="rounded-xl bg-[#00c9d2]/13 px-3 py-2 text-sm font-bold text-[#006465]">
                      {cnae}
                    </span>
                  ))}
                </div>
              </SectionCard>
            </section>

            <SectionCard
              eyebrow="SEFAZ / Sintegra"
              title="Situacao fiscal"
              copyText={fieldsToText("FISCAL", company.fiscal)}
              id="fiscal"
              onCopied={() => notify()}
            >
              <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-[#0f928c]/22 bg-[#00c9d2]/10 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f928c] text-white">
                      <Landmark className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <strong className="block">{fiscalSummary.status}</strong>
                      <span className="text-sm font-semibold text-[#484848]/72">{fiscalSummary.source}</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-[#484848]">
                    {fiscalSummary.detail}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {company.fiscal.map((field) => (
                    <FieldItem key={field.label} {...field} onCopied={() => notify()} />
                  ))}
                </div>
              </div>
            </SectionCard>

            <section className="grid gap-5 xl:grid-cols-2">
              <SectionCard
                eyebrow="QSA"
                title="Socios e administradores"
                copyText={["QSA", ...company.partners.map((partner) => `${partner.name}: ${partner.role} desde ${partner.since}`)].join("\n")}
                id="qsa"
                onCopied={() => notify()}
              >
                <div className="grid gap-3">
                  {company.partners.map((partner) => (
                    <div key={partner.name} className="rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_22px_rgba(0,100,101,0.08)] backdrop-blur-md">
                      <strong className="block text-sm">{partner.name}</strong>
                      <span className="mt-1 block text-sm font-semibold text-[#484848]/72">
                        {partner.role} desde {partner.since}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="Auditoria"
                title="Historico da consulta"
                copyText={["HISTORICO", ...company.history.map((item) => `${item.source}: ${item.status} em ${item.date}`)].join("\n")}
                id="historico"
                onCopied={() => notify()}
              >
                <div className="grid gap-3">
                  {company.history.map((item) => (
                    <div key={item.source} className="flex items-start gap-3 rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_22px_rgba(0,100,101,0.08)] backdrop-blur-md">
                      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00c9d2]/15 text-[#006465]">
                        <DatabaseZap className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <strong className="block text-sm">{item.source}</strong>
                        <span className="mt-1 block text-sm font-semibold text-[#484848]/72">
                          {item.status} em {item.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </section>

            <GlassPanel className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#006465] text-white">
                  <Layers3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <strong className="block">Proxima etapa</strong>
                  <span className="text-sm font-semibold text-[#484848]/72">
                    Conectar este visual a um backend ASP.NET Core para consultar APIs fiscais.
                  </span>
                </div>
              </div>
            </GlassPanel>
            {history.length ? (
              <GlassPanel className="mb-4 grid gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">Historico local</p>
                  <h2 className="text-base font-black">Consultas recentes</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {history.slice(0, 4).map((item) => (
                    <button
                      key={`${item.cnpj}-${item.queriedAt}`}
                      type="button"
                      onClick={() => handleSearch(item.cnpj)}
                      className="rounded-xl border border-white/38 bg-white/24 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.07)] backdrop-blur-md transition hover:bg-white/38"
                    >
                      <strong className="line-clamp-2 block text-sm text-[#484848]">{item.legalName}</strong>
                      <span className="mt-2 block text-xs font-bold text-[#006465]">
                        {item.cnpj} - {formatHistoryDate(item.queriedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </GlassPanel>
            ) : null}
              </>
            )}
          </div>
        </main>
        </>
      )}

      <div
        className={`fixed bottom-5 right-5 z-30 max-w-[calc(100vw-40px)] rounded-xl bg-[#484848] px-4 py-3 text-sm font-black text-white shadow-2xl transition ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}

export default App;
