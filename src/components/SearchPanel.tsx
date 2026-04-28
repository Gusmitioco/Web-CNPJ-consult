import { FileSearch, LoaderCircle, ShieldCheck } from "lucide-react";
import { ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import { formatCnpj, isValidCnpj, onlyDigits } from "../utils/cnpj";
import { GlassPanel } from "./GlassPanel";

type SearchPanelProps = {
  initialCnpj: string;
  isLoading?: boolean;
  lastQuery: string;
  hasCompany?: boolean;
  queryError?: string;
  onSearch: (cnpj: string) => void | Promise<void>;
};

export function SearchPanel({
  initialCnpj,
  isLoading = false,
  lastQuery,
  hasCompany = false,
  queryError = "",
  onSearch
}: SearchPanelProps) {
  const [cnpj, setCnpj] = useState(initialCnpj);
  const [error, setError] = useState("");
  const lastSubmittedRef = useRef("");
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const digits = onlyDigits(cnpj);

    if (digits.length === 0) {
      setError("");
      lastSubmittedRef.current = "";
      return;
    }

    if (digits.length < 14) {
      setError("");
      return;
    }

    if (!isValidCnpj(cnpj)) {
      setError("CNPJ invalido. Confira os numeros digitados.");
      return;
    }

    if (isLoading || lastSubmittedRef.current === digits) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastSubmittedRef.current = digits;
      setError("");
      onSearchRef.current(cnpj);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [cnpj, isLoading]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isValidCnpj(cnpj)) {
      setError("Informe um CNPJ valido para consultar.");
      return;
    }

    setError("");
    lastSubmittedRef.current = onlyDigits(cnpj);
    onSearch(cnpj);
  }

  function updateCnpj(value: string) {
    setCnpj(formatCnpj(value));
    setError("");
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    updateCnpj(event.clipboardData.getData("text"));
  }

  return (
    <GlassPanel id="consulta" className={`grid gap-5 ${hasCompany ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]" : ""}`}>
      <form onSubmit={handleSubmit} className="min-w-0">
        <div className={`mb-5 flex gap-3 ${hasCompany ? "items-center" : "flex-col items-center text-center"}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#006465] text-white">
            <FileSearch className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.09em] text-[#0f928c]">
              Consulta cadastral
            </p>
            <h1 className={`${hasCompany ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} font-black leading-tight text-[#484848]`}>
              {hasCompany ? "Painel de dados do cliente" : "Informe um CNPJ para iniciar"}
            </h1>
          </div>
        </div>

        <label htmlFor="cnpj" className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-[#006465]">
          CNPJ
        </label>
        <div className="relative">
          <input
            id="cnpj"
            value={cnpj}
            onChange={(event) => updateCnpj(event.target.value)}
            onPaste={handlePaste}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            className="h-12 w-full min-w-0 rounded-xl border border-[#00c9d2]/22 bg-white/58 px-4 pr-12 text-base font-black text-[#484848] outline-none transition placeholder:text-[#484848]/42 focus:border-[#0f928c] focus:ring-4 focus:ring-[#00c9d2]/20"
          />
          {isLoading ? (
            <LoaderCircle className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#006465]" aria-hidden="true" />
          ) : null}
        </div>
        <p className="mt-2 min-h-5 text-sm font-bold text-[#006465]">{error || queryError}</p>
      </form>

      {hasCompany ? <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {[
          ["Status RF", hasCompany ? "Dados carregados" : "Aguardando consulta", "text-[#0f928c]"],
          ["Inscricao estadual", "Etapa fiscal posterior", "text-[#484848]"],
          ["Ultima consulta", hasCompany ? lastQuery : "Nenhuma consulta", "text-[#484848]"]
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-white/38 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_26px_rgba(0,100,101,0.1)] backdrop-blur-md">
            <span className="block text-[0.69rem] font-black uppercase tracking-[0.08em] text-[#006465]">
              {label}
            </span>
            <strong className={`mt-1 flex items-center gap-2 text-sm font-black ${color}`}>
              {label === "Status RF" && <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {value}
            </strong>
          </div>
        ))}
      </div> : null}
    </GlassPanel>
  );
}
