import { Injectable, inject, signal } from '@angular/core';
import type { NewSale, Sale } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Sale[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.sales.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewSale): Promise<Sale> {
    const result = await this.bridge.unwrap(this.bridge.api.sales.create(input));
    await this.refresh();
    return result;
  }

  async void(id: number): Promise<Sale> {
    const result = await this.bridge.unwrap(this.bridge.api.sales.void(id));
    await this.refresh();
    return result;
  }
}
