# Consulta CNPJ Fiscal

Projeto criado com ajuda do Codex para estudar e prototipar uma ferramenta de consulta de CNPJ com foco em:

- consumo de APIs;
- organizacao de backend intermediario;
- cuidados com raspagem de dados;
- consulta de dados publicos de empresas;
- estudo de uma interface util para ambiente de trabalho;
- boas praticas iniciais de seguranca para uma aplicacao exposta em rede local.

Esta versao evoluiu a partir da **build 16**, que foi a ultima build do historico inicial documentado antes dos commits no Git.

## Objetivo

A ideia do projeto e ter uma tela simples para informar um CNPJ e consultar dados cadastrais publicos, usando um backend local como intermediario entre o navegador e as fontes externas.

O projeto tambem serve como estudo para entender por que dados de Receita Federal, SEFAZ, Sintegra e outros servicos fiscais nao devem ser raspados diretamente pelo navegador.

## Funcionalidades atuais

- Consulta automatica ao completar um CNPJ valido.
- Aceita CNPJ colado com ou sem mascara.
- Validacao local e no backend para CNPJ.
- Backend Node local com rota `/api/cnpj/:cnpj`.
- Integracao inicial com BrasilAPI.
- Cache em memoria por 10 minutos.
- Historico de consultas local por navegador, usando `localStorage`.
- Exportacao em JSON estruturado.
- Relatorio para salvar/imprimir em PDF pelo navegador.
- Interface React com efeito glassmorphism.
- Modo claro e modo noite.
- Modo noite premium com vidro escuro, ciano e fundo azul-petroleo.
- Botoes de copiar dados por campo/secao.
- Navegacao por secoes apos carregar uma consulta.
- Scrollbar personalizada conforme o tema.
- Dados fiscais enriquecidos com campos publicos retornados pela BrasilAPI/Receita Federal.
- Backend com timeout de API externa, rate limit simples por IP e headers basicos de seguranca.
- Rota `/health` para checagem simples do servidor.
- Testes automatizados pequenos para validacao de CNPJ e rate limit.
- Integracao inicial com consulta cadastral SEFAZ-BA via backend local.
- Tela principal consumindo a SEFAZ-BA para inscricao estadual, situacao da IE, regime e CNAE estadual quando o certificado estiver configurado.
- Fallback parcial pela SEFAZ-BA quando a BrasilAPI nao retorna o CNPJ, mantendo aviso no historico da consulta.
- Consulta unificada no backend para agregar dados publicos e fiscais antes de entregar ao frontend.
- Log local de consultas em arquivo JSON ignorado pelo Git.
- Indicador visual das fontes que responderam em cada consulta.
- Pagina de auditoria local para visualizar e filtrar consultas registradas.

## Como rodar

Instale as dependencias:

```powershell
npm install
```

Gere a build:

```powershell
npm run build
```

Inicie o servidor local:

```powershell
npm run start
```

Acesse:

```text
http://localhost:5173/
```

Em rede local, use o IP exibido pela sua maquina, por exemplo:

```text
http://192.168.0.104:5173/
```

## Desenvolvimento

Para rodar com Vite em modo desenvolvimento:

```powershell
npm run dev
```

Para rodar os testes:

```powershell
npm run test
```

## Configuracao

As variaveis opcionais estao documentadas em `.env.example`. Exemplo minimo:

```text
PORT=5173
HOST=0.0.0.0
BRASIL_API_BASE_URL=https://brasilapi.com.br/api/cnpj/v1
CACHE_TTL_MS=600000
UPSTREAM_TIMEOUT_MS=8000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=40
AUDIT_ALLOWED_IPS=127.0.0.1,::1
```

Para restringir o acesso apenas a maquina local, use `HOST=127.0.0.1`. Para acesso pela rede local, mantenha `HOST=0.0.0.0`.

Nunca envie `.env`, certificado `.pfx/.p12` ou senha para o GitHub. O backend le essas configuracoes localmente e o frontend nunca recebe o certificado.

## Estrutura

```text
src/
  components/       Componentes React da interface
  services/         Chamadas para APIs locais
  utils/            Validacao, formatacao, copia e exportacao
  App.tsx           Composicao principal
  index.css         Tailwind, temas e glassmorphism

server/
  index.mjs         Servidor Node local, proxy de API, cache e protecoes basicas
  auditLog.mjs      Registro local das consultas realizadas
  config.mjs        Configuracao por variaveis de ambiente
  cnpj.mjs          Normalizacao e validacao de CNPJ no backend
  rateLimit.mjs     Rate limit simples por chave/IP
  sefazBa.mjs       Cliente SOAP inicial para Consulta Cadastro SEFAZ-BA
  *.test.mjs        Testes automatizados com node:test
  data/             Pasta mantida para estrutura, sem historico compartilhado

dist/
  Build de producao gerada pelo Vite
```

## Historico de builds

Durante o desenvolvimento foram documentadas 16 builds na pasta:

```text
C:\Users\GustavoB\Desktop\Utilitarios\builds
```

