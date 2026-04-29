import { readFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onlyDigits } from "./cnpj.mjs";
import { config } from "./config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xmlNamespace = "http://www.portalfiscal.inf.br/nfe";
const wsdlNamespace = "http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4";

function resolveLocalPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function buildConsultaCadastroEnvelope(cnpj) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="${wsdlNamespace}">
      <ConsCad xmlns="${xmlNamespace}" versao="2.00">
        <infCons>
          <xServ>CONS-CAD</xServ>
          <UF>BA</UF>
          <CNPJ>${cnpj}</CNPJ>
        </infCons>
      </ConsCad>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function textContent(xml, tagName) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  return decodeXmlEntities(match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "");
}

function decodeXmlEntities(value) {
  let decoded = value;

  for (let index = 0; index < 10; index += 1) {
    const next = decoded
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function tagValue(xml, tagName) {
  const value = textContent(xml, tagName);
  return value || "Nao informado";
}

function parseInfCad(xml) {
  const entries = [...xml.matchAll(/<infCad(?:\s[^>]*)?>([\s\S]*?)<\/infCad>/gi)];

  return entries.map((entry) => {
    const content = entry[1];
    return {
      ie: tagValue(content, "IE"),
      cnpj: tagValue(content, "CNPJ"),
      cpf: tagValue(content, "CPF"),
      uf: tagValue(content, "UF"),
      razaoSocial: tagValue(content, "xNome"),
      fantasia: tagValue(content, "xFant"),
      situacao: tagValue(content, "cSit"),
      situacaoDescricao: describeSituacao(tagValue(content, "cSit")),
      regime: tagValue(content, "xRegApur"),
      cnae: tagValue(content, "CNAE"),
      endereco: {
        logradouro: tagValue(content, "xLgr"),
        numero: tagValue(content, "nro"),
        complemento: tagValue(content, "xCpl"),
        bairro: tagValue(content, "xBairro"),
        municipio: tagValue(content, "xMun"),
        cep: tagValue(content, "CEP")
      }
    };
  });
}

function describeSituacao(code) {
  const descriptions = {
    "0": "Nao habilitado",
    "1": "Habilitado"
  };

  return descriptions[code] || "Nao informado";
}

function parseConsultaCadastroResponse(xml) {
  return {
    source: "SEFAZ-BA Consulta Cadastro",
    statusCode: tagValue(xml, "cStat"),
    statusMessage: tagValue(xml, "xMotivo"),
    uf: tagValue(xml, "UF"),
    requestedAt: new Date().toISOString(),
    registrations: parseInfCad(xml)
  };
}

async function readOptionalCa(caPath) {
  const resolvedPath = resolveLocalPath(caPath);
  return resolvedPath ? readFile(resolvedPath) : undefined;
}

function requestSefaz({ endpoint, pfx, passphrase, ca, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const request = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        port: url.port || 443,
        pfx,
        passphrase,
        ca,
        rejectUnauthorized: config.sefazBa.rejectUnauthorized,
        timeout: timeoutMs,
        headers: {
          "content-type": `application/soap+xml; charset=utf-8; action="${wsdlNamespace}/consultaCadastro"`,
          accept: "application/soap+xml, text/xml",
          "content-length": Buffer.byteLength(body, "utf8")
        }
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: response.statusCode || 0,
            body: responseBody
          });
        });
      }
    );

    request.on("timeout", () => {
      const error = new Error("Tempo limite excedido ao consultar a SEFAZ.");
      error.code = "SEFAZ_TIMEOUT";
      request.destroy(error);
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

export function hasSefazBaConfig() {
  return Boolean(config.sefazBa.certPath && config.sefazBa.certPassword);
}

export function classifySefazError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  const lowerMessage = message.toLowerCase();

  if (code === "SEFAZ_TIMEOUT") {
    return { code: "SEFAZ_TIMEOUT", message: "Tempo limite excedido ao consultar a SEFAZ-BA." };
  }

  if (code === "ERR_CRYPTO_UNSUPPORTED_OPERATION" || lowerMessage.includes("unsupported pkcs12")) {
    return {
      code: "SEFAZ_CERT_UNSUPPORTED_PFX",
      message: "O certificado PFX usa um formato nao suportado pelo Node atual. Reexporte o PFX em formato moderno ou rode o Node com provedor OpenSSL legado."
    };
  }

  if (lowerMessage.includes("mac verify failure") || lowerMessage.includes("invalid password")) {
    return { code: "SEFAZ_CERT_PASSWORD", message: "Nao foi possivel abrir o certificado. Confira a senha do PFX." };
  }

  if (code === "ENOENT") {
    return { code: "SEFAZ_CERT_NOT_FOUND", message: "Arquivo de certificado nao encontrado no caminho configurado." };
  }

  if (["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code)) {
    return {
      code: "SEFAZ_TLS_CA",
      message: "A cadeia de certificados da SEFAZ nao foi reconhecida localmente. Configure um bundle de CA em SEFAZ_CA_PATH."
    };
  }

  if (message.startsWith("SEFAZ_HTTP_")) {
    return { code: message, message: "A SEFAZ-BA retornou erro HTTP na consulta cadastral." };
  }

  return { code: code || "SEFAZ_UNKNOWN", message: "Nao foi possivel consultar a SEFAZ-BA agora." };
}

export async function consultaCadastroBahia(cnpj) {
  const digits = onlyDigits(cnpj);
  const certPath = resolveLocalPath(config.sefazBa.certPath);
  const [pfx, ca] = await Promise.all([readFile(certPath), readOptionalCa(config.sefazBa.caPath)]);
  const body = buildConsultaCadastroEnvelope(digits);
  const response = await requestSefaz({
    endpoint: config.sefazBa.endpoint,
    pfx,
    passphrase: config.sefazBa.certPassword,
    ca,
    body,
    timeoutMs: config.sefazBa.timeoutMs
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`SEFAZ_HTTP_${response.statusCode}`);
  }

  return parseConsultaCadastroResponse(response.body);
}
