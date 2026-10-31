import { Injectable, inject, signal } from '@angular/core';
import type { NewStockMovement, StockMovement } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<StockMovement[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(productId?: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.stock.list(productId)));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async adjust(input: NewStockMovement): Promise<StockMovement> {
    const result = await this.bridge.unwrap(this.bridge.api.stock.adjust(input));
    await this.refresh();
    return result;
  }
}
