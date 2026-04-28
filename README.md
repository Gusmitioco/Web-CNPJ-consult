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

As variaveis opcionais estao documentadas em `.env.example`:

```text
PORT=5173
HOST=0.0.0.0
BRASIL_API_BASE_URL=https://brasilapi.com.br/api/cnpj/v1
CACHE_TTL_MS=600000
UPSTREAM_TIMEOUT_MS=8000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=40
```

Para restringir o acesso apenas a maquina local, use `HOST=127.0.0.1`. Para acesso pela rede local, mantenha `HOST=0.0.0.0`.

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
  config.mjs        Configuracao por variaveis de ambiente
  cnpj.mjs          Normalizacao e validacao de CNPJ no backend
  rateLimit.mjs     Rate limit simples por chave/IP
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

Depois da build 16, os commits passaram a documentar incrementos menores, incluindo exportacao JSON/PDF, historico local por navegador, scrollbar personalizada, melhorias na formatacao do CNPJ, dados fiscais mais completos e protecoes basicas no backend.

## Observacoes sobre APIs e raspagem

O frontend nao deve raspar paginas da Receita Federal, SEFAZ ou Sintegra diretamente. Alem de instavel, isso pode esbarrar em CORS, captcha, mudancas de layout, bloqueios e regras de acesso.

A arquitetura correta e:

```text
Navegador -> Backend proprio -> APIs oficiais/terceiras/fontes autorizadas
```

Para dados fiscais mais sensiveis ou estaduais, o caminho adequado e usar uma API fiscal especializada ou integracoes oficiais com certificado/acesso autorizado.

Atualmente o projeto nao afirma inscricao estadual ativa nem habilitacao em SEFAZ/Sintegra quando esses dados nao foram consultados. A interface mostra esses pontos como pendentes para evitar conclusoes fiscais incorretas.

## Seguranca

O backend aplica algumas protecoes iniciais:

- valida CNPJ no servidor;
- valida o formato minimo do payload retornado pela fonte externa;
- limita volume de consultas por IP em uma janela curta;
- usa timeout ao chamar a fonte externa;
- envia headers basicos como `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` e `Referrer-Policy`;
- nao persiste historico de consultas no servidor.

Essas medidas nao substituem uma revisao de seguranca completa. Antes de expor fora da rede local, ainda seria necessario revisar autenticacao, logs, observabilidade, HTTPS, controle de origem, limite de payloads e politica de uso das APIs.

## Proximas etapas sugeridas

- Modularizar o backend.
- Adicionar provedores alternativos de CNPJ.
- Criar estrutura para integracoes fiscais por UF.
- Adicionar tela de configuracoes para tokens, provedores e tempo de cache.
- Expandir testes automatizados para backend HTTP, exportacao e fluxo visual.
- Revisar hardening antes de qualquer publicacao externa.
