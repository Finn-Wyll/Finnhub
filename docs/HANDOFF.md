# Handoff: Finnhub

Status as of 10 November 2026. Written for the next agent picking this up.

## What this is

A film and series browser on the TMDB catalogue. It is a React + Vite single-page app, deployed on Cloudflare. The owner may later port it to macOS in SwiftUI.

Everything works against real TMDB data, including the **player** (`/watch/...`), which is now in scope. It embeds `https://vidfast.vc/movie/{id}?autoPlay=true` for films and `https://vidfast.vc/tv/{id}/{season}/{episode}?autoPlay=true` for episodes in an iframe, using the TMDB id. **VidFast ignores its own documented postMessage commands.** Its shipped player (vidfast.vc, and vidcore.io where vidfast.bz redirects; every other VidFast domain redirects to vidfast.vc) answers only `getStatus`; `play`, `pause`, `seek`, `volume` and `mute` reach no code. Clicks inside the embed open ad pop-ups (an injected script opens `_blank` forms), and it refuses to run in a sandboxed iframe (it shows "Please Disable Sandbox"). So the iframe has `pointer-events: none`, `tabIndex=-1` and `aria-hidden`, a click layer sits over it, and the player in `src/routes/Player.tsx` drives playback through the URL: each play, seek, skip, scrub, Start Over or subtitle change starts a new "session" (a fresh embed keyed by a counter, with `startAt` and `autoPlay=true`), and pause unloads the embed. Skips within 600 ms are combined into one reload. `startAt=0` counts as unset in VidFast (it then resumes from its own saved progress), so a start from the beginning is sent as `0.1`. VidFast still posts `PLAYER_EVENT` (play, pause, seeked, ended, timeupdate, playerstatus), `MEDIA_DATA` every 5 seconds, and an undocumented `{ event: "status", data: 404 }` when no server can play a title, which shows "Not Available Right Now". There is no way to set volume; it follows the device. If unmuted autoplay is refused, VidFast falls back to muted playback, and its `muted` field in events looks inverted, so it is not used. Cloudflare blocks headless browsers from vidfast.vc, but plain HTTPS requests with a browser user agent get through, which is how its code was read.

## Where things are

| Item | Location |
| --- | --- |
| Repo | `Finn-Wyll/Finnhub` on GitHub |
| Branches | `main` (production) and `claude/magical-fermi-yxv14o`. Both currently point to the same commit; keep them in sync if you are told to work on the `claude/` branch. GitHub's default branch may still be the `claude/` one, since it was pushed first. |
| Hosting | Cloudflare Workers static assets, using Cloudflare's own Git integration. Every push to `main` builds and deploys. The production URL is in the owner's Cloudflare dashboard. |
| TMDB key | Set as the **build** variable `VITE_TMDB_API_KEY` in Cloudflare (Worker, Settings, Build, Variables and secrets). It is compiled into the client bundle, so it is readable from the page source; that was accepted. Never commit a key to the repo. |
| Cloud sandbox | A personal environment named "Finnhub" allows `api.themoviedb.org`, `image.tmdb.org`, `www.youtube.com`, `www.youtube-nocookie.com`, `i.ytimg.com` and `www.gstatic.com`. YouTube video streams (`*.googlevideo.com`) are still blocked, so embeds load but show a spinner. `vidfast.vc` is not allowed either, so the player stage shows a proxy error page in the sandbox; check real playback in a normal browser. |

## Run, build, test

```bash
npm install
```

```bash
npm run dev          # real TMDB; asks for a key unless VITE_TMDB_API_KEY is set
```

```bash
npm run dev:mock     # offline TMDB stand-in on :4010 plus the app on :5173
```

```bash
npm run build        # tsc -b, then vite build into dist/
```

```bash
npx wrangler dev --port 8788    # serve dist/ the way Cloudflare does (SPA fallback and _headers)
```

There is no unit test suite and no linter installed. The `eslint-disable` comments in the hooks are leftovers; nothing enforces them.

**End-to-end smoke test:** `scripts/e2e.cjs` runs 40 checks against the mock: onboarding and key validation, watchlist, genre and sort in the URL, infinite scroll, search, the `/` shortcut, seasons, the player (against a stand-in for vidfast.vc that behaves like the real one: autoplays, honours startAt, ignores commands, counts clicks), pause, skip and subtitle reloads, no clicks reaching the embed, the unavailable state, resume watching and Continue Watching, the episode sheet, next episode, trailer dialog, theme, and 404. The setup steps are in the comment at the top of the file. It needs Playwright, which is pre-installed in the cloud sandbox but is not a project dependency. All 40 checks passed at the last change.

**Mock details:** `scripts/mock-tmdb.mjs` serves generated SVG artwork and deterministic sample titles (movie ids 1000 to 1089, TV ids 3000 to 3059, people 5000 to 5039). The key `bad` returns 401; any other key is accepted.

