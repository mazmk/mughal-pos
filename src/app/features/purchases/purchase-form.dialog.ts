import { CommonModule } from '@angular/common';
import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { NewPurchase } from '../../../../shared/ipc-types';
import { ProductsService } from '../../core/services/products.service';
import { SuppliersService } from '../../core/services/suppliers.service';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-purchase-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MoneyPipe,
    SubmitFormDirective,
  ],
  templateUrl: './purchase-form.dialog.html',
})
export class PurchaseFormDialog implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  readonly suppliers = inject(SuppliersService);
  readonly products = inject(ProductsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly form = this.fb.group({
    supplierId: this.fb.control<number | null>(null),
    reference: [''],
    purchasedAt: [new Date(), Validators.required],
    notes: [''],
    items: this.fb.array<FormGroup>([]),
  });

  readonly total = computed(() => {
    // reads form value signal via valueChanges would be async; compute from raw
    const items = this.form.controls.items.controls as FormGroup[];
    return items.reduce((sum, g) => {
      const q = Number(g.controls['quantity'].value) || 0;
      const c = Number(g.controls['unitCost'].value) || 0;
      return sum + q * c;
    }, 0);
  });

  constructor(public ref: MatDialogRef<PurchaseFormDialog, NewPurchase>) {}

  ngOnInit(): void {
    if (this.suppliers.items().length === 0) void this.suppliers.refresh();
    if (this.products.items().length === 0) void this.products.refresh();
    this.addItem();
  }

  get itemsArray(): FormArray<FormGroup> {
    return this.form.controls.items;
  }

  addItem(): void {
    this.itemsArray.push(
      this.fb.group({
        productId: this.fb.control<number | null>(null, Validators.required),
        quantity: [1, [Validators.required, Validators.min(0.0001)]],
        unitCost: [0, [Validators.required, Validators.min(0)]],
      })
    );
  }

  addLine(): void {
    this.addItem();
    this.focusLine(this.itemsArray.length - 1);
  }

  removeItem(i: number): void {
    this.itemsArray.removeAt(i);
    if (this.itemsArray.length === 0) this.addItem();
    this.focusLine(Math.min(i, this.itemsArray.length - 1));
  }

  /** Adding or removing a row must not drop keyboard focus out of the list. */
  private focusLine(i: number): void {
    afterNextRender(
      () => this.host.nativeElement.querySelectorAll<HTMLElement>('.line-product')[i]?.focus(),
      { injector: this.injector }
    );
  }

  onProductPicked(group: FormGroup): void {
    const id = group.controls['productId'].value as number | null;
    if (id == null) return;
    const product = this.products.byId().get(id);
    if (!product) return;
    if (!group.controls['unitCost'].value) {
      group.controls['unitCost'].setValue(product.costPrice);
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    const date = v.purchasedAt instanceof Date ? v.purchasedAt : new Date(v.purchasedAt);
    const purchasedAt = date.toISOString();
    const items = this.itemsArray.controls.map((g) => ({
      productId: g.controls['productId'].value as number,
      quantity: Number(g.controls['quantity'].value),
      unitCost: Number(g.controls['unitCost'].value),
    }));
    this.ref.close({
      supplierId: v.supplierId,
      reference: v.reference?.trim() || null,
      purchasedAt,
      notes: v.notes?.trim() || null,
      items,
    });
  }
}
