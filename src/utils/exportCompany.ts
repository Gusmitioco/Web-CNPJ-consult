import type { Company, Field } from "../types";

function cnpjDigits(cnpj: string) {
  return cnpj.replace(/\D/g, "");
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function fileBaseName(company: Company) {
  const digits = cnpjDigits(company.cnpj) || "cnpj";
  const name = slug(company.legalName) || "consulta";
  return `${digits}-${name}`;
}

function downloadBlob(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fieldsRows(fields: Field[]) {
  return fields
    .map(
      (field) => `
        <tr>
          <th>${escapeHtml(field.label)}</th>
          <td>${escapeHtml(field.value)}</td>
        </tr>
      `
    )
    .join("");
}

function section(title: string, body: string) {
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

function reportHtml(company: Company) {
  const exportedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Consulta CNPJ - ${escapeHtml(company.cnpj)}</title>
    <style>
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        margin: 0;
        padding: 32px;
        color: #243033;
        background: #f4fbfb;
        font-family: Arial, Helvetica, sans-serif;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        border: 1px solid #cfe7e8;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 24px 70px rgba(0, 100, 101, 0.16);
        overflow: hidden;
      }
      header {
        padding: 28px;
        color: #eaf7fa;
        background: linear-gradient(135deg, #006465, #0f928c 58%, #00c9d2);
      }
      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
      }
      .meta {
        margin-top: 10px;
        color: rgba(234, 247, 250, 0.86);
        font-size: 13px;
        font-weight: 700;
      }
      section {
        padding: 22px 28px;
        border-top: 1px solid #e0eff0;
      }
      h2 {
        margin: 0 0 14px;
        color: #006465;
        font-size: 15px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 10px 0;
        border-bottom: 1px solid #edf5f5;
        vertical-align: top;
        text-align: left;
        font-size: 13px;
      }
      th {
        width: 220px;
        color: #5f7479;
        font-weight: 800;
      }
      td {
        color: #243033;
        font-weight: 700;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      li {
        margin: 8px 0;
        font-size: 13px;
        font-weight: 700;
      }
      .actions {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        justify-content: flex-end;
        max-width: 960px;
        margin: 0 auto 14px;
      }
      button {
        border: 1px solid rgba(0, 100, 101, 0.24);
        border-radius: 12px;
        background: #006465;
        color: #fff;
        padding: 10px 14px;
        font: 800 13px Arial, Helvetica, sans-serif;
        cursor: pointer;
      }
      @media print {
        @page {
          size: A4;
          margin: 12mm;
        }
        body {
          padding: 0;
          background: #f4fbfb;
        }
        main {
          width: 100%;
          max-width: none;
          margin: 0;
          border: 1px solid #cfe7e8;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(0, 100, 101, 0.12);
        }
        header {
          color: #eaf7fa;
          background: linear-gradient(135deg, #006465, #0f928c 58%, #00c9d2);
        }
        .actions { display: none; }
        section { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="actions">
      <button type="button" onclick="window.print()">Salvar / imprimir PDF</button>
    </div>
    <main>
      <header>
        <h1>${escapeHtml(company.legalName)}</h1>
        <div class="meta">CNPJ ${escapeHtml(company.cnpj)} - exportado em ${escapeHtml(exportedAt)}</div>
      </header>
      ${section(
        "Identificacao cadastral",
        `<table>${fieldsRows([
          { label: "Razao social", value: company.legalName },
          { label: "Nome fantasia", value: company.tradeName },
          { label: "CNPJ", value: company.cnpj },
          { label: "Situacao cadastral", value: company.status },
          { label: "Abertura", value: company.openingDate },
          { label: "Natureza juridica", value: company.legalNature },
          { label: "Porte", value: company.size },
          { label: "Capital social", value: company.capital }
        ])}</table>`
      )}
      ${section("Endereco e contato", `<table>${fieldsRows(company.address)}</table>`)}
      ${section(
        "Atividades economicas",
        `<table>${fieldsRows([{ label: "Principal", value: company.mainCnae }])}</table>
        <ul>${company.secondaryCnaes.map((cnae) => `<li>${escapeHtml(cnae)}</li>`).join("")}</ul>`
      )}
      ${section("Situacao fiscal", `<table>${fieldsRows(company.fiscal)}</table>`)}
      ${section(
        "Socios e administradores",
        `<ul>${company.partners
          .map((partner) => `<li>${escapeHtml(partner.name)} - ${escapeHtml(partner.role)} desde ${escapeHtml(partner.since)}</li>`)
          .join("")}</ul>`
      )}
      ${section(
        "Historico da consulta",
        `<ul>${company.history
          .map((item) => `<li>${escapeHtml(item.source)} - ${escapeHtml(item.status)} em ${escapeHtml(item.date)}</li>`)
          .join("")}</ul>`
      )}
    </main>
  </body>
</html>`;
}

export function exportCompanyJson(company: Company) {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "consulta-cnpj-sefaz",
    version: "0.1",
    company
  };

  downloadBlob(JSON.stringify(payload, null, 2), `${fileBaseName(company)}.json`, "application/json;charset=utf-8");
}

export function exportCompanyPdf(company: Company) {
  const popup = window.open("", "_blank", "width=980,height=1100");

  if (!popup) return false;

  popup.document.open();
  popup.document.write(reportHtml(company));
  popup.document.close();
  popup.focus();

  window.setTimeout(() => {
    popup.print();
  }, 350);

  return true;
}
