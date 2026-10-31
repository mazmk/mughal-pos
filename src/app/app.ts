import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsService } from './core/services/settings.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App implements OnInit {
  // Instantiate ThemeService at bootstrap so system theme is picked up.
  private readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);

  async ngOnInit(): Promise<void> {
    // Settings drive the money pipe + theme preference. Fire-and-forget — the
    // bridge service tolerates being called outside Electron (plain browser).
    try {
      await this.settings.refresh();
      const mode = this.settings.value('theme.mode', 'system');
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        this.theme.setMode(mode);
      }
    } catch {
      // noop — surfaces as settings.error signal if callers care.
    }
  }
}
