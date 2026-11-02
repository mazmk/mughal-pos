import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Product } from '../../../../shared/ipc-types';
import { CategoriesService } from '../../core/services/categories.service';
import { ProductsService } from '../../core/services/products.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProductFormDialog } from './product-form.dialog';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MoneyPipe,
  ],
  templateUrl: './products.page.html',
})
export class ProductsPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly svc = inject(ProductsService);
  readonly categories = inject(CategoriesService);

  readonly columns = [
    'sku',
    'name',
    'category',
    'unitPrice',
    'costPrice',
    'status',
    'actions',
  ] as const;

  readonly query = signal('');
  readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const items = this.svc.items();
    const matched = q
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode?.toLowerCase().includes(q) ?? false)
        )
      : items;
    const s = this.sort();
    if (!s.active || !s.direction) return matched;
    const dir = s.direction === 'asc' ? 1 : -1;
    const field = s.active;
    return [...matched].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[field];
      const bv = (b as unknown as Record<string, unknown>)[field];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  categoryName(id: number | null): string {
    if (id == null) return '—';
    return this.categories.byId().get(id)?.name ?? '—';
  }

  ngOnInit(): void {
    void this.svc.refresh();
    void this.categories.refresh();
  }

  onSort(sort: Sort): void {
    this.sort.set(sort);
  }

  async create(): Promise<void> {
    const ref = this.dialog.open(ProductFormDialog, { data: null, width: '640px' });
    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;
    try {
      await this.svc.create(input);
      this.snack.open('Product created', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async edit(p: Product): Promise<void> {
    const ref = this.dialog.open(ProductFormDialog, { data: p, width: '640px' });
    const patch = await firstValueFrom(ref.afterClosed());
    if (!patch) return;
    try {
      await this.svc.update(p.id, patch);
      this.snack.open('Product updated', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async remove(p: Product): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete product?',
        message: `Delete "${p.name}"? It will no longer appear in the shop. Past sales keep it, and its SKU and barcode can be used again.`,
        destructive: true,
        confirmLabel: 'Delete',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.remove(p.id);
      this.snack.open('Product deleted', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }
}
