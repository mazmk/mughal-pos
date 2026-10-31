# Copilot instructions

Follow the project guidelines in [`AGENTS.md`](../AGENTS.md) at the repository root. It is the single source of truth for architecture rules, IPC conventions, the inventory invariant, and UI/spacing/colour standards.

Key rules in short:

- Renderer never touches Node/SQL/FS; everything goes through `window.api` → IPC. Adding an IPC method means updating `shared/` types, channels, contract, the inlined channel in `electron/preload/preload.ts`, the `electron/ipc` handler, and the Angular core service.
- Never update `products.stock_on_hand` directly; use `recordMovement()` in `electron/services/stock.service.ts`.
- No runtime network access: fonts and icons come from bundled npm packages.
- Tailwind for layout/spacing, Angular Material for components, `--mat-sys-*` / `--app-*` tokens for colour.
- Do not re-enable `inlineCritical` in `angular.json`; the CSP blocks it and the packaged app loses all styles.
