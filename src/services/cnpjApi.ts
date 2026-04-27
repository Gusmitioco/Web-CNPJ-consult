import type { Company } from "../types";
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
  descricao_situacao_cadastral?: string;
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
  email?: string;
  ddd_telefone1?: string;
  ddd_telefone2?: string;
  opcao_pelo_simples?: boolean | string | null;
  opcao_pelo_mei?: boolean | string | null;
  qsa?: BrasilApiPartner[];
};

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
      { label: "Inscricao estadual", value: "Pendente de integracao SEFAZ/Sintegra" },
      { label: "UF cadastro", value: data.uf || "Nao informado" },
      { label: "Regime", value: "Pendente de integracao fiscal" },
      { label: "Simples Nacional", value: yesNo(data.opcao_pelo_simples) },
      { label: "MEI", value: yesNo(data.opcao_pelo_mei) },
      { label: "Fonte fiscal", value: "BrasilAPI / Receita Federal" }
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
      { source: "SEFAZ/Sintegra", status: "Pendente de integracao", date: nowLabel() }
    ]
  };
}

export async function fetchCompanyByCnpj(cnpj: string) {
  const digits = onlyDigits(cnpj);
  const response = await fetch(`/api/cnpj/${digits}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("CNPJ nao encontrado na fonte publica.");
    }

    throw new Error("Nao foi possivel consultar o CNPJ agora.");
  }

  const data = (await response.json()) as BrasilApiCompany;
  return mapBrasilApiToCompany(data);
}
