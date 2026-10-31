import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NewProduct, Product } from '../../../../shared/ipc-types';
import { CategoriesService } from '../../core/services/categories.service';

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
  templateUrl: './product-form.dialog.html',
})
export class ProductFormDialog implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  readonly categories = inject(CategoriesService);

  readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(60)]],
    barcode: [''],
    name: ['', [Validators.required, Validators.maxLength(140)]],
    categoryId: this.fb.control<number | null>(null),
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    taxRate: [0, [Validators.required, Validators.min(0)]],
    reorderLevel: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  constructor(
    public ref: MatDialogRef<ProductFormDialog, NewProduct>,
    @Inject(MAT_DIALOG_DATA) public data: Product | null
  ) {
    if (data) {
      this.form.reset({
        sku: data.sku,
        barcode: data.barcode ?? '',
        name: data.name,
        categoryId: data.categoryId,
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        taxRate: data.taxRate,
        reorderLevel: data.reorderLevel,
        isActive: data.isActive === 1,
      });
    }
  }

  ngOnInit(): void {
    if (this.categories.items().length === 0) void this.categories.refresh();
  }

  save(): void {
    const v = this.form.getRawValue();
    this.ref.close({
      sku: v.sku.trim(),
      barcode: v.barcode?.trim() || null,
      name: v.name.trim(),
      categoryId: v.categoryId,
      unitPrice: Number(v.unitPrice),
      costPrice: Number(v.costPrice),
      taxRate: Number(v.taxRate),
      imagePath: this.data?.imagePath ?? null,
      isActive: v.isActive ? 1 : 0,
      reorderLevel: Number(v.reorderLevel),
    });
  }
}
