# Metalyceum Copilot Instructions

## Commands

```bash
npm run dev        # Start the local Cloudflare Worker with static assets
npm run typecheck  # Type-check the TypeScript worker code
npm test           # Run the full Vitest suite
npm run test -- src/validation.test.ts
npx vitest run src/realtime.test.ts
npx vitest run src/realtime.test.ts -t "shares movement for players in the same room"
npm run test:e2e   # Playwright smoke test with diagnostics artifacts
npm run test:e2e:trace  # Playwright with full traces for large-change debugging
npm run deploy     # Deploy the worker and static assets
```

There is no dedicated lint script in this repository.

## High-level architecture

Metalyceum is one Cloudflare Worker with static frontend assets. `src/index.ts` is a router layer: `/ws` and `/debug` go to one global world Durable Object (`MetalyceumWorld`), `/api/v1/*` goes to a separate admin/auth Durable Object (`AdminDO`), and everything else is served through the `ASSETS` binding.

`src/durable_object.ts` is the real server. The `MetalyceumWorld` Durable Object keeps live session state in memory, persists room events and world assets in Durable Object SQLite storage, and handles all WebSocket message types for join/move/chat, room event updates, and world asset publishing.

`src/admin/do.ts` is a second backend surface for REST-style auth/admin APIs (init/register/login/password reset, account profile/password, admin users/logs/rooms/editor token/broadcast/world state). It stores users/sessions/logs in DO storage and syncs room/broadcast/world actions to `MetalyceumWorld` through internal DO endpoints.

`src/validation.ts` and `src/realtime.ts` are intentionally pure modules with no `cloudflare:workers` imports. Validation, sanitization, and proximity/chat delivery rules live there so they can be covered directly by Vitest.

The client is a browser app served from `public/`. `public/app.js` is the module coordinator, but most client code shares one mutable `state` object from `public/js/state.js`. Real-time sync flows through `public/js/multiplayer.js`, room schedule/video UI through `public/js/room-panel.js`, and the in-world editor through `public/js/editor.js`.

## Key conventions

- Client-side Three.js comes from CDN scripts in `public/index.html` and is used as the global `THREE` object. Do not add npm-based Three.js imports.
- `src/constants.ts` is the source of truth for shared server limits, shared types, and default room seeds. If default room configuration changes, update `ROOMS_CONFIG_VERSION` so persisted room data is re-seeded on deploy.
- Keep `src/validation.ts` and `src/realtime.ts` free of Workers-runtime imports. New logic placed there should stay unit-testable in plain Vitest.
- Static-asset security headers belong in `public/_headers`; Worker response headers belong in `src/index.ts`; the CSP is defined in the `<meta http-equiv="Content-Security-Policy">` tag in `public/index.html`.
- Wrangler routing matters: `wrangler.jsonc` `assets.run_worker_first` controls which paths hit the Worker (`/ws`, `/debug`, `/api/v1/*`). If you add new dynamic/server routes, update both `wrangler.jsonc` and `src/index.ts`.
- The world is intentionally a single global Durable Object, not a sharded/multi-room backend. Changes to session flow or persistence should preserve that assumption unless the architecture is being deliberately redesigned.
- Room data exists on both sides: the Durable Object owns the authoritative room/event state, while the client keeps a local `state.ROOMS` projection that is hydrated from websocket `init` / `rooms_state` messages.
- World asset support is split across server validation/persistence and client rendering/editor code. Adding or changing asset types usually requires coordinated updates in `src/validation.ts`, `src/durable_object.ts`, and `public/js/config.js` / `public/js/editor.js`.
- `src/index.ts` has explicit CORS allowlist handling for `/api/v1/*` (`ALLOWED_ORIGINS`). Update this list when admin UI origins change.

## MCP servers

For browser-level debugging and UI verification, use a Playwright MCP server.

1. Run the app locally with `npm run dev` (Worker + static assets).
2. Use the Playwright MCP server (configured in `.vscode/mcp.json`) and point it to the local app URL from Wrangler output (commonly `http://127.0.0.1:8787`).
3. For large backend/frontend changes, run `npm run test:e2e` to catch shell-load regressions and attach diagnostics (console/page/request failures); rerun with `npm run test:e2e:trace` when you need deeper telemetry.
