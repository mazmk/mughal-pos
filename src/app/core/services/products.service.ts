import { Injectable, computed, inject, signal } from '@angular/core';
import type { NewProduct, Product, ProductPatch } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly active = computed(() => this.items().filter((p) => p.isActive === 1));
  readonly byId = computed(() => {
    const map = new Map<number, Product>();
    for (const p of this.items()) map.set(p.id, p);
    return map;
  });

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.products.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewProduct): Promise<Product> {
    const created = await this.bridge.unwrap(this.bridge.api.products.create(input));
    await this.refresh();
    return created;
  }

  async update(id: number, patch: ProductPatch): Promise<Product> {
    const updated = await this.bridge.unwrap(this.bridge.api.products.update(id, patch));
    await this.refresh();
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.products.remove(id));
    await this.refresh();
  }
}
