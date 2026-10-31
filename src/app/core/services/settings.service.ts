import { Injectable, computed, inject, signal } from '@angular/core';
import type { Setting } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Setting[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly byKey = computed(() => {
    const map = new Map<string, Setting>();
    for (const s of this.items()) map.set(s.key, s);
    return map;
  });

  value(key: string, fallback = ''): string {
    return this.byKey().get(key)?.value ?? fallback;
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.settings.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.settings.set(key, value));
    await this.refresh();
  }
}
