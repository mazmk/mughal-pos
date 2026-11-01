# Mughal POS — Tuck Shop Point of Sale

Offline-first cross-platform desktop Point of Sale for tuck shops. Single Angular
codebase packaged with Electron, runs on Windows and macOS, stores all data in
a local SQLite database.

---

## Project overview

- **Fully offline** — no backend server, no network calls at runtime
- **Local SQLite storage** — all business data lives on the device
- **Portable data** — copy the `TuckShop/` folder from the user data directory
  to another machine to migrate
- **Secure IPC** — Angular can only reach SQLite / filesystem through an
  allow-listed, typed `contextBridge` API
- **Future-ready** — scaffolded for barcode scanning, printing, backups,
  reports, and hardware integration

---

## Tech stack

| Layer         | Choice                                             |
| ------------- | -------------------------------------------------- |
| Frontend      | Angular 20 (standalone, signals, strict TS)        |
| UI            | Angular Material 20 (**Material Design 3**)        |
| Styling       | Tailwind CSS 3 (layout only)                       |
| State         | Angular Signals                                    |
| Desktop shell | Electron 33                                        |
| Database      | SQLite via `better-sqlite3` 11                     |
| Packaging     | `electron-builder` 25 (.dmg / .exe)                |
| Tooling       | TypeScript 5.9, Prettier, ESLint, Angular CLI 20   |

> Minimum supported OS versions: **macOS 11+ (Big Sur), Windows 10 1809+**.
> These are the minimums officially supported by Electron 33.

---

## Architecture

### High level

```
┌─────────────────────────┐      contextBridge       ┌───────────────────────┐
│   Angular (renderer)    │  ───── window.api ────▶  │ Electron main process │
│   standalone + signals  │  ◀──── IPC invoke  ────  │   SQLite + FS + ...   │
└─────────────────────────┘                          └───────────────────────┘
            ▲                                                     │
            │ never touches Node, SQL, or FS directly              ▼
                                                       <userData>/TuckShop/
                                                         database/tuckshop.db
                                                         uploads/products/
                                                         backups/
                                                         exports/
                                                         config.json
```

### Angular side

```
src/app/
  core/             app-wide services, guards, interceptors
    services/
      electron-bridge.service.ts   typed IPC wrapper
      health.service.ts            system health signals
      theme.service.ts             M3 light/dark/system
    types/
      window-api.d.ts              ambient declaration for window.api
  shared/           reusable components, pipes, utilities
  layout/           app shell (sidenav + toolbar) and navigation config
  features/
    dashboard/ pos/ products/ categories/ inventory/ stock/
    suppliers/ purchases/ sales/ reports/ settings/
```

Every feature is a lazy-loaded standalone component. Business logic lives in
services; components stay thin.

### Electron side

```
electron/
  main/
    main.ts         app lifecycle, window creation, security defaults
    paths.ts        user-data folder layout
  preload/
    preload.ts      contextBridge — the ONLY surface renderer sees
  database/
    connection.ts   better-sqlite3 connection + pragmas
    migrations.ts   versioned migration runner
    migrations/
      001_initial.ts  initial schema
  ipc/
    ipc-wrapper.ts  centralized handler wrapper (error envelope + validation)
    health.ipc.ts   db version / paths / platform
    settings.ipc.ts key-value settings
    products.ipc.ts product CRUD
    index.ts        registers all handlers at startup
  services/
    stock.service.ts        the ONLY path for stock changes
    products.repository.ts  product repository (CRUD only, no stock writes)
    settings.repository.ts  settings repository
shared/
  ipc-channels.ts   allow-listed channel names
  ipc-types.ts      JSON-safe DTOs crossing the boundary
  api-contract.ts   MughalApi shape exposed on window.api
```

### Inventory invariant

> **Stock quantity is never updated directly.** Every delta flows through
> `services/stock.service.ts > recordMovement()`, which inserts a row in
> `stock_movements` AND updates the cached `products.stock_on_hand` in a single
> transaction. Rebuilding stock from the ledger is possible via
> `rebuildStockCache()`.

Supported movement reasons: `opening`, `sale`, `restock`, `damage`,
`adjustment`, `return`.

