import { Injectable, inject, signal } from '@angular/core';
import type { DashboardMetrics } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.metrics.set(await this.bridge.unwrap(this.bridge.api.dashboard.metrics()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
