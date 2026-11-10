# Finnhub: notes for agents

React + Vite + Tailwind film/series browser on TMDB. See `README.md` for scripts and structure.

## Required design skills

Before you design, restyle or animate any UI (new components, layout changes, motion, copy on screen), load and apply all four of these skills with the Skill tool, and check your change against each one before you commit:

1. `anthropic-skills:design-taste-frontend`: design read, anti-slop rules, pre-flight check (no em-dashes in UI copy, one accent, one radius system, real loading/empty/error states).
2. `anthropic-skills:web-design-guidelines`: run it on the files you changed (`file:line` review). Links for navigation, labelled icon buttons, focus-visible, safe areas, no `transition: all`.
3. `anthropic-skills:apple-design`: springs, interruptible motion, symmetric enter/exit paths, materials, size-specific tracking.
4. `anthropic-skills:animejs`: this project animates with Anime.js v4, not Motion/Framer Motion. Do not add another animation library.

## Project conventions that come from those skills

- **Motion:** use the helpers in `src/lib/motion.ts` (`springs`, `enter`, `materialize`, `dematerialize`, `prefersReducedMotion`). Critically damped by default; bounce only after a gesture. Every animation needs a reason (feedback or state change) and a reduced-motion cross-fade. Revert animations in effect cleanups.
- **Tokens:** `src/design/tokens.json` is the source of truth; `src/styles/index.css` mirrors it as CSS variables. Zinc neutrals, single amber accent, light and dark.
- **Shape:** interactive controls are pills, media cards 12px, panels 20px.
- **Glass:** `.glass` / `.glass-dark` are web approximations of Apple materials with `prefers-reduced-transparency` fallbacks.
- **Icons:** `@phosphor-icons/react` only.
- **Press feedback:** add the `.press` class to buttons and button-like links.

## Player

`src/routes/Player.tsx` embeds `https://vidfast.vc/movie/{id}` and `https://vidfast.vc/tv/{id}/{season}/{episode}` (always `autoPlay=true`). VidFast ignores its documented playback commands and clicks inside it open ad pop-ups, so the embed must never receive pointer events, focus or screen-reader access, and must not be sandboxed (it refuses to run). Its own keys (Space, arrows, M, F) work and never trigger ads, so the player gives it keyboard focus while it plays; synthetic keys cannot be sent into it. Playback from our buttons is driven by reloading the embed with `startAt` (see the "session" logic in Player.tsx; `docs/HANDOFF.md` has the details). Only show state the embed reported, and check `event.origin` against the VidFast domains (`src/lib/vidfast.ts`). Add `?debug=player` to a watch URL to log its messages. Watch progress lives in `src/core/progress.ts` (VidFast's `MEDIA_DATA` shape); use `useContinue()` for any Play button so it resumes. `scripts/e2e.cjs` stubs vidfast.vc with a fake that behaves like the real embed.

## Before committing

`npm run build` (type-checks and builds). For UI changes, also run the smoke test `scripts/e2e.cjs` (setup steps are in its header comment).
