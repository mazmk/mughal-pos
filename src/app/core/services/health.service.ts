import { Injectable, inject, signal } from '@angular/core';
import type { HealthStatus } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly status = signal<HealthStatus | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal<boolean>(false);

  async refresh(): Promise<void> {
    if (!this.bridge.isAvailable()) {
      this.error.set('Electron bridge unavailable (running in browser)');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.bridge.unwrap(this.bridge.api.health.status());
      this.status.set(result);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
