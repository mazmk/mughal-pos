import { Injectable, inject, signal } from '@angular/core';
import type { BackupInfo } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<BackupInfo[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.backup.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<BackupInfo> {
    this.creating.set(true);
    try {
      const info = await this.bridge.unwrap(this.bridge.api.backup.create());
      await this.refresh();
      return info;
    } finally {
      this.creating.set(false);
    }
  }
}
