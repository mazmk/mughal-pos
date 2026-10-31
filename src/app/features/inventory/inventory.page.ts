import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { CategoriesService } from '../../core/services/categories.service';
import { ProductsService } from '../../core/services/products.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

type Filter = 'all' | 'low' | 'out';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MoneyPipe,
  ],
  templateUrl: './inventory.page.html',
})
export class InventoryPage implements OnInit {
  readonly products = inject(ProductsService);
  readonly categories = inject(CategoriesService);

  readonly query = signal('');
  readonly filter = signal<Filter>('all');
  readonly columns = ['sku', 'name', 'category', 'onHand', 'reorder', 'value'] as const;

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    const items = this.products.active();
    return items
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) {
          return false;
        }
        if (f === 'low') return p.reorderLevel > 0 && p.stockOnHand <= p.reorderLevel;
        if (f === 'out') return p.stockOnHand <= 0;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly totals = computed(() => {
    const items = this.products.active();
    const value = items.reduce((sum, p) => sum + p.stockOnHand * p.costPrice, 0);
    const units = items.reduce((sum, p) => sum + p.stockOnHand, 0);
    const low = items.filter((p) => p.reorderLevel > 0 && p.stockOnHand <= p.reorderLevel).length;
    return { value, units, low, total: items.length };
  });

  categoryName(id: number | null): string {
    if (id == null) return '—';
    return this.categories.byId().get(id)?.name ?? '—';
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.products.refresh(), this.categories.refresh()]);
  }
}