### Security defaults

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Content Security Policy locked to `self` + inline styles for Material
- Every IPC input is validated before touching SQLite
- No arbitrary SQL execution — only the repository methods are exposed
- No filesystem access from Angular — only through typed IPC methods
- External navigation / `window.open` is forwarded to the system browser

---

## Folder structure

```
mughal-pos/
├── angular.json
├── electron-builder.yml
├── electron/              Electron main / preload / ipc / services / database
├── shared/                shared types + IPC contract
├── src/                   Angular app
│   ├── app/
│   │   ├── core/
│   │   ├── shared/
│   │   ├── layout/
│   │   └── features/
│   ├── environments/
│   ├── styles/_theme.scss M3 theme (light + dark)
│   ├── styles.scss
│   └── index.html
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json          Angular TS config (paths: @shared, @core, …)
├── tsconfig.app.json
├── tsconfig.electron.json Electron TS build config (compiles to dist-electron/)
└── package.json
```

---

## Installation

```bash
# From repo root
npm install
```

The install downloads the Electron binary (~95 MB from GitHub) and a prebuilt
`better-sqlite3` for the Electron ABI. If your network is slow or GitHub is
unreachable, set an environment variable before installing to use a mirror:

```bash
# Example — Taobao mirror
ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/ npm install
```

If you ever see `NODE_MODULE_VERSION` mismatch or `incompatible architecture`
errors from `better-sqlite3`:

```bash
npm run rebuild:native
```

---

## Development

```bash
npm run electron:dev
```

That single command concurrently:

1. Starts the Angular dev server on **port 4200** with HMR.
2. Compiles `electron/*.ts` to `dist-electron/` and watches for changes.
3. Waits for both to be ready, then launches Electron pointing at `localhost:4200`.

To run only the Angular side in a plain browser (handy for component work —
the health service will show a graceful warning because `window.api` is absent):

```bash
npm run start
```

---

## Building & packaging

```bash
# Angular production bundle
npm run build

# Electron TS → JS
npm run build:electron

# Build + package .dmg + .exe
npm run electron:build

# Platform-specific
npm run electron:build:mac
npm run electron:build:win

# Local dev package (unsigned, platform of the host)
npm run electron:pack
```

Artifacts land in `release/`.

> **Code signing**: `electron-builder.yml` has signing disabled (`identity: null`
> for macOS, no cert for Windows). Add your credentials before shipping to
> external users. Unsigned installers will trigger Gatekeeper / SmartScreen
> warnings but still install.

---

## Database location

| Platform | Path                                                                        |
| -------- | --------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/Mughal POS/TuckShop/database/tuckshop.db`    |
| Windows  | `%APPDATA%\Mughal POS\TuckShop\database\tuckshop.db`                        |
| Linux    | `~/.config/Mughal POS/TuckShop/database/tuckshop.db` (dev only)             |

The whole `TuckShop/` folder is self-contained and uses the exact same layout
across platforms:

```
TuckShop/
├── database/tuckshop.db
├── uploads/products/        product images
├── backups/                 SQLite .bak snapshots
├── exports/                 CSV exports
└── config.json              future user preferences
```

The dashboard shows the live database path at runtime (click **Refresh health**).

---

## Backup strategy

Managed from **Settings → Backups** (`electron/services/backup.service.ts`).

| Type | When | Pruned automatically |
| --- | --- | --- |
| Manual | "Back up now" | Never |
| Automatic | Once a day while the app runs (setting `backup.auto.enabled`) | Keeps last N (`backup.auto.keep`, default 14) |
| Before restore | Automatically, right before any restore — the undo point | Keeps newest 10 |
| Before update | Automatically, before a schema migration runs on existing data | Keeps newest 10 |
| Before clearing | Automatically, right before **Settings → Clear shop** — the undo point | Keeps newest 10 |
| Imported | "Import backup…" from a USB drive / folder | Never |

How a backup is made: SQLite online backup → staging file → converted to a
self-contained file → `integrity_check` + `foreign_key_check` + required
tables → SHA-256 → moved into `TuckShop/backups/` with a `.json` manifest
(type, app + schema version, record counts, checksum). A file that fails any
check is never published.

How a restore runs:

1. Re-verify the backup (checksum, integrity, not from a newer app version).
2. Lock all other IPC (no sale can be written mid-restore).
3. Take a **Before restore** backup of the current data.
4. Copy the backup, upgrade it to the current schema, re-check it.
5. Swap the database file and reopen. If reopening fails, the original file is
   moved back automatically.

To undo a restore, restore the newest **Before restore** backup. Export copies
to a USB drive regularly — backups on the same disk do not survive a disk
failure. The shop logo is stored in the database, so it is part of every backup.

---

## Migration strategy

Moving to a new machine:

1. Install Mughal POS on the new machine and launch it once (to create the user
   data folder with the right permissions).
2. Quit the app on both machines.
3. Copy the entire `TuckShop/` folder from the old machine's user data path to
   the same path on the new machine, overwriting.
4. Relaunch. The migration runner will apply any pending schema updates
   automatically on first boot.

Product images are stored as **relative paths** in SQLite, so moving the folder
preserves them without rewriting rows.

---

## Shell environment gotcha

If Electron crashes immediately with
`TypeError: Cannot read properties of undefined (reading 'on')` from
`main.js:… electron_1.app.on('ready')`, it booted as plain Node because
`ELECTRON_RUN_AS_NODE` is defined. IDE terminals (VS Code / Cursor) leak it as
`1`, and on **Windows** even an empty value counts as set.

`npm run electron:dev` launches Electron through `scripts/electron-dev.js`,
which deletes the variable, so it works from any terminal on Windows and macOS.
A bare `electron .` does not — run `unset ELECTRON_RUN_AS_NODE` (bash) or
`Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) first.

