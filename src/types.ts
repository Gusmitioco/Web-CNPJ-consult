export type Field = {
  label: string;
  value: string;
};

export type Partner = {
  name: string;
  role: string;
  since: string;
};

export type HistoryItem = {
  source: string;
  status: string;
  date: string;
};

export type SourceStatus = {
  name: string;
  ok: boolean;
  status: string;
  message: string;
};

export type Company = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  status: string;
  openingDate: string;
  legalNature: string;
  size: string;
  capital: string;
  mainCnae: string;
  secondaryCnaes: string[];
  address: Field[];
  fiscal: Field[];
  partners: Partner[];
  history: HistoryItem[];
  sources?: SourceStatus[];
};
