# CultHub — Frontend

Feito com React 19, TypeScript, Vite, Tailwind CSS 4 e React Router.

## Como rodar

```bash
npm install
npm run dev           # abre em http://localhost:5173
npm run build         # checa os tipos e gera o build
npm run lint
npm test              # roda os testes uma vez
npm run test:watch    # deixa os testes rodando enquanto você edita
npm run format        # arruma a formatação (inclusive classes Tailwind e imports)
npm run format:check  # só confere, sem mudar nada
```

Rode `npm run format` antes de commitar. Melhor ainda: ative "formatar ao salvar" no seu editor e esqueça
disso (no VS Code, instale a extensão _Prettier_ e ligue `"editor.formatOnSave": true`).

> As imagens dos eventos e dos mapas ainda **não estão no repositório**. Para vê-las, copie o conteúdo de
> `foo/assets/` para `public/assets/` (ex.: `public/assets/jazz-source.png`).

## Onde fica cada coisa

```
src/
├── components/
│   ├── ui/          componentes do shadcn/ui (gerados pelo CLI e ajustados ao visual do CultHub)
│   ├── common/      componentes nossos usados em várias telas (Surface, SectionHeading, DemoNote...)
│   ├── layout/      Layout, Header, Footer
│   ├── events/      EventCard, EventStrip, CommentItem, RoutePreview
│   └── weather/     WeatherCard, WeatherStrip, WeatherStats
├── pages/           uma por rota
├── data/            dados de exemplo, separados por assunto (vão virar chamadas à API)
├── types/           tipos compartilhados (CultEvent, User, CategoryId...)
├── hooks/           leitura de dados (useEvents, useCurrentUser, useComments...) e useDocumentTitle
├── lib/             rotas (paths), cn() e outros helpers
└── services/        api.ts: chamadas ao backend (por enquanto só aparecem no console)

tests/               testes, com as mesmas pastas do src/ (+ setup.ts e o helper render.tsx)
```

Nos imports, use `@/` (que aponta para `src/`) e `@tests/` (para `tests/`). O `./` fica só para arquivos
da mesma pasta. A ordem dos imports o Prettier resolve sozinho.

## Rotas

| URL                   | Página                             |
| --------------------- | ---------------------------------- |
| `/`                   | Mapa, destaques e todos os eventos |
| `/eventos/:id`        | Detalhes do evento                 |
| `/eventos/:id/origem` | Definir origem ("Como chegar")     |
| `/eventos/:id/rota`   | Rota de exemplo                    |
| `/entrar`             | Entrar / criar conta               |
| `/conta`              | Minha conta                        |

As URLs são definidas só em `src/lib/paths.ts`. Nos links, use `paths` em vez de escrever o caminho na mão:

```tsx
<Link to={paths.event(event.id)}>...</Link>
```

Por enquanto, só o evento `sp-jazz-blues-festival` tem página de detalhes (veja `details` em
`src/data/events.ts`).

## Cores, tamanhos e Tailwind

Os tokens de design ficam em `src/index.css`, em duas partes:

- `@theme`: a paleta do CultHub (`maroon`, `ink`, `cat-*` para o fundo dos cards, `dot-*` para as bolinhas
  da legenda...) e as sombras (`shadow-soft`, `shadow-card`, `shadow-popover`, `shadow-badge`);
- `@theme inline`: os nomes que o shadcn/ui usa (`background`, `foreground`, `primary`, `muted-foreground`,
  `border`, `ring`), apontando para a nossa paleta.

No dia a dia, prefira esses nomes do shadcn (`text-muted-foreground`, `border-border`, `bg-primary`) e deixe a
paleta para o que é bem nosso, como `text-maroon` ou `bg-cat-music`. E prefira a escala do Tailwind
(`text-sm`, `p-6`) a valores soltos como `text-[13px]`: ela já foi ajustada para manter o espaçamento do
design.

O layout é pensado primeiro para desktop, então use `max-lg:` (até 1150px), `max-md:` (até 900px) e `max-sm:`
(até 600px) para adaptar a telas menores.

## Testes

Usamos Vitest + Testing Library. Os testes ficam em `tests/`, na mesma pasta que o arquivo testado teria no
`src/` (`src/lib/paths.ts` → `tests/lib/paths.test.ts`). Se o componente tiver links ou depender da rota,
renderize com `renderWithRouter` (`@tests/render`).
