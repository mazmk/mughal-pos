import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
  NewStockMovement,
  StockMovementReason,
} from '../../../../shared/ipc-types';
import { ProductsService } from '../../core/services/products.service';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';

const REASONS: readonly { value: StockMovementReason; label: string }[] = [
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'opening', label: 'Opening stock' },
  { value: 'damage', label: 'Damage / loss' },
  { value: 'return', label: 'Customer return' },
  { value: 'restock', label: 'Restock' },
];

@Component({
  selector: 'app-stock-adjust-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    SubmitFormDirective,
  ],
  template: `
    <h2 mat-dialog-title>Record stock movement</h2>
    <mat-dialog-content>
      <form id="stock-form" [formGroup]="form" (appSubmit)="save()" class="grid gap-3 pt-2 sm:grid-cols-2">
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>Product</mat-label>
          <mat-select formControlName="productId">
            @for (p of products.active(); track p.id) {
              <mat-option [value]="p.id">{{ p.sku }} — {{ p.name }} (on hand: {{ p.stockOnHand }})</mat-option>
            }
          </mat-select>
          <mat-error>Choose a product</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Reason</mat-label>
          <mat-select formControlName="reason">
            @for (r of reasons; track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Quantity</mat-label>
          <input matInput type="number" step="1" formControlName="quantity" />
          <mat-hint>Positive = add stock, negative = remove</mat-hint>
          <mat-error>Enter a quantity other than 0</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>Note</mat-label>
          <input matInput formControlName="note" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" type="submit" form="stock-form">Record</button>
    </mat-dialog-actions>
  `,
})
export class StockAdjustDialog implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  readonly products = inject(ProductsService);
  readonly reasons = REASONS;

  readonly form = this.fb.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    reason: this.fb.control<StockMovementReason>('adjustment', Validators.required),
    quantity: [0, [Validators.required, (c: AbstractControl) => (Number(c.value) === 0 ? { zero: true } : null)]],
    note: [''],
  });

  constructor(public ref: MatDialogRef<StockAdjustDialog, NewStockMovement>) {}

  ngOnInit(): void {
    if (this.products.items().length === 0) void this.products.refresh();
  }

  save(): void {
    const v = this.form.getRawValue();
    if (v.productId == null || !Number.isFinite(v.quantity) || v.quantity === 0) return;
    this.ref.close({
      productId: v.productId,
      reason: v.reason,
      quantity: Number(v.quantity),
      note: v.note?.trim() || null,
    });
  }
}
