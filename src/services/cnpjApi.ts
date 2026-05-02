import type { CacheStatus, Company, SourceStatus } from "../types";
import { hasSefazBaRegistration, mapSefazBaToCompany, mergeCompanyWithSefazBa, type SefazBaResponse } from "./sefazBaApi";
import { formatCnpj, onlyDigits } from "../utils/cnpj";

type BrasilApiCnae = {
  codigo?: number;
  descricao?: string;
};

type BrasilApiPartner = {
  nome_socio?: string;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
};

type BrasilApiCompany = {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  identificador_matriz_filial?: number;
  descricao_identificador_matriz_filial?: string;
  codigo_situacao_cadastral?: number;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  situacao_especial?: string;
  data_situacao_especial?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  descricao_porte?: string;
  capital_social?: number | string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnae[];
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio_ibge?: number;
  email?: string;
  ddd_telefone1?: string;
  ddd_telefone2?: string;
  ente_federativo_responsavel?: string;
  opcao_pelo_simples?: boolean | string | null;
  data_opcao_pelo_simples?: string;
  data_exclusao_do_simples?: string;
  opcao_pelo_mei?: boolean | string | null;
  data_opcao_pelo_mei?: string;
  data_exclusao_do_mei?: string;
  qsa?: BrasilApiPartner[];
};

type CompanyApiResponse = {
  cnpj: string;
  publicData: BrasilApiCompany | null;
  fiscalData: SefazBaResponse | null;
  cache?: {
    hit: boolean;
    cachedAt?: string;
    expiresAt?: string;
    ttlMs?: number;
  };
  refresh?: {
    requested: boolean;
    accepted: boolean;
    windowMs: number;
  };
  sources?: {
    brasilApi?: {
      ok: boolean;
      status: number;
      message?: string;
      fromCache?: boolean;
    };
    sefazBa?: {
      ok: boolean;
      configured?: boolean;
      status: number;
      message?: string;
      code?: string;
    };
  };
};

function formatDateTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sourceStatusLabel(source?: { ok?: boolean; configured?: boolean; code?: string; fromCache?: boolean }, cache?: CompanyApiResponse["cache"]) {
  if (cache?.hit) return "Cache local";
  if (source?.fromCache) return "Cache da fonte";
  if (source?.ok) return "Tempo real";
  if (source?.configured === false) return "Nao configurada";
  if (source?.code?.toLowerCase().includes("timeout")) return "Timeout";
  return "Falha parcial";
}

function mapSourceStatuses(sources?: CompanyApiResponse["sources"], cache?: CompanyApiResponse["cache"]): SourceStatus[] {
  if (!sources) return [];

  return [
    {
      name: "BrasilAPI",
      ok: Boolean(sources.brasilApi?.ok),
      status: sourceStatusLabel(sources.brasilApi, cache),
      message: sources.brasilApi?.message || "Sem retorno informado.",
      fromCache: Boolean(cache?.hit || sources.brasilApi?.fromCache)
    },
    {
      name: "SEFAZ-BA",
      ok: Boolean(sources.sefazBa?.ok),
      status: sourceStatusLabel(sources.sefazBa, cache),
      message: sources.sefazBa?.message || "Sem retorno informado.",
      configured: sources.sefazBa?.configured,
      code: sources.sefazBa?.code,
      fromCache: Boolean(cache?.hit)
    }
  ];
}

function mapCacheStatus(cache?: CompanyApiResponse["cache"]): CacheStatus {
  if (!cache) {
    return {
      hit: false,
      label: "Tempo real",
      detail: "Resposta obtida diretamente das fontes nesta consulta."
    };
  }

  if (cache.hit) {
    const expires = formatDateTime(cache.expiresAt);

    return {
      hit: true,
      label: "Cache local",
      detail: expires ? `Resposta reaproveitada do cache local. Expira em ${expires}.` : "Resposta reaproveitada do cache local.",
      cachedAt: cache.cachedAt,
      expiresAt: cache.expiresAt,
      ttlMs: cache.ttlMs
    };
  }

  return {
    hit: false,
    label: "Tempo real",
    detail: "Resposta atualizada agora e armazenada temporariamente no cache local.",
    cachedAt: cache.cachedAt,
    expiresAt: cache.expiresAt,
    ttlMs: cache.ttlMs
  };
}

function mapResponseCacheStatus(data: CompanyApiResponse): CacheStatus {
  const cache = mapCacheStatus(data.cache);

  if (data.refresh?.accepted) {
    return {
      ...cache,
      label: "Atualizado agora",
      detail: "Atualizacao manual concluida e armazenada temporariamente no cache local.",
      refreshRequested: true,
      refreshAccepted: true
    };
  }

  return {
    ...cache,
    refreshRequested: Boolean(data.refresh?.requested),
    refreshAccepted: Boolean(data.refresh?.accepted)
  };
}

function withResponseMetadata(company: Company, data: CompanyApiResponse): Company {
  const cache = mapResponseCacheStatus(data);
  const history = cache.hit
    ? [
        ...company.history,
        { source: "Cache local", status: "Resposta reaproveitada sem nova consulta externa", date: nowLabel() }
      ]
    : cache.refreshAccepted
      ? [
          ...company.history,
          { source: "Atualizacao manual", status: "Dados consultados novamente nas fontes disponiveis", date: nowLabel() }
        ]
    : company.history;

  return {
    ...company,
    history,
    sources: mapSourceStatuses(data.sources, data.cache),
    cache
  };
}

function formatDate(value?: string) {
  if (!value) return "Nao informado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC"
  }).format(date);
}

function formatMoney(value?: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Nao informado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount);
}

