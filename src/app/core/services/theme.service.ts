import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('system');
  private readonly media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly systemPrefersDark = signal(this.media?.matches ?? false);

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));

    effect(() => {
      const mode = this.mode();
      const dark = mode === 'dark' || (mode === 'system' && this.systemPrefersDark());
      document.documentElement.classList.toggle('dark-theme', dark);
      document.documentElement.classList.toggle('dark', dark);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
