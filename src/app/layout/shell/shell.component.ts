import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, skip } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { NAV_ITEMS } from '../navigation';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navItems = NAV_ITEMS;
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);
  readonly themeMode = this.theme.mode;

  /** Product brand (sidebar) — white wordmark variant on dark surfaces. */
  readonly brandLogo = computed(() =>
    this.theme.isDark()
      ? 'brand/logo-horizontal-dark-transparent.svg'
      : 'brand/logo-horizontal-light.svg'
  );
  /** Shop identity (toolbar), editable in Settings. */
  readonly shopName = this.settings.shopName;
  readonly shopLogo = computed(() => this.settings.shopLogo() || 'brand/symbol-color.svg');

  /**
   * Below 1200px the sidebar becomes an overlay drawer so small windows /
   * low-res screens keep the full width for content. 1200 covers the common
   * low-end case: a 1366x768 laptop at 125% scaling is ~1093px wide.
   */
  readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 1199.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );
  readonly sidenavOpen = signal(true);

  constructor() {
    // Docked when wide, hidden when compact; re-evaluated whenever the window crosses the breakpoint.
    effect(() => this.sidenavOpen.set(!this.compact()));

    // After changing page, Tab starts in that page, not back in the sidebar.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed()
      )
      .subscribe(() => this.focusMain());
  }

  focusMain(): void {
    this.main().nativeElement.focus();
  }

  toggleSidenav(): void {
    this.sidenavOpen.update((v) => !v);
  }

  onNavigate(): void {
    if (this.compact()) this.sidenavOpen.set(false);
  }

  cycleTheme(): void {
    const next: Record<ThemeMode, ThemeMode> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    const mode = next[this.themeMode()];
    this.theme.setMode(mode);
    // Persist like the Settings page does, so the choice survives a restart.
    void this.settings.set('theme.mode', mode).catch(() => undefined);
  }

  themeIcon(): string {
    switch (this.themeMode()) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      default:
        return 'contrast';
    }
  }
}
