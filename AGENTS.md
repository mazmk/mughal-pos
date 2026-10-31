# AGENTS.md — Mughal POS

Single source of truth for AI coding agents (Claude Code, Codex, Gemini CLI,
Copilot, Cursor, …). Tool-specific files (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`) only point here — edit this file, not them.

Humans: see `README.md` for setup and architecture diagrams.

---

## 1. What this is

Offline-first desktop Point of Sale for small tuck shops.

- **Angular 20** renderer (standalone components, signals, strict TS) + **Angular Material 20 (M3)** + **Tailwind 3** (layout utilities only)
- **Electron 33** shell, **SQLite** via `better-sqlite3` in the main process
- Packaged with `electron-builder` to `.exe` (NSIS) and `.dmg`
- Runs on shop counters with **no internet** and in **brightly lit** rooms

Two non-negotiables follow from that:

1. **Nothing may load from the network at runtime.** No CDNs, no Google Fonts, no remote images, no analytics. Fonts and icons come from npm packages bundled by the Angular build.
2. **UI must stay readable under glare.** Prefer clear borders and solid contrast over subtle tints, low opacity, or hairline differences.

---

## 2. Commands

| Task | Command |
| --- | --- |
| Dev (Angular + Electron, hot reload) | `npm run electron:dev` |
| Angular only, in a browser (no `window.api`) | `npm start` |
| Production renderer build | `npm run build` |
| Compile Electron TS | `npm run build:electron` |
| Package Windows installer | `npm run electron:build:win` |
| DB smoke test | `npm run smoke:db` |
| IPC smoke test (boots real app) | `npm run smoke:ipc` |
| End-to-end smoke | `npm run smoke:full` |
| Format | `npm run format` |

There are no unit tests or ESLint config yet. Verify changes with
`npm run build` + `npm run build:electron` at minimum, and a smoke script when
touching Electron/DB code. Smoke scripts use the real user-data folder; never
run them against a shop's live database.

If `electron .` crashes with `Cannot read properties of undefined (reading 'on')`,
`ELECTRON_RUN_AS_NODE=1` leaked from the IDE — unset it.

---

## 3. Layout

```
electron/      main process: lifecycle, IPC handlers, services, SQLite
  main/        main.ts (window, security), paths.ts (user-data layout)
  preload/     preload.ts — the ONLY bridge the renderer sees
  ipc/         <domain>.ipc.ts — validate input, call a service/repository
  services/    repositories (*.repository.ts) and business logic (*.service.ts)
  database/    connection, migration runner, migrations/NNN_name.ts
shared/        types + contract used by BOTH sides (no runtime deps)
  ipc-channels.ts  ipc-types.ts  api-contract.ts
src/app/
  core/services/   one Angular service per domain, wraps window.api
  layout/          shell (sidenav + toolbar), navigation.ts
  features/<name>/ <name>.page.{ts,html,scss}, *.dialog.ts
  shared/          reusable components and pipes (e.g. money pipe)
src/styles.scss, src/styles/_theme.scss   global styles + M3 theme
```

---

## 4. Architecture rules (do not break)

### Process boundary
- Renderer never touches Node, SQL, or the filesystem. Everything goes through `window.api` → IPC → main.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` stay on. Do not loosen the CSP in `src/index.html` (`script-src 'self'`; no inline scripts or inline event handlers).
- No arbitrary SQL over IPC — only named repository/service methods.

### Adding or changing an IPC method — touch ALL of these
1. `shared/ipc-types.ts` — DTOs (JSON-safe, booleans stored as `0 | 1` to mirror SQLite).
2. `shared/ipc-channels.ts` — channel name `'<domain>:<action>'`.
3. `shared/api-contract.ts` — method on `MughalApi`.
4. `electron/preload/preload.ts` — **inlined** channel string (sandboxed preload cannot import `shared/`; keep the names in sync by hand).
5. `electron/ipc/<domain>.ipc.ts` — register via `handle()` from `ipc-wrapper.ts`; validate every argument with `assertNumber/assertString/assertObject` or a `parseX()` helper before touching the DB.
6. `electron/ipc/index.ts` — register the module if it is new.
7. `src/app/core/services/<domain>.service.ts` — call through `ElectronBridgeService.unwrap()`.

Handlers return data or throw; `handle()` converts to `{ ok, data } | { ok: false, error }`. Never return error objects manually.

### Inventory invariant
`products.stock_on_hand` is a cache. **Never UPDATE it directly.** Every stock
delta goes through `electron/services/stock.service.ts > recordMovement()`
which writes the `stock_movements` ledger row and the cache in one
transaction. Sales, purchases, adjustments, returns all use it.

### Database
- Schema changes = a new file `electron/database/migrations/NNN_description.ts`, appended to the array in `migrations.ts`. Never edit an applied migration.
- Multi-statement writes run inside `db.transaction(...)`.
- Always parameterized statements (`?`), never string-built SQL with user input.
- Money is stored and computed as numbers today; round for display with the `money` pipe, do not round in storage.
- User data lives under `<userData>/TuckShop/` (see `electron/main/paths.ts`). Store relative paths for files inside it so the folder stays portable.

---

## 5. Angular conventions

- Standalone components only, lazy-loaded per route (`app.routes.ts`). Hash routing is required (`file://` in production).
- State in **signals** (`signal`, `computed`, `effect`); services expose `items`, `loading`, `error` signals and an async `refresh()`.
- Use `inject()` in new code. Business logic in services; pages stay thin.
- Control flow: `@if`, `@for` (always with `track`), `@switch`. No `*ngIf`/`*ngFor` in new templates.
- Forms: reactive forms in dialogs (`FormBuilder().nonNullable`); trim strings and map empty to `null` before sending.
- Destructive actions confirm via `shared/components/confirm-dialog`.
- Strict TS: no `any`, no non-null `!` to silence errors you could handle.
- Paths aliases exist (`@shared/*`, `@core/*`, …) but existing code uses relative imports — stay consistent within a file.

---

## 6. UI and styling rules

### Who styles what
- **Angular Material** owns components (buttons, fields, tables, dialogs, cards, chips).
- **Tailwind** owns layout and spacing (`flex`, `grid`, `gap-*`, `p-*`, `m-*`, widths, text size/weight).
- **Theme tokens** own colour. Use `var(--mat-sys-*)` or the app tokens in `_theme.scss` — never hard-coded hex in components.

Tailwind is configured with `important: 'body'` so utilities beat Material's
own single-class defaults (e.g. `class="flex gap-3"` on `<mat-card-content>`
works). `preflight` is off; a minimal border reset lives in `styles.scss`.
If a Material rule still wins, use the `!` prefix (`!p-0`) rather than
writing `::ng-deep` overrides.

Tailwind colour utilities mapped to M3 tokens: `primary`, `error`, `outline`,
`outline-variant` (e.g. `text-primary`, `border-outline-variant`,
`divide-outline-variant`). Add new mappings in `tailwind.config.js`, not ad-hoc CSS.

### Spacing scale (keep pages consistent)
| Where | Use |
| --- | --- |
| Page root | `flex flex-col gap-6` |
| Page header (title + primary action) | `flex items-start justify-between gap-4` |
| Grid of cards | `grid gap-4` |
| Card content padding | Material default (16px); stat cards `!p-5` |
| Stack inside a card | `flex flex-col gap-4` |
| Form layout | `grid gap-x-4 gap-y-2` — form fields already reserve space below for hints/errors |
| Row of buttons / chips | `flex flex-wrap gap-2` (or `gap-3` for primary actions) |
| Icon + label inline | `flex items-center gap-2` |
| Lists (`ul`) | always `list-none m-0 p-0` + a gap or `divide-y divide-outline-variant` |

Never place two interactive controls, or a control and a container edge,
with zero gap. Every new container gets explicit spacing.

### Surfaces and contrast (bright-light environment)
- Page background: `--mat-sys-background`. Cards and tiles: `--app-card` with a visible `--app-card-border` (set globally for `mat-card`, tables are transparent so they inherit the card).
- Do not rely on background tint alone to separate surfaces; keep the border.
- Avoid `opacity-*` below `opacity-70` for text. Secondary text: `opacity-70`/`opacity-80` or `--mat-sys-on-surface-variant`.
- Status colours must carry meaning without colour too (icon or text label).
- Touch targets ≥ 40px tall on POS screens; cashiers use mice and touchscreens.

### Icons and fonts
- Icons: `<mat-icon>name</mat-icon>` (Material Icons ligature font from the `material-icons` npm package, **filled** set only). Use names from https://fonts.google.com/icons?icon.set=Material+Icons. Do not add `material-symbols`, icon CDNs, or SVG icons fetched at runtime; register local SVGs with `MatIconRegistry` + `DomSanitizer` if a custom icon is ever needed.
- Fonts: Roboto from `@fontsource/roboto`. New fonts must come from an npm package, imported in `styles.scss`.
- Production builds have `optimization.styles.inlineCritical: false` in `angular.json`. **Do not re-enable it.** Critical-CSS inlining loads the stylesheet with an inline `onload` handler, which the CSP blocks, so the packaged app renders with no styles and icons show as text.

---

## 7. Working agreements for agents

- Read the surrounding code first and match its naming, comment density, and idioms.
- Keep changes scoped to the request. Mention unrelated problems instead of fixing them silently.
- After UI changes, build the production bundle and check it in Electron (not only `ng serve`); dev mode does not reproduce production CSS behaviour.
- Never commit `dist/`, `dist-electron/`, `release/`, databases, or backups.
- Do not add runtime network dependencies, telemetry, or auto-update endpoints without an explicit request.
- Do not add packages for things a few lines of code can do. Anything `require`d at runtime by Electron main/preload (e.g. `better-sqlite3`) must be in `dependencies`; electron-builder packages those into the installer.
- Commit messages: conventional style (`feat:`, `fix:`, `chore:`, …).
