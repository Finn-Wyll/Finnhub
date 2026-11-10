# Finnhub

A modern film and series browser built on the TMDB catalogue. You can browse, search, read title details, watch trailers and keep a watchlist. **Play** opens a full-screen player: VidFast plays the video in an iframe that never receives a click, and Finnhub's own controls drive it by reloading it at the right second.

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
| `npm run deploy` | Build and deploy to Cloudflare (`wrangler deploy`) |

## Deploy (Cloudflare, free)

The app is a static build, configured for Cloudflare Workers static assets in `wrangler.jsonc`. Unknown paths fall back to `index.html`, so deep links survive a refresh. `public/_headers` caches the fingerprinted `/assets` files forever and adds basic security headers.

**From the Cloudflare dashboard (auto-deploys on every push):** Workers & Pages, Create, Import a repository, pick this repo. Build command `npm run build`, deploy command `npx wrangler deploy`. To bake in a TMDB key, add a build variable named `VITE_TMDB_API_KEY` under the Worker's Settings, Build, Variables and secrets. It must be a build variable (not a runtime variable) and must keep the `VITE_` prefix.

**From your machine:**

```bash
npx wrangler login
npm run deploy
```

Leave `VITE_TMDB_API_KEY` unset for a public site so each visitor enters their own key. If you set it as a build variable instead, it is compiled into the JavaScript and readable by anyone.

## What is in it

- **Home:** featured carousel (trending this week, auto-advances, pauses on hover or focus, no auto-advance under reduced motion) plus lazy-loaded rails: trending, popular, in cinemas, top rated, coming soon, your watchlist and "Because You Saved…" recommendations.
- **Films / Series:** genre chips, sort, infinite scroll. Filters live in the URL.
- **Title page:** logo art, certification, runtime, genres, cast, crew facts, trailers and clips, recommendations, and for series a season picker with episode list.
- **Person page:** biography and known-for credits.
- **Search:** debounced multi-search (titles and people), shareable `?q=` URLs, `/` shortcut from anywhere.
- **Watchlist:** stored locally and synced across tabs.
- **Resume watching:** the player saves progress from VidFast's `MEDIA_DATA` messages and its own time reports (`src/core/progress.ts`, stored locally, synced across tabs). Films and episodes reopen where you stopped, with a Start Over option; the title page's Play button becomes Resume (or the next episode once one is finished), episode rows show progress, and Home has a Continue Watching rail with a remove button per card.
- **Settings:** theme (system, dark, light) and TMDB key management.
- **Player** (`/watch/movie/:id`, `/watch/tv/:id/:season/:episode`): embeds `https://vidfast.vc/movie/{id}` or `https://vidfast.vc/tv/{id}/{season}/{episode}` with `autoPlay=true`, VidFast's title and fullscreen button hidden, and the amber accent as its theme. VidFast ignores its documented playback commands, and clicks inside its player open ad pop-ups, so the embed never receives a click, focus or screen-reader access. Instead every play, seek, ±10s skip, scrub, Start Over and subtitle change loads a fresh embed at the right second (`startAt`), and pause unloads it, leaving a still of the scene. VidFast's events keep the clock, progress, up-next card and auto-advance honest; a "Not Available Right Now" state appears when VidFast reports that no server can play the title. Volume follows the device. Shortcuts: `Space`/`K` play, `J`/`L` or arrows skip 10s, `C` subtitles, `F` fullscreen, `E` episodes, `N` next. The bridge lives in `src/lib/vidfast.ts`.

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
