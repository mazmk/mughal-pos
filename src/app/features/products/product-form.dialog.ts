import { Component, Inject, OnInit, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NewProduct, Product } from '../../../../shared/ipc-types';
import { CategoriesService } from '../../core/services/categories.service';
import { AutocompleteFieldComponent } from '../../shared/components/autocomplete-field/autocomplete-field.component';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    SubmitFormDirective,
    AutocompleteFieldComponent,
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
    isActive: [true],
  });

  readonly categoryOptions = computed(() =>
    this.categories.items().map((c) => ({ value: c.id, label: c.name }))
  );

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
    });
  }
}
