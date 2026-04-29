import type { Company, Field, HistoryItem } from "../types";
import { formatCnpj, onlyDigits } from "../utils/cnpj";

type SefazBaAddress = {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  cep?: string;
};

export type SefazBaRegistration = {
  ie?: string;
  cnpj?: string;
  cpf?: string;
  uf?: string;
  razaoSocial?: string;
  fantasia?: string;
  situacao?: string;
  situacaoDescricao?: string;
  regime?: string;
  cnae?: string;
  endereco?: SefazBaAddress;
};

export type SefazBaResponse = {
  source: string;
  statusCode: string;
  statusMessage: string;
  uf: string;
  requestedAt: string;
  registrations: SefazBaRegistration[];
};

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function valueOrUnknown(value?: string | number | null) {
  const text = String(value ?? "").trim();
  return text && text !== "Nao informado" ? text : "Nao informado";
}

function formatCep(value?: string) {
  const digits = onlyDigits(value ?? "");
  if (digits.length !== 8) return valueOrUnknown(value);

  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function buildStreet(address?: SefazBaAddress) {
  return [address?.logradouro, address?.numero, address?.complemento, address?.bairro]
    .map(valueOrUnknown)
    .filter((value) => value !== "Nao informado")
    .join(", ") || "Nao informado";
}

function buildSefazFiscalFields(response: SefazBaResponse, registration: SefazBaRegistration): Field[] {
  return [
    { label: "Inscricao estadual", value: valueOrUnknown(registration.ie) },
    { label: "Situacao IE SEFAZ-BA", value: valueOrUnknown(registration.situacaoDescricao) },
    { label: "Codigo situacao IE SEFAZ-BA", value: valueOrUnknown(registration.situacao) },
    { label: "Regime SEFAZ-BA", value: valueOrUnknown(registration.regime) },
    { label: "CNAE SEFAZ-BA", value: valueOrUnknown(registration.cnae) },
    { label: "UF cadastro", value: valueOrUnknown(registration.uf || response.uf) },
    { label: "Status consulta SEFAZ-BA", value: valueOrUnknown(response.statusMessage) },
    { label: "Codigo status SEFAZ-BA", value: valueOrUnknown(response.statusCode) },
    { label: "Fonte fiscal", value: response.source }
  ];
}

function mergeFields(base: Field[], additions: Field[]) {
  const merged = new Map(base.map((field) => [field.label, field]));

  for (const field of additions) {
    merged.set(field.label, field);
  }

  return [...merged.values()];
}

function appendSefazHistory(history: HistoryItem[], response: SefazBaResponse) {
  const withoutOldSefaz = history.filter((item) => !item.source.toLowerCase().includes("sefaz"));

  return [
    ...withoutOldSefaz,
    {
      source: "SEFAZ-BA",
      status: valueOrUnknown(response.statusMessage),
      date: nowLabel()
    }
  ];
}

export function hasSefazBaRegistration(response: SefazBaResponse | null | undefined): response is SefazBaResponse {
  return Boolean(response?.registrations?.length);
}

export function mergeCompanyWithSefazBa(company: Company, response: SefazBaResponse) {
  const registration = response.registrations[0];

  if (!registration) {
    return {
      ...company,
      history: appendSefazHistory(company.history, response)
    };
  }

  return {
    ...company,
    status:
      valueOrUnknown(registration.situacaoDescricao) !== "Nao informado"
        ? `${company.status} / IE ${valueOrUnknown(registration.situacaoDescricao)}`
        : company.status,
    fiscal: mergeFields(company.fiscal, buildSefazFiscalFields(response, registration)),
    history: appendSefazHistory(company.history, response)
  };
}

export function mapSefazBaToCompany(response: SefazBaResponse, brasilApiStatus = "Nao retornado pela fonte publica") {
  const registration = response.registrations[0];
  const address = registration?.endereco;
  const cnpj = valueOrUnknown(registration?.cnpj);
  const uf = valueOrUnknown(registration?.uf || response.uf);

  return {
    cnpj: cnpj === "Nao informado" ? "Nao informado" : formatCnpj(cnpj),
    legalName: valueOrUnknown(registration?.razaoSocial),
    tradeName: valueOrUnknown(registration?.fantasia) === "Nao informado" ? "Sem nome fantasia" : valueOrUnknown(registration?.fantasia),
    status: valueOrUnknown(registration?.situacaoDescricao),
    openingDate: "Nao informado pela SEFAZ-BA",
    legalNature: "Nao informado pela SEFAZ-BA",
    size: "Nao informado pela SEFAZ-BA",
    capital: "Nao informado pela SEFAZ-BA",
    mainCnae: valueOrUnknown(registration?.cnae),
    secondaryCnaes: ["Nao informado pela SEFAZ-BA"],
    address: [
      { label: "Endereco", value: buildStreet(address) },
      { label: "Municipio / UF", value: [valueOrUnknown(address?.municipio), uf].filter((value) => value !== "Nao informado").join(" / ") || "Nao informado" },
      { label: "CEP", value: formatCep(address?.cep) },
      { label: "Email", value: "Nao informado pela SEFAZ-BA" },
      { label: "Telefone", value: "Nao informado pela SEFAZ-BA" }
    ],
    fiscal: buildSefazFiscalFields(response, registration ?? {}),
    partners: [{ name: "Nao informado", role: "QSA nao retornado pela SEFAZ-BA", since: "Nao informado" }],
    history: [
      { source: "SEFAZ-BA", status: valueOrUnknown(response.statusMessage), date: nowLabel() },
      { source: "BrasilAPI", status: brasilApiStatus, date: nowLabel() }
    ]
  } satisfies Company;
}

export async function fetchSefazBaByCnpj(cnpj: string) {
  const digits = onlyDigits(cnpj);
  const response = await fetch(`/api/fiscal/ba/${digits}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(payload.message || payload.code || "Nao foi possivel consultar a SEFAZ-BA agora.");
  }

  return (await response.json()) as SefazBaResponse;
}
