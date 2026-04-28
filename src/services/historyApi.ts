import type { Company } from "../types";
import { onlyDigits } from "../utils/cnpj";

export type ConsultationHistoryItem = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  status: string;
  uf: string;
  queriedAt: string;
};

const historyKey = "consulta-cnpj-sefaz:history";
const maxHistoryItems = 12;

function getUf(company: Company) {
  const fiscalUf = company.fiscal.find((field) => field.label === "UF cadastro")?.value;
  if (fiscalUf && fiscalUf !== "Nao informado") return fiscalUf;

  const cityUf = company.address.find((field) => field.label === "Municipio / UF")?.value;
  const uf = cityUf?.split("/").at(-1)?.trim();

  return uf && uf !== "Nao informado" ? uf : "";
}

function readLocalHistory() {
  try {
    const stored = localStorage.getItem(historyKey);
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed) ? (parsed as ConsultationHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(history: ConsultationHistoryItem[]) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, maxHistoryItems)));
  } catch {
    // Historico local e auxiliar; falha de storage nao deve quebrar a consulta.
  }
}

export async function fetchConsultationHistory() {
  return readLocalHistory();
}

export function saveConsultationHistory(company: Company) {
  const currentHistory = readLocalHistory();
  const entry: ConsultationHistoryItem = {
    cnpj: company.cnpj,
    legalName: company.legalName,
    tradeName: company.tradeName,
    status: company.status,
    uf: getUf(company),
    queriedAt: new Date().toISOString()
  };

  const nextHistory = [
    entry,
    ...currentHistory.filter((item) => onlyDigits(item.cnpj) !== onlyDigits(company.cnpj))
  ].slice(0, maxHistoryItems);

  writeLocalHistory(nextHistory);
  return nextHistory;
}
