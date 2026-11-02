import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
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
import type {
  NewSaleItem,
  PaymentMethod,
  Product,
} from '../../../../shared/ipc-types';
import { ProductsService } from '../../core/services/products.service';
import { SalesService } from '../../core/services/sales.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

interface CartLine {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MoneyPipe,
  ],
  templateUrl: './pos.page.html',
  styleUrl: './pos.page.scss',
  host: { '(document:keydown)': 'onShortcut($event)' },
})
export class PosPage implements OnInit, AfterViewInit {
  readonly products = inject(ProductsService);
  readonly sales = inject(SalesService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly productGrid = viewChild<ElementRef<HTMLElement>>('productGrid');

  readonly search = signal('');
  readonly cart = signal<CartLine[]>([]);
  readonly discount = signal(0);
  readonly paymentMethod = signal<PaymentMethod>('cash');
  readonly notes = signal('');
  readonly submitting = signal(false);

  readonly paymentOptions: readonly { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: 'Cash', icon: 'payments' },
    { value: 'card', label: 'Card', icon: 'credit_card' },
    { value: 'credit', label: 'Credit', icon: 'account_balance_wallet' },
    { value: 'other', label: 'Other', icon: 'more_horiz' },
  ];

  readonly filteredProducts = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.products.active();
    if (!q) return items.slice(0, 100);
    return items
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 100);
  });

  /**
   * Tiles are one Tab stop, moved between with the arrow keys (onGridKeydown),
   * or the cart would be up to 100 Tab presses away.
   */
  readonly activeTileId = signal<number | null>(null);
  readonly tabbableTileId = computed(() => {
    const tiles = this.filteredProducts();
    return (tiles.find((p) => p.id === this.activeTileId()) ?? tiles[0])?.id ?? null;
  });

  readonly subtotal = computed(() =>
    this.cart().reduce((sum, l) => sum + l.product.unitPrice * l.quantity, 0)
  );
  readonly tax = computed(() =>
    this.cart().reduce((sum, l) => sum + l.product.unitPrice * l.quantity * l.product.taxRate, 0)
  );
  readonly total = computed(() =>
    Math.max(0, this.subtotal() + this.tax() - this.discount())
  );

  async ngOnInit(): Promise<void> {
    await this.products.refresh();
  }

  ngAfterViewInit(): void {
    this.focusSearch();
  }

  onShortcut(event: KeyboardEvent): void {
    if (this.dialog.openDialogs.length > 0) return;
    if (event.key === 'F2') {
      event.preventDefault();
      this.focusSearch();
    } else if (event.key === 'F9') {
      event.preventDefault();
      void this.checkout();
    }
  }

  /**
   * A barcode scanner types the code then presses Enter, so an exact barcode or
   * SKU always wins. Several partial matches move to the first tile to pick from.
   */
  onSearchEnter(): void {
    const query = this.search().trim().toLowerCase();
    if (!query) return;

    const exact = this.products
      .active()
      .find((p) => p.barcode?.toLowerCase() === query || p.sku.toLowerCase() === query);
    const matches = this.filteredProducts();
    const match = exact ?? (matches.length === 1 ? matches[0] : null);
    if (match) {
      this.addToCart(match);
      this.search.set('');
    } else if (matches.length > 0) {
      this.tiles()[0]?.focus();
    } else {
      this.snack.open(`No product matches "${this.search().trim()}"`, 'OK', { duration: 2500 });
      this.searchInput().nativeElement.select();
    }
  }

  focusFirstTile(event: Event): void {
    const first = this.tiles()[0];
    if (!first) return;
    event.preventDefault();
    first.focus();
  }

  onGridKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.focusSearch();
      return;
    }
    const grid = event.currentTarget as HTMLElement;
    const tiles = this.tiles();
    const index = tiles.indexOf(event.target as HTMLButtonElement);
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
      Home: -index,
      End: tiles.length - 1 - index,
    };
    const move = moves[event.key];
    if (index < 0 || move === undefined) return;

    event.preventDefault();
    if (event.key === 'ArrowUp' && index < columns) {
      this.focusSearch();
      return;
    }
    tiles[Math.max(0, Math.min(tiles.length - 1, index + move))].focus();
  }

  private tiles(): HTMLButtonElement[] {
    const grid = this.productGrid()?.nativeElement;
    return grid ? [...grid.querySelectorAll<HTMLButtonElement>('.product-tile')] : [];
  }

  private focusSearch(): void {
    const input = this.searchInput().nativeElement;
    input.focus();
    input.select();
  }

  addToCart(product: Product): void {
    const current = this.cart();
    const existing = current.find((l) => l.product.id === product.id);
    if (existing) {
      this.updateLine(existing, existing.quantity + 1);
    } else {
      this.cart.set([...current, { product, quantity: 1 }]);
    }
  }

  changeQuantity(line: CartLine, delta: number): void {
    const next = line.quantity + delta;
    if (next <= 0) {
      this.remove(line);
      return;
    }
    this.updateLine(line, next);
  }

  /**
   * Typing in the quantity box. A blank or zero box is left alone while the
   * cashier is still typing; leaving it (commitQuantity) puts the last good
   * value back, so a line is only ever removed with its × button.
   */
  typeQuantity(line: CartLine, value: string): void {
    const qty = parseQuantity(value);
    if (qty !== null) this.updateLine(line, qty);
  }

  commitQuantity(line: CartLine, input: HTMLInputElement): void {
    const qty = parseQuantity(input.value);
    if (qty === null) {
      const current = this.cart().find((l) => l.product.id === line.product.id);
      input.value = String(current?.quantity ?? line.quantity);
    }
  }

  private updateLine(line: CartLine, quantity: number): void {
    this.cart.set(
      this.cart().map((l) => (l.product.id === line.product.id ? { ...l, quantity } : l))
    );
  }

  remove(line: CartLine): void {
    this.cart.set(this.cart().filter((l) => l !== line));
    this.focusSearch();
  }

  clear(): void {
    this.cart.set([]);
    this.discount.set(0);
    this.notes.set('');
    this.focusSearch();
  }

  async checkout(): Promise<void> {
    if (this.cart().length === 0 || this.submitting()) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Complete sale?',
        message: `${this.cart().length} line(s), total ${this.formatTotal()}.`,
        confirmLabel: 'Complete sale',
      },
    });
    const ok = await new Promise<boolean>((resolve) =>
      ref.afterClosed().subscribe((v) => resolve(Boolean(v)))
    );
    if (!ok) return;

    const items: NewSaleItem[] = this.cart().map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
      unitPrice: l.product.unitPrice,
      taxRate: l.product.taxRate,
    }));

    this.submitting.set(true);
    try {
      const sale = await this.sales.create({
        paymentMethod: this.paymentMethod(),
        discountAmount: Number(this.discount()) || 0,
        notes: this.notes().trim() || null,
        items,
      });
      this.snack.open(`Sale ${sale.reference} completed`, 'OK', { duration: 3000 });
      this.clear();
      await this.products.refresh();
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.submitting.set(false);
    }
  }

  /** Enter in a quantity box: done with this line, back to scanning. */
  quantityDone(line: CartLine, input: HTMLInputElement): void {
    this.commitQuantity(line, input);
    this.focusSearch();
  }

  private formatTotal(): string {
    try {
      return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
      }).format(this.total());
    } catch {
      return this.total().toFixed(2);
    }
  }
}

/** A positive quantity, or null for blank, zero, negative or not-a-number input. */
function parseQuantity(value: string): number | null {
  const qty = Number(value);
  return value.trim() !== '' && Number.isFinite(qty) && qty > 0
    ? Math.round(qty * 1000) / 1000
    : null;
}
