import { Injectable, computed, inject, signal } from '@angular/core';
import type { Category, CategoryPatch, NewCategory } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly byId = computed(() => {
    const map = new Map<number, Category>();
    for (const c of this.items()) map.set(c.id, c);
    return map;
  });

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.categories.list()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewCategory): Promise<Category> {
    const created = await this.bridge.unwrap(this.bridge.api.categories.create(input));
    await this.refresh();
    return created;
  }

  async update(id: number, patch: CategoryPatch): Promise<Category> {
    const updated = await this.bridge.unwrap(this.bridge.api.categories.update(id, patch));
    await this.refresh();
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.categories.remove(id));
    await this.refresh();
  }
}