## Cross-platform limitations

- **Native modules**: `better-sqlite3` ships prebuilt binaries for Electron.
  `electron-builder install-app-deps` handles rebuilding automatically. If you
  cross-compile on CI, run the install on the target platform (or use Docker
  for Windows / `--ia32` arches).
- **Fonts & icons**: Roboto and Material Icons are bundled locally
  (`@fontsource/roboto`, `material-icons`) so the app renders correctly offline.
- **File paths**: all paths go through `node:path` — no `/` hardcoded.
- **ARM64 vs x64 macOS**: Both targets are configured in `electron-builder.yml`.
  Universal binary can be enabled later with `arch: ['universal']`.
- **Code signing / notarization** is OFF by default. Users will see unsigned-app
  warnings on first launch. Supply certificates in CI before public release.

---

## npm scripts (quick reference)

| Script                       | What it does                                             |
| ---------------------------- | -------------------------------------------------------- |
| `npm run start`              | Angular dev server (browser-only mode)                   |
| `npm run build`              | Angular production bundle                                |
| `npm run build:electron`     | Compile Electron TS → `dist-electron/`                   |
| `npm run electron:dev`       | Concurrent Angular + Electron dev with hot reload        |
| `npm run electron:build`     | Build Angular + Electron, package `.dmg` and `.exe`      |
| `npm run electron:build:mac` | Build + `.dmg`                                           |
| `npm run electron:build:win` | Build + `.exe`                                           |
| `npm run electron:pack`      | Unsigned, unpackaged test build for current platform     |
| `npm run rebuild:native`     | Rebuild `better-sqlite3` against the current Electron    |
| `npm run smoke:db`           | Headless SQLite layer smoke test                         |
| `npm run smoke:ipc`          | Electron + IPC bridge smoke test                         |
| `npm run smoke:full`         | End-to-end smoke: categories → sale → report → backup    |
| `npm run format`             | Prettier format all source                               |

---

## Database schema (v1)

- `categories` — product categorization
- `suppliers` — vendors
- `products` — SKUs with cached `stock_on_hand`
- `stock_movements` — immutable ledger of every stock change
- `purchases` + `purchase_items` — incoming stock orders
- `sales` + `sale_items` — completed transactions
- `expenses` — misc. shop expenses
- `settings` — key / value store for shop preferences

All tables use `INTEGER PRIMARY KEY AUTOINCREMENT`, foreign-key constraints
(enforced via `PRAGMA foreign_keys = ON`), and `datetime('now')` timestamps.
WAL mode is enabled for better concurrent reads.
