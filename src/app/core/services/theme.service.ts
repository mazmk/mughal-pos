import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('system');
  private readonly media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly systemPrefersDark = signal(this.media?.matches ?? false);

  /** Theme actually in effect once `system` is resolved. */
  readonly isDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.systemPrefersDark())
  );

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));

    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark-theme', dark);
      document.documentElement.classList.toggle('dark', dark);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
