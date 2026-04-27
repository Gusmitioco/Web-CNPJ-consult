import type { Company } from "../types";

export const mockCompany: Company = {
  cnpj: "12.345.678/0001-95",
  legalName: "ALFA COMERCIO E DISTRIBUICAO LTDA",
  tradeName: "ALFA DISTRIBUIDORA",
  status: "Ativa",
  openingDate: "14/03/2018",
  legalNature: "206-2 - Sociedade Empresaria Limitada",
  size: "Empresa de Pequeno Porte",
  capital: "R$ 250.000,00",
  mainCnae: "46.49-4-99 - Comercio atacadista de outros equipamentos",
  secondaryCnaes: [
    "47.89-0-99 - Comercio varejista de outros produtos",
    "46.51-6-01 - Comercio atacadista de equipamentos de informatica",
    "52.11-7-99 - Depositos de mercadorias para terceiros"
  ],
  address: [
    { label: "Endereco", value: "Avenida Brasil, 1450, Sala 04, Centro" },
    { label: "Municipio / UF", value: "Curitiba / PR" },
    { label: "CEP", value: "80.010-000" },
    { label: "Email", value: "fiscal@alfadistribuidora.com.br" },
    { label: "Telefone", value: "(41) 3333-2020" }
  ],
  fiscal: [
    { label: "Inscricao estadual", value: "903.45678-90" },
    { label: "UF cadastro", value: "PR" },
    { label: "Regime", value: "Regime Normal" },
    { label: "Simples Nacional", value: "Nao optante" },
    { label: "Credenciamento NFC-e", value: "Habilitado" },
    { label: "Fonte fiscal", value: "Sintegra / SEFAZ PR" }
  ],
  partners: [
    { name: "Mariana Duarte Silva", role: "Socio-administradora", since: "14/03/2018" },
    { name: "Rafael Augusto Lima", role: "Socio", since: "14/03/2018" }
  ],
  history: [
    { source: "Receita Federal", status: "Concluida", date: "25/04/2026 10:42" },
    { source: "Sintegra", status: "Concluida", date: "25/04/2026 10:42" },
    { source: "SEFAZ", status: "Concluida", date: "25/04/2026 10:43" }
  ]
};
