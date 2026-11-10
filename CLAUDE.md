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

`src/routes/Player.tsx` embeds `https://vidfast.vc/movie/{id}?autoPlay=true` and `https://vidfast.vc/tv/{id}/{season}/{episode}?autoPlay=true` in an iframe. The embed brings its own controls, so keep our chrome out of the stage (the top bar sits above it, not over it).

## Before committing

`npm run build` (type-checks and builds). There is no test suite.
