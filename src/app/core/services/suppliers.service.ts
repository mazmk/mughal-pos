import { Injectable, inject, signal } from '@angular/core';
import type { NewSupplier, Supplier, SupplierPatch } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Supplier[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.suppliers.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewSupplier): Promise<Supplier> {
    const created = await this.bridge.unwrap(this.bridge.api.suppliers.create(input));
    await this.refresh();
    return created;
  }

  async update(id: number, patch: SupplierPatch): Promise<Supplier> {
    const updated = await this.bridge.unwrap(this.bridge.api.suppliers.update(id, patch));
    await this.refresh();
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.suppliers.remove(id));
    await this.refresh();
  }
}
