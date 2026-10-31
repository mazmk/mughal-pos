import { Injectable, inject, signal } from '@angular/core';
import type { NewPurchase, Purchase } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Purchase[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.purchases.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewPurchase): Promise<Purchase> {
    const result = await this.bridge.unwrap(this.bridge.api.purchases.create(input));
    await this.refresh();
    return result;
  }

  async receive(id: number): Promise<Purchase> {
    const result = await this.bridge.unwrap(this.bridge.api.purchases.receive(id));
    await this.refresh();
    return result;
  }

  async cancel(id: number): Promise<Purchase> {
    const result = await this.bridge.unwrap(this.bridge.api.purchases.cancel(id));
    await this.refresh();
    return result;
  }
}
