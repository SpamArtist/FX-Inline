# Currency Conversion Extension

This repository now contains:

- Browser extension (WXT + React)
- Standalone marketing website (Vite static site)

## Project Layout

- `apps/extension/` -> extension app (assets, components, entrypoints, hooks, utils, tests)
- `apps/website/` -> standalone public website (HTML/CSS/JS + Vite config)
- `docs/` -> roadmap + QA/security runbooks

## Commands

- `npm run dev` -> extension development
- `npm run build` -> extension build
- `npm run dev:website` -> local website development server
- `npm run build:website` -> website production build to `dist/website/`
- `npm run preview:website` -> preview built website
- `npm run compile` -> TypeScript check
- `npm run test:unit` -> unit tests

## Important Notes

- Extension rate fetching is client-side only (public FX providers).
