# CultHub — Frontend

Interface do CultHub, desenvolvida com React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui e React Router.

## Como rodar

```bash
npm install
npm run dev           # servidor local em http://localhost:5173
npm run build         # verifica os tipos e gera o build
npm run lint
npm test              # executa os testes uma vez
npm run test:watch    # executa os testes a cada alteração salva
npm run format        # formata o código, incluindo classes Tailwind e imports
npm run format:check  # apenas verifica a formatação, sem alterar arquivos
```

Recomenda-se rodar `npm run format` antes de cada commit ou, de preferência, ativar a formatação automática ao salvar no editor.

> As imagens dos eventos e dos mapas ainda **não estão no repositório**. Para visualizá-las, copie o conteúdo
> de `foo/assets/` para `public/assets/` (por exemplo, `public/assets/jazz-source.png`).

## Estrutura

```
src/
├── components/
│   ├── ui/          componentes base, criados a partir do shadcn/ui (Button, Badge, Select, Carousel...)
│   ├── common/      componentes próprios usados em várias telas (Surface, SectionHeading, Field, DemoNote...)
│   ├── layout/      Layout, Header, Footer
│   ├── events/      EventCard, FeaturedCarousel, EventFilters, CommentItem...
│   └── weather/     WeatherCard, WeatherStrip, WeatherStats
├── pages/           uma página por rota
├── data/            dados demonstrativos de perfil, comentários, clima e rotas
├── types/           tipos compartilhados (CultEvent, User, CategoryId...)
├── hooks/           leitura de dados (useEvents, useCurrentUser...), useActiveSection e useDocumentTitle
├── lib/             rotas (paths), filtros, cn() e outras funções auxiliares
└── services/        catalog.ts: cliente e adaptadores da API de catálogo; api.ts: ações ainda demonstrativas

tests/               testes, organizados nas mesmas pastas do src/ (além de setup.ts e do helper render.tsx)
```

Os imports usam o alias `@/` para `src/` e `@tests/` para `tests/`; o caminho relativo `./` fica reservado para arquivos da mesma pasta. A ordem dos imports é definida automaticamente pelo Prettier.

## Componentes

Os componentes de `components/ui/` foram criados a partir do [shadcn/ui](https://ui.shadcn.com/docs). Ao contrário de uma biblioteca comum, o shadcn/ui copia o código de cada componente para dentro do projeto, que pode então alterá-lo como precisar. Assim, o comportamento e a acessibilidade (teclado, foco, leitores de tela) vêm prontos, e o visual e os textos foram ajustados ao CultHub.

Para adicionar um novo componente:

1. gere o ponto de partida com `npx shadcn@latest add <nome>`;
2. adapte o arquivo ao padrão do projeto: tokens do CultHub, imports com `@/` e textos em português;
3. revise o `package.json`, já que o comando instala dependências.

Os componentes de `ui/` devem ser usados diretamente (`import { Button } from '@/components/ui/button'`). Um componente em `common/` só se justifica quando a mesma combinação se repete em várias telas, como o `Field`, que reúne rótulo, campo e texto de ajuda. Os ícones são do [Lucide](https://lucide.dev/icons).

## Integração do catálogo e ações demonstrativas

O catálogo consome o backend Django pelos endpoints `/api/eventos/`, `/api/eventos/{uuid}/` e `/api/categorias/`. Busca e filtros são mantidos na URL (`q`, `categorias` e `preco`) e a listagem respeita a paginação da API. O Vite encaminha `/api` para `localhost:8000`; no Docker, `API_PROXY_TARGET` aponta para o serviço `backend`.

- **Ações ainda demonstrativas** (login, perfil, salvar evento, comentários, rotas, clima e geolocalização) usam dados locais ou registram ações no console. Elas ainda não fazem parte da integração do catálogo.
- **Ações do próprio navegador** (pedir localização, compartilhar, abrir o app de mapas...) usam `logDemoAction`, de `src/lib/demo.ts`, e aparecem como `[CultHub demo] ...`.

Para desenvolver com os dois serviços, rode `docker compose up --build` na raiz do projeto. O frontend ficará em `http://localhost:5173` e o backend em `http://localhost:8000`.

## Rotas

| URL                   | Página                             |
| --------------------- | ---------------------------------- |
| `/`                   | Mapa, destaques e todos os eventos |
| `/eventos/:id`        | Detalhes do evento                 |
| `/eventos/:id/origem` | Definir origem ("Como chegar")     |
| `/eventos/:id/rota`   | Rota de exemplo                    |
| `/entrar`             | Entrar / criar conta               |
| `/conta`              | Minha conta                        |

As URLs são definidas apenas em `src/lib/paths.ts`. Nos links, use `paths` em vez de escrever o caminho manualmente:

```tsx
<Link to={paths.event(event.id)}>...</Link>
```

Eventos retornados pelo catálogo têm páginas de detalhes. Os dados de exemplo continuam sendo usados nas áreas ainda não conectadas, como perfil salvo, comentários, clima e rotas.

## Cores, tamanhos e Tailwind

Os tokens de design ficam em `src/index.css`, divididos em duas camadas:

- `@theme`: a paleta do CultHub (`maroon`, `ink`, `cat-*` para o fundo dos cards, `dot-*` para as bolinhas da legenda, `label-*` para o texto dos selos...) e as sombras (`shadow-soft`, `shadow-card`...);
- `@theme inline`: os nomes usados pelo shadcn/ui (`background`, `foreground`, `primary`, `muted-foreground`, `border`, `ring`...), que apontam para a paleta.

No código, dê preferência aos nomes do shadcn/ui (`text-muted-foreground`, `border-border`, `bg-primary`) e reserve a paleta para o que é específico do CultHub, como `text-maroon` ou `bg-cat-music`. Da mesma forma, prefira a escala do Tailwind (`text-sm`, `p-6`) a valores arbitrários como `text-[13px]`; a escala já foi ajustada para manter o espaçamento do design. Textos pequenos devem ter contraste mínimo de 4,5:1 com o fundo.

O layout é pensado primeiro para desktop. Para adaptá-lo a telas menores, use `max-lg:` (até 1150px), `max-md:` (até 900px) e `max-sm:` (até 600px).

## Testes

Os testes usam Vitest e Testing Library e ficam em `tests/`, na mesma pasta que o arquivo testado ocupa em `src/` (por exemplo, `src/lib/paths.ts` → `tests/lib/paths.test.ts`). Componentes com links ou que dependem da rota devem ser renderizados com `renderWithRouter` (`@tests/render`).

## Integração contínua

A cada pull request, o CI executa `lint`, `format:check`, `build` e `npm test -- --coverage`. A cobertura de linhas do `src/` deve ser de pelo menos 80%, o que pode ser conferido localmente com `npm test -- --coverage`.

## Referências

- [shadcn/ui](https://ui.shadcn.com/docs): introdução e documentação de cada componente
- [Tailwind CSS: tema](https://tailwindcss.com/docs/theme)
- [Lucide](https://lucide.dev/icons): catálogo de ícones
- [Vitest](https://vitest.dev/guide/) e [Testing Library](https://testing-library.com/docs/queries/about/#priority): testes e prioridade das consultas
