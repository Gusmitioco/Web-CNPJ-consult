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
    { label: "Situacao cadastral RF", value: "Ativa" },
    { label: "Codigo situacao RF", value: "2" },
    { label: "Situacao desde", value: "14/03/2018" },
    { label: "Motivo situacao", value: "Nao informado" },
    { label: "Tipo de unidade", value: "Matriz" },
    { label: "Codigo matriz/filial", value: "1" },
    { label: "Inscricao estadual", value: "Nao consultada nesta etapa - requer fonte SEFAZ/Sintegra" },
    { label: "UF cadastro", value: "PR" },
    { label: "Municipio IBGE", value: "4106902" },
    { label: "Ente federativo", value: "Nao informado" },
    { label: "Simples Nacional", value: "Nao optante" },
    { label: "MEI", value: "Nao" },
    { label: "Situacao especial", value: "Nao informado" },
    { label: "Data situacao especial", value: "Nao informado" },
    { label: "Fonte fiscal", value: "BrasilAPI / Receita Federal - dados publicos de CNPJ" }
  ],
  partners: [
    { name: "Mariana Duarte Silva", role: "Socio-administradora", since: "14/03/2018" },
    { name: "Rafael Augusto Lima", role: "Socio", since: "14/03/2018" }
  ],
  history: [
    { source: "Receita Federal", status: "Concluida", date: "25/04/2026 10:42" },
    { source: "Sintegra", status: "Nao consultado nesta etapa", date: "25/04/2026 10:42" },
    { source: "SEFAZ", status: "Nao consultado nesta etapa", date: "25/04/2026 10:43" }
  ]
};