function formatCep(value?: string) {
  const digits = onlyDigits(value ?? "");
  if (digits.length !== 8) return value || "Nao informado";

  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function yesNo(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (!value) return "Nao informado";
  return String(value);
}

function valueOrUnknown(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Nao informado";
  return String(value);
}

function dateOrUnknown(value?: string | null) {
  return value ? formatDate(value) : "Nao informado";
}

function optionPeriod(selected: boolean | string | null | undefined, start?: string, end?: string) {
  const base = yesNo(selected);
  const startDate = dateOrUnknown(start);
  const endDate = dateOrUnknown(end);

  if (startDate === "Nao informado" && endDate === "Nao informado") return base;
  if (endDate !== "Nao informado") return `${base} - opcao em ${startDate}, exclusao em ${endDate}`;
  return `${base} - opcao em ${startDate}`;
}

function formatCnae(code?: number, description?: string) {
  if (!code && !description) return "Nao informado";
  return [code, description].filter(Boolean).join(" - ");
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

function mapBrasilApiToCompany(data: BrasilApiCompany): Company {
  const street = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
  const phone = [data.ddd_telefone1, data.ddd_telefone2].filter(Boolean).join(" / ");

  return {
    cnpj: formatCnpj(data.cnpj),
    legalName: data.razao_social || "Nao informado",
    tradeName: data.nome_fantasia || "Sem nome fantasia",
    status: data.descricao_situacao_cadastral || "Nao informado",
    openingDate: formatDate(data.data_inicio_atividade),
    legalNature: data.natureza_juridica || "Nao informado",
    size: data.descricao_porte || "Nao informado",
    capital: formatMoney(data.capital_social),
    mainCnae: formatCnae(data.cnae_fiscal, data.cnae_fiscal_descricao),
    secondaryCnaes: data.cnaes_secundarios?.length
      ? data.cnaes_secundarios.map((cnae) => formatCnae(cnae.codigo, cnae.descricao))
      : ["Nao informado"],
    address: [
      { label: "Endereco", value: street || "Nao informado" },
      { label: "Municipio / UF", value: [data.municipio, data.uf].filter(Boolean).join(" / ") || "Nao informado" },
      { label: "CEP", value: formatCep(data.cep) },
      { label: "Email", value: data.email || "Nao informado" },
      { label: "Telefone", value: phone || "Nao informado" }
    ],
    fiscal: [
      { label: "Situacao cadastral RF", value: valueOrUnknown(data.descricao_situacao_cadastral) },
      { label: "Codigo situacao RF", value: valueOrUnknown(data.codigo_situacao_cadastral) },
      { label: "Situacao desde", value: dateOrUnknown(data.data_situacao_cadastral) },
      { label: "Motivo situacao", value: valueOrUnknown(data.motivo_situacao_cadastral) },
      { label: "Tipo de unidade", value: valueOrUnknown(data.descricao_identificador_matriz_filial) },
      { label: "Codigo matriz/filial", value: valueOrUnknown(data.identificador_matriz_filial) },
      { label: "Inscricao estadual", value: "Nao consultada nesta etapa - requer fonte SEFAZ/Sintegra" },
      { label: "UF cadastro", value: data.uf || "Nao informado" },
      { label: "Municipio IBGE", value: valueOrUnknown(data.codigo_municipio_ibge) },
      { label: "Ente federativo", value: valueOrUnknown(data.ente_federativo_responsavel) },
      { label: "Simples Nacional", value: optionPeriod(data.opcao_pelo_simples, data.data_opcao_pelo_simples, data.data_exclusao_do_simples) },
      { label: "MEI", value: optionPeriod(data.opcao_pelo_mei, data.data_opcao_pelo_mei, data.data_exclusao_do_mei) },
      { label: "Situacao especial", value: valueOrUnknown(data.situacao_especial) },
      { label: "Data situacao especial", value: dateOrUnknown(data.data_situacao_especial) },
      { label: "Fonte fiscal", value: "BrasilAPI / Receita Federal - dados publicos de CNPJ" }
    ],
    partners: data.qsa?.length
      ? data.qsa.map((partner) => ({
          name: partner.nome_socio || "Nome nao informado",
          role: partner.qualificacao_socio || "Qualificacao nao informada",
          since: formatDate(partner.data_entrada_sociedade)
        }))
      : [{ name: "Nao informado", role: "QSA nao retornado pela fonte", since: "Nao informado" }],
    history: [
      { source: "BrasilAPI", status: "Concluida", date: nowLabel() },
      { source: "Receita Federal", status: "Dados publicos retornados", date: nowLabel() },
      { source: "SEFAZ/Sintegra", status: "Nao consultado nesta etapa", date: nowLabel() }
    ]
  };
}

export async function fetchCompanyByCnpj(cnpj: string, options: { refresh?: boolean } = {}) {
  const digits = onlyDigits(cnpj);
  const query = options.refresh ? "?refresh=1" : "";
  const response = await fetch(`/api/company/${digits}${query}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (response.status === 404) {
      throw new Error(payload.message || "CNPJ nao encontrado na fonte publica.");
    }

    throw new Error(payload.message || "Nao foi possivel consultar o CNPJ agora.");
  }

  const data = (await response.json()) as CompanyApiResponse;

  if (data.publicData) {
    const company = mapBrasilApiToCompany(data.publicData);
    const merged = data.fiscalData ? mergeCompanyWithSefazBa(company, data.fiscalData) : company;
    return withResponseMetadata(merged, data);
  }

  if (hasSefazBaRegistration(data.fiscalData)) {
    return withResponseMetadata(mapSefazBaToCompany(data.fiscalData, data.sources?.brasilApi?.message), data);
  }

  throw new Error(data.sources?.brasilApi?.message || data.sources?.sefazBa?.message || "Nao foi possivel consultar o CNPJ agora.");
}
