# Finnhub

A modern film and series browser built on the TMDB catalogue. You can browse, search, read title details, watch trailers and keep a watchlist. **Play** opens a full-screen player *design*: an empty iframe surrounded by a complete set of custom video controls. The controls respond visually (state, menus, keyboard, fullscreen) but are deliberately not connected to any media source.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: put your TMDB key in VITE_TMDB_API_KEY
npm run dev
```

Without a key in the environment, the app asks for one on first launch and stores it in that browser only. Get a free key at <https://www.themoviedb.org/settings/api>. Either the v3 API key or the v4 read access token works.

**Offline development:** `npm run dev:mock` starts a local TMDB stand-in (`scripts/mock-tmdb.mjs`) with generated sample data and artwork, so you can work on the UI without network access or a key.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server against the real TMDB API |
| `npm run dev:mock` | Dev server against the offline mock |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run preview` | Serve the production build |

## What is in it

- **Home:** featured carousel (trending this week, auto-advances, pauses on hover or focus, no auto-advance under reduced motion) plus lazy-loaded rails: trending, popular, in cinemas, top rated, coming soon, your watchlist and "Because You Saved…" recommendations.
- **Films / Series:** genre chips, sort, infinite scroll. Filters live in the URL.
- **Title page:** logo art, certification, runtime, genres, cast, crew facts, trailers and clips, recommendations, and for series a season picker with episode list.
- **Person page:** biography and known-for credits.
- **Search:** debounced multi-search (titles and people), shareable `?q=` URLs, `/` shortcut from anywhere.
- **Watchlist:** stored locally and synced across tabs.
- **Settings:** theme (system, dark, light) and TMDB key management.
- **Player mockup** (`/watch/movie/:id`, `/watch/tv/:id/:season/:episode`): scrubber with hover preview, ±10s, volume, subtitles menu with live caption preview, quality / speed / audio menu, episode side sheet, next episode, up-next card, picture-in-picture button, real fullscreen, auto-hiding chrome. Shortcuts: `Space`/`K` play, `J`/`L` or arrows seek, `↑`/`↓` volume, `M` mute, `C` captions, `F` fullscreen, `E` episodes, `N` next.

## Design system

Built to four briefs: *design-taste-frontend*, *apple-design*, *animejs* and *Web Interface Guidelines*.

- **Tokens:** `src/design/tokens.json` is the single source of truth (colour for dark and light, radii, type scale, springs). `src/styles/index.css` mirrors it as CSS variables.
- **Type:** Geist Variable, self-hosted. Size-specific tracking: display text is tightened, body text is left neutral.
- **Colour:** zinc neutrals with a single amber accent, in both themes. Light and dark follow the OS unless overridden.
- **Shape:** interactive controls are pills, media cards 12px, panels 20px.
- **Materials:** translucent "glass" chrome (`backdrop-filter`). This is a web approximation of Apple's materials, not an Apple asset. It falls back to solid surfaces under `prefers-reduced-transparency`.
- **Motion:** Anime.js v4 springs (`src/lib/motion.ts`) using Apple's perceived-duration + bounce model. Critically damped by default; bounce only after a gesture. Surfaces grow from their trigger and leave along the same path. `prefers-reduced-motion` turns movement into short cross-fades.
- **Accessibility:** skip link, landmarks, labelled icon buttons, native `<dialog>` for trailers, radio-group menus, live regions for search results and player state, visible focus rings, scroll padding under the fixed bar.

## Structure

```
src/
  core/            framework-free logic, mirrors 1:1 into Swift
    models.ts      domain types the UI consumes
    tmdb/          raw response types, mappers, typed client with caching
    storage.ts     key-value abstraction (localStorage / UserDefaults)
    watchlist.ts   observable watchlist
  design/          tokens
  lib/             motion, formatting, env
  hooks/           data fetching, infinite paging, enter animations
  components/      UI building blocks (player/ holds the player chrome)
  routes/          screens
scripts/mock-tmdb.mjs   offline TMDB stand-in
docs/SWIFT_PORT.md      how this maps onto a SwiftUI macOS app
```

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