## Architecture

```
src/core/        framework-free: models, TMDB client (cache + in-flight dedupe), mappers, storage, watchlist
src/design/      tokens.json, the single source of truth for colours, radii, type and springs
src/lib/         motion.ts (Anime.js springs), format.ts (Intl formatting), env.ts
src/hooks/       useQuery, useInfinite, useEnter, useDocumentTitle
src/components/  UI building blocks; player/ holds the player chrome (buttons, scrubber, menus, episode sheet)
src/routes/      Home, Browse, Title, Person, Search, Watchlist, Settings, Onboarding, Player, NotFound
docs/SWIFT_PORT.md   how each layer maps onto SwiftUI
```

Key decisions:

- **`TmdbClient`** caches by URL for 10 minutes. The shared request is never tied to one caller's `AbortSignal`; callers race it through `withAbort`. Under React StrictMode, an aborted first request had poisoned the cache and left screens stuck loading, and this design is the fix.
- **Domain models** in `core/models.ts` are what the UI consumes. Raw TMDB shapes stay inside `core/tmdb`.
- **Routing:** the player routes sit outside the app shell, so they have no navigation bar. Filters, season and search query live in the URL.
- **Watchlist** is stored in localStorage and synced across tabs.
- **Watch progress** (`core/progress.ts`) uses VidFast's `MEDIA_DATA` shape (`m{id}` / `t{id}` keys, `show_progress` per episode) so its messages merge in directly, newest `last_updated` wins. The player also records from its own `PLAYER_EVENT` reports every 5 seconds, ignoring positions under 10 seconds so a fresh embed reporting 0 cannot erase a resume point. The resume point is read once per episode when it opens, so saving never changes the iframe URL. Under 30 seconds is not worth resuming; 95% (or the last two minutes) counts as finished.

## Design rules in force

The owner asked for four skills to be followed: *design-taste-frontend*, *apple-design*, *animejs* and *web-design-guidelines*. Rules the codebase already follows, which new work should keep:

- **Colour and type:** colours come from tokens only. One amber accent; zinc neutrals; dark and light themes both supported. Geist Variable font, self-hosted.
- **Shape:** controls are pills, cards are 12px, panels are 20px.
- **Icons:** `@phosphor-icons/react` only. No hand-drawn SVG icons.
- **Motion:** Anime.js springs from `src/lib/motion.ts`. Critically damped by default; bounce only after a gesture. Every animation degrades under `prefers-reduced-motion`. Glass surfaces fall back to solid under `prefers-reduced-transparency`.
- **Copy:** no em dashes or en dashes anywhere in the UI. Headings and buttons are in Title Case. Use the ellipsis character, not three dots.
- **Scroll handling:** no window scroll listeners. Use IntersectionObserver instead (see `Rail`, `TopNav`, `QueryRail`).
- **Positioning:** anything with screen-reader-only text inside a horizontal rail needs a positioned ancestor inside the scroll container. Without one, `sr-only` spans escaped the rail and made the page 3000px wide on phones (fixed in `PosterCard` and `Rail`).

## Recent fixes worth knowing

- **Trailers showed a blank player for the owner.** YouTube returns Error 153 ("Video player configuration error") when the browser strips the `Referer` header. The site sends it correctly, which was verified with the production build and headers, so the owner's browser or an extension strips it. The trailer dialog now has a "Watch on YouTube" fallback link. This is not a site bug, so do not chase it further unless it is reproduced in a clean browser.
- **Trailer fullscreen:** YouTube's own button is disabled (`fs=0`) and replaced by a Full Screen button in the dialog's top bar. Esc while fullscreen only exits fullscreen. Side effect: double-click on the video no longer goes fullscreen.
- **Player centring:** the player overlay releases the page's `scrollbar-gutter: stable` while open, which had shifted it 7.5px left. The play glyph has no extra nudge, because Phosphor's `Play` already carries its own optical offset.

## Open items and ideas

None of these are committed to; they are known gaps.

- **Custom trailer controls:** offered to the owner, no answer yet. This would use the YouTube IFrame Player API with `controls=0`, so trailers match the player design.
- **Player:** VidFast's commands and events were built from its documentation and tested only against a stand-in, because the sandbox blocks `vidfast.vc`; confirm them against the real embed. Speed and audio track are not in the API. Keyboard shortcuts stop while focus is inside the embed (only reachable in VidFast-controls mode).
- **Browse grid:** not virtualised. Very long infinite scrolls grow the DOM. `content-visibility` or virtualisation would help.
- **Language and region:** TMDB requests are fixed to `en-US`, and certifications prefer the US. Date and number formatting already follows the browser's locale.
- **Watchlist** is per browser, with no accounts or sync.
- **macOS port:** not started. `docs/SWIFT_PORT.md` holds the plan.
- **Optional security work:** the key is public in the bundle. A small Cloudflare Worker proxy would hide it, and was offered but not requested.