Observacao: as builds antigas foram documentadas, mas nao todas possuem snapshot real de codigo, porque o projeto foi evoluindo sobre os mesmos arquivos antes de haver commits no Git. A build 16 e a versao atual escolhida para subir ao GitHub.

Resumo:

- Build 01: primeira versao estatica HTML/CSS/JS.
- Build 02: migracao para React, Vite, TypeScript e Tailwind.
- Build 03: finalizacao da base React e build local.
- Build 04: sidebar ativa, rolagem e nova paleta.
- Build 05: ajustes de navegacao e acesso em rede local.
- Build 06: otimizacao de performance.
- Build 07: primeira consulta real via BrasilAPI.
- Build 08: backend local e proxy `/api/cnpj`.
- Build 09: tela inicial sem CNPJ carregado.
- Build 10: remocao da sidebar e navbar glass.
- Build 11: ajustes de topo e navbar.
- Build 12: tela inicial focada na busca.
- Build 13: consulta automatica e cache.
- Build 14: planejamento das proximas etapas.
- Build 15: historico persistente e tema dia/noite.
- Build 16: modo noite premium glassmorphism.

Depois da build 16, os commits passaram a documentar incrementos menores. A partir daqui o historico usa o nome **marcos**, porque cada etapa representa uma melhoria funcional ou tecnica do MVP.

### Marcos pos-build 16

- Marco 17: exportacao JSON/PDF, historico local por navegador e scrollbar personalizada.
- Marco 18: formatacao melhorada do CNPJ colado/digitado e botao de tema reposicionado.
- Marco 19: dados fiscais mais completos a partir da BrasilAPI/Receita Federal e protecoes basicas no backend.
- Marco 20: correcoes de seguranca, rotas, configuracao por ambiente, testes automatizados e dependencias fixadas.
- Marco 21: integracao inicial da Consulta Cadastro SEFAZ-BA via certificado A1 no backend.
- Marco 22: validacao TLS local para consulta SEFAZ-BA.
- Marco 23: frontend integrado a SEFAZ-BA, com merge de dados fiscais e fallback quando a fonte publica nao encontra o CNPJ.
- Marco 24: consulta agregada no backend, reduzindo regras de integracao dentro do frontend.
- Marco 25: log local de consultas com CNPJ, data/hora, cliente da rede e status das fontes.
- Marco 26: indicador visual de fontes consultadas no painel principal.
- Marco 27: pagina de auditoria local com filtro por CNPJ, IP, fonte ou resultado.
- Marco 28: whitelist de IPs para liberar a visualizacao do painel de auditoria.

## Observacoes sobre APIs e raspagem

O frontend nao deve raspar paginas da Receita Federal, SEFAZ ou Sintegra diretamente. Alem de instavel, isso pode esbarrar em CORS, captcha, mudancas de layout, bloqueios e regras de acesso.

A arquitetura correta e:

```text
Navegador -> Backend proprio -> APIs oficiais/terceiras/fontes autorizadas
```

Para dados fiscais mais sensiveis ou estaduais, o caminho adequado e usar uma API fiscal especializada ou integracoes oficiais com certificado/acesso autorizado.

Atualmente o projeto nao afirma inscricao estadual ativa nem habilitacao em SEFAZ/Sintegra quando esses dados nao foram consultados. A interface mostra esses pontos como pendentes para evitar conclusoes fiscais incorretas.

## Consulta SEFAZ-BA

A integracao com SEFAZ-BA fica somente no backend local e depende de configuracao privada do ambiente, como certificado digital e variaveis locais.

Quando configurada, a consulta pode complementar os dados publicos do CNPJ com informacoes fiscais, como inscricao estadual, situacao da IE, regime e CNAE retornado pela fonte estadual.

Certificados, senhas, arquivos de cadeia CA, logs e `.env` nao devem ser enviados ao GitHub. O frontend nunca recebe o certificado nem a senha.

## Seguranca

O backend aplica algumas protecoes iniciais:

- valida CNPJ no servidor;
- valida o formato minimo do payload retornado pela fonte externa;
- limita volume de consultas por IP em uma janela curta;
- usa timeout ao chamar a fonte externa;
- envia headers basicos como `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` e `Referrer-Policy`;
- nao persiste historico de consultas no servidor.
- mantem certificado e senha apenas no backend local, via `.env`/variaveis de ambiente.
- grava log local de consultas em `server/data/query-log.json`, arquivo ignorado pelo Git.
- expoe os logs apenas pela aplicacao local, sem incluir o arquivo no repositorio.
- restringe a leitura dos logs por whitelist de IPs configurada localmente.

Essas medidas nao substituem uma revisao de seguranca completa. Antes de expor fora da rede local, ainda seria necessario revisar autenticacao, logs, observabilidade, HTTPS, controle de origem, limite de payloads e politica de uso das APIs.

## Proximas etapas sugeridas

- Modularizar o backend.
- Adicionar provedores alternativos de CNPJ.
- Criar estrutura para integracoes fiscais por UF.
- Adicionar tela de configuracoes para tokens, provedores e tempo de cache.
- Expandir testes automatizados para backend HTTP, exportacao e fluxo visual.
- Revisar hardening antes de qualquer publicacao externa.
