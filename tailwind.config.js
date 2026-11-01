/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  // Prefix utilities with `body` so they out-rank Angular Material's own
  // single-class rules (e.g. `flex gap-3` on <mat-card-content>). Overlays
  // (dialogs, menus) live under <body> too, so they are covered.
  important: 'body',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      // M3 tokens exposed as Tailwind colours: text-primary, border-outline-variant, …
      colors: {
        primary: 'var(--mat-sys-primary)',
        error: 'var(--mat-sys-error)',
        'on-error': 'var(--mat-sys-on-error)',
        outline: 'var(--mat-sys-outline)',
        'outline-variant': 'var(--mat-sys-outline-variant)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
