import { Injectable, inject, signal } from '@angular/core';
import type {
  BackupCheck,
  BackupCurrentState,
  BackupInfo,
  RestoreResult,
} from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<BackupInfo[]>([]);
  readonly current = signal<BackupCurrentState | null>(null);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [items, current] = await Promise.all([
        this.bridge.unwrap(this.bridge.api.backup.list()),
        this.bridge.unwrap(this.bridge.api.backup.current()),
      ]);
      this.items.set(items);
      this.current.set(current);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(note: string | null = null): Promise<BackupInfo> {
    this.creating.set(true);
    try {
      const info = await this.bridge.unwrap(this.bridge.api.backup.create(note));
      await this.refresh();
      return info;
    } finally {
      this.creating.set(false);
    }
  }

  async verify(filename: string): Promise<BackupCheck> {
    const check = await this.bridge.unwrap(this.bridge.api.backup.verify(filename));
    await this.refresh();
    return check;
  }

  /** Callers should reload the app afterwards — every cached signal is stale. */
  restore(filename: string): Promise<RestoreResult> {
    return this.bridge.unwrap(this.bridge.api.backup.restore(filename));
  }

  async import(): Promise<BackupInfo | null> {
    const info = await this.bridge.unwrap(this.bridge.api.backup.import());
    if (info) await this.refresh();
    return info;
  }

  export(filename: string): Promise<string | null> {
    return this.bridge.unwrap(this.bridge.api.backup.export(filename));
  }

  async remove(filename: string): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.backup.remove(filename));
    await this.refresh();
  }

  openFolder(): Promise<void> {
    return this.bridge.unwrap(this.bridge.api.backup.openFolder());
  }
}
