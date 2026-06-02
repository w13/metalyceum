# Metalyceum

3D social event world with room-based YouTube Live and Google Meet sessions.

## Stack

- **Language/Framework** — TypeScript on Cloudflare Workers (Durable Objects for real-time state)
- **Client 3D** — Three.js r184 via CDN import map (ES module imports)
- **Testing** — Vitest (`vitest run`)
- **Browser/e2e testing** — Playwright (`npm run test:e2e`)
- **Deployment** — Wrangler (`wrangler deploy`)
- **Key deps** — `@cloudflare/workers-types`, `typescript`, `wrangler`, `vitest`, `@playwright/test`, `cannon-es`

## Layout

- `src/` — Worker server code: entry point (`index.ts`), Durable Object (`durable_object.ts`), validation (`validation.ts`), real-time helpers (`realtime.ts`), constants + types (`constants.ts`)
- `public/` — Client SPA: `index.html` (entry point), `app.js` (coordinator), `js/` (engine/state/audio/ui/multiplayer/scenery/physics/Cannon proxy/editor/dev tools/utils), `styles.css`
- `public/_headers` — Edge security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- `wrangler.toml` — Worker config, Durable Object bindings, routes (custom domains), static asset directory

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | `wrangler dev` (local dev server) |
| `npm run deploy` | `wrangler deploy` (publish to Cloudflare) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run typecheck:test` | `tsc --noEmit -p test/tsconfig.json` |
| `npm run test` | `vitest run` |
| `npm run test:e2e` | `playwright test` |

No lint or format scripts are configured.

## Conventions

- **Test files** — `*.test.ts` colocated with source in `src/` (e.g. `src/validation.test.ts`, `src/realtime.test.ts`)
- **Validation module** — `src/validation.ts` contains pure functions only (no `cloudflare:workers` imports), so they're unit-testable outside the Workers runtime and reused across Durable Object handlers
- **Constants & types** — centralized in `src/constants.ts` (server config values, shared type definitions, default room seeds)
- **Client modules** — ES6 module entry (`public/app.js`) imports from `public/js/*.js`; Three.js loaded via import map (`<script type="importmap">` in index.html), each file imports `THREE` explicitly
- **Cannon integration** — `public/js/physics-engine.js` is an XZ-only collision proxy. Keep terrain-follow, jump, and gravity in the manual movement path.
- **Security** — CSP delivered via `<meta>` tag in `index.html`; edge headers in `public/_headers` apply to static assets without invoking the Worker

## Watch out for

- `.wrangler/` is auto-generated — never edit manually
- `public/_headers` is the only way to set headers on static asset responses (the Worker doesn't run for those requests)
- `src/validation.ts` must stay free of `cloudflare:workers` imports to remain testable outside the Workers runtime
- Three.js r184 is loaded via `<script type="importmap">` — every file that references THREE.* must have `import * as THREE from 'three'` at the top
- `package.json` still has `three@0.128.x` and `@types/three@0.128.x` for tests/shims; browser runtime version remains the import-map version in `public/index.html`
