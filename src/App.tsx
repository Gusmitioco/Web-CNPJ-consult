import { DatabaseZap, Download, FileJson, Landmark, Layers3, Moon, RefreshCw, Sparkles, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./components/CopyButton";
import { FieldItem } from "./components/FieldItem";
import { GlassPanel } from "./components/GlassPanel";
import { MobileNav } from "./components/MobileNav";
import { SearchPanel } from "./components/SearchPanel";
import { SectionCard } from "./components/SectionCard";
import { navItems } from "./components/Sidebar";
import { fetchCompanyByCnpj } from "./services/cnpjApi";
import { fetchConsultationHistory, type ConsultationHistoryItem } from "./services/historyApi";
import type { Company, Field } from "./types";

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

function App() {
  const [company, setCompany] = useState<Company | null>(null);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [toast, setToast] = useState("");
  const [activeSection, setActiveSection] = useState("consulta");
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
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
      await loadHistory();
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    loadHistory();
  }, []);

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
      {company ? <MobileNav activeSection={activeSection} onNavigate={handleNavigate} /> : null}

        <main className={`min-w-0 px-4 sm:px-6 lg:px-8 ${company ? "py-5" : "grid min-h-screen place-items-center py-8"}`}>
          <div className={`mx-auto grid w-full gap-5 ${company ? "max-w-[1500px]" : "max-w-[780px]"}`}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/42 bg-white/28 px-4 text-sm font-black text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-xl transition hover:bg-white/42"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                {theme === "dark" ? "Dia" : "Noite"}
              </button>
            </div>

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
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/42 bg-white/42 px-4 text-sm font-bold text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_10px_24px_rgba(0,100,101,0.08)] backdrop-blur-sm transition hover:bg-[#beee3b]/28"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      PDF
                    </button>
                    <button
                      type="button"
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
              onSearch={handleSearch}
            />

            {!company ? (
              <>
                <p className="mx-auto max-w-xl text-center text-sm font-semibold leading-relaxed text-[#484848]/68">
                  Consulte dados publicos de cadastro, endereco, atividades economicas e socios por CNPJ.
                </p>
                {history.length ? (
                  <GlassPanel className="mx-auto grid w-full max-w-2xl gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
                          Historico
                        </p>
                        <h2 className="text-base font-black">Ultimas consultas</h2>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      {history.slice(0, 5).map((item) => (
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
                    <h2 className="text-base font-black">Conectores planejados</h2>
                  </div>
                  <RefreshCw className="h-5 w-5 text-[#0f928c]" aria-hidden="true" />
                </div>

                {[
                  ["Receita Federal", "Cadastro basico e QSA", "Pronto para API"],
                  ["SEFAZ", "Inscricao estadual e habilitacoes", "Requer certificado"],
                  ["Sintegra", "Consulta estadual complementar", "Ideal via provedor fiscal"]
                ].map(([name, description, status]) => (
                  <div key={name} className="rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_22px_rgba(0,100,101,0.08)] backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block text-sm">{name}</strong>
                        <span className="mt-1 block text-sm font-semibold text-[#484848]/72">{description}</span>
                      </div>
                      <span className="rounded-full bg-[#beee3b]/55 px-3 py-1 text-xs font-black text-[#006465]">
                        {status}
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
                      <strong className="block">Contribuinte habilitado</strong>
                      <span className="text-sm font-semibold text-[#484848]/72">Apto para operacoes com ICMS</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-[#484848]">
                    Este bloco esta pronto para receber retorno de consulta SEFAZ ou Sintegra via backend.
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
