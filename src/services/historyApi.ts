export type ConsultationHistoryItem = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  status: string;
  uf: string;
  queriedAt: string;
};

export async function fetchConsultationHistory() {
  const response = await fetch("/api/history");

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o historico.");
  }

  return (await response.json()) as ConsultationHistoryItem[];
}
