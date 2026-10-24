# CultHub — Frontend

React 19 + TypeScript + Vite + Tailwind CSS 3 + React Router.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

> As imagens dos eventos e dos mapas **não ficam no código**: copie o conteúdo de
> `foo/assets/` para `public/assets/` (ex.: `public/assets/jazz-source.png`).

## Rotas

| URL                         | Página                                   |
| --------------------------- | ---------------------------------------- |
| `/`                         | Mapa, destaques e todos os eventos       |
| `/eventos/:id`              | Detalhes do evento                       |
| `/eventos/:id/origem`       | Definir origem ("Como chegar")           |
| `/eventos/:id/rota`         | Rota de exemplo                          |
| `/entrar`                   | Entrar / criar conta                     |
| `/conta`                    | Minha conta                              |

Hoje só o evento `sp-jazz-blues-festival` tem detalhes (`details` em `src/data/events.ts`).

## Estrutura

```
src/
  components/
    layout/    Layout, Header, Footer
    ui/        Button, Surface, Field, DemoNote, Breadcrumbs, ícones...
    events/    EventCard, EventStrip, CommentItem, RoutePreview
    weather/   WeatherCard, WeatherStrip, WeatherStats
  pages/       uma por rota
  data/        dados demonstrativos (trocar por chamadas à API do backend)
  hooks/       useDocumentTitle, useEvent
  lib/         categorias, classes Tailwind compartilhadas, helpers
```

## Tailwind

Os tokens do `foo/style.css` estão em `tailwind.config.js`:

- cores: `page`, `surface`, `maroon`, `ink`, `muted`, `accent`, `line`, `cat-*` (fundo dos cards) e `dot-*` (legenda);
- sombras: `shadow-soft`, `shadow-card`, `shadow-popover`, `shadow-badge`;
- breakpoints iguais aos do CSS original, **desktop-first**: use `max-lg:` (≤1150px), `max-md:` (≤900px) e `max-sm:` (≤600px).

Use tamanhos de fonte em pixels (`text-[13px]`) em vez de `text-sm`/`text-xs`: as classes nomeadas do
Tailwind também definem `line-height` e mudariam o espaçamento do design.
