# Consulta CNPJ Fiscal

Projeto criado com ajuda do Codex para estudar e prototipar uma ferramenta de consulta de CNPJ com foco em:

- consumo de APIs;
- organizacao de backend intermediario;
- cuidados com raspagem de dados;
- consulta de dados publicos de empresas;
- estudo de uma interface util para ambiente de trabalho.

Esta versao corresponde a **build 16**, a ultima build do historico documentado.

## Objetivo

A ideia do projeto e ter uma tela simples para informar um CNPJ e consultar dados cadastrais publicos, usando um backend local como intermediario entre o navegador e as fontes externas.

O projeto tambem serve como estudo para entender por que dados de Receita Federal, SEFAZ, Sintegra e outros servicos fiscais nao devem ser raspados diretamente pelo navegador.

## Funcionalidades atuais

- Consulta automatica ao completar um CNPJ valido.
- Validacao local de CNPJ.
- Backend Node local com rota `/api/cnpj/:cnpj`.
- Integracao inicial com BrasilAPI.
- Cache em memoria por 10 minutos.
- Historico persistente de consultas em `server/data/history.json`.
- Rota `/api/history`.
- Interface React com efeito glassmorphism.
- Modo claro e modo noite.
- Modo noite premium com vidro escuro, ciano e fundo azul-petroleo.
- Botoes de copiar dados por campo/secao.
- Navegacao por secoes apos carregar uma consulta.

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

## Estrutura

```text
src/
  components/       Componentes React da interface
  services/         Chamadas para APIs locais
  utils/            Validacao, formatacao e copia
  App.tsx           Composicao principal
  index.css         Tailwind, temas e glassmorphism

server/
  index.mjs         Servidor Node local, proxy de API e historico
  data/             Historico local gerado em runtime

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

## Observacoes sobre APIs e raspagem

O frontend nao deve raspar paginas da Receita Federal, SEFAZ ou Sintegra diretamente. Alem de instavel, isso pode esbarrar em CORS, captcha, mudancas de layout, bloqueios e regras de acesso.

A arquitetura correta e:

```text
Navegador -> Backend proprio -> APIs oficiais/terceiras/fontes autorizadas
```

Para dados fiscais mais sensiveis ou estaduais, o caminho adequado e usar uma API fiscal especializada ou integracoes oficiais com certificado/acesso autorizado.

## Proximas etapas sugeridas

- Implementar exportacao real em JSON e PDF.
- Modularizar o backend.
- Migrar historico/cache para SQLite.
- Adicionar provedores alternativos de CNPJ.
- Criar estrutura para integracoes fiscais por UF.
- Adicionar tela de configuracoes para tokens, provedores e tempo de cache.
