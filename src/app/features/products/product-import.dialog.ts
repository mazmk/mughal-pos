import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { ProductImportResult } from '../../../../shared/ipc-types';
import { ProductsService } from '../../core/services/products.service';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';
import { parseProductLines } from './product-import';

function importable(control: AbstractControl<string>): ValidationErrors | null {
  const { rows, errors } = parseProductLines(control.value);
  if (errors.length > 0) return { lines: errors[0] };
  return rows.length === 0 ? { empty: true } : null;
}

/**
 * Adds a whole list of products at once. Saves itself rather than handing the
 * text back to the page, so a failed import keeps what was pasted.
 */
@Component({
  selector: 'app-product-import-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SubmitFormDirective,
  ],
  template: `
    <h2 mat-dialog-title>Import products</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-2">
        <p class="m-0 text-sm">
          One product per line: <strong>Category, Product name</strong>. You can add a price and
          cost after the name; leave them out for 0. Copy two columns from Excel or Google Sheets
          and paste them here, or choose a CSV file. Missing categories are created, every product
          gets an SKU, and products that already exist are skipped.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <button mat-stroked-button type="button" (click)="fileInput.click()">
            <mat-icon>upload_file</mat-icon>
            Choose CSV file
          </button>
          <input
            #fileInput
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            class="hidden"
            (change)="loadFile(fileInput)"
          />
          @if (fileName(); as name) {
            <span class="text-sm opacity-80">{{ name }}</span>
          }
        </div>

        <form id="product-import-form" [formGroup]="form" (appSubmit)="import()">
          <mat-form-field appearance="outline" class="!w-full">
            <mat-label>Products</mat-label>
            <textarea
              matInput
              rows="10"
              formControlName="text"
              cdkFocusInitial
              placeholder="Cold Drinks, Pepsi&#10;Cold Drinks, Sprite&#10;Biscuits, Oreo"
            ></textarea>
            <mat-hint>{{ summary() }}</mat-hint>
            <mat-error>{{ errorText() }}</mat-error>
          </mat-form-field>
        </form>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()" [disabled]="saving()">Cancel</button>
      <button mat-flat-button color="primary" type="submit" form="product-import-form" [disabled]="saving()">
        @if (saving()) {
          <mat-spinner diameter="18" class="!mr-2" />
        }
        Import
      </button>
    </mat-dialog-actions>
  `,
})
export class ProductImportDialog {
  private readonly products = inject(ProductsService);
  private readonly snack = inject(MatSnackBar);
  readonly ref = inject<MatDialogRef<ProductImportDialog, ProductImportResult>>(MatDialogRef);

  readonly form = new FormBuilder().nonNullable.group({ text: ['', importable] });
  private readonly text = toSignal(this.form.controls.text.valueChanges, { initialValue: '' });
  private readonly parsed = computed(() => parseProductLines(this.text()));

  readonly fileName = signal<string | null>(null);
  readonly saving = signal(false);

  readonly summary = computed(() => {
    const { rows } = this.parsed();
    if (rows.length === 0) return 'Nothing to import yet';
    const categories = new Set(rows.map((r) => r.category?.toLowerCase() ?? ''));
    return `${rows.length} product${rows.length === 1 ? '' : 's'} in ${categories.size} categor${categories.size === 1 ? 'y' : 'ies'}`;
  });

  readonly errorText = computed(() => {
    const { rows, errors } = this.parsed();
    if (errors.length > 0) {
      const more = errors.length > 1 ? ` (and ${errors.length - 1} more)` : '';
      return errors[0] + more;
    }
    return rows.length === 0 ? 'Paste or load at least one product' : '';
  });

  async loadFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.snack.open('That file is larger than 2 MB', 'OK', { duration: 3000 });
      return;
    }
    this.fileName.set(file.name);
    this.form.controls.text.setValue(await file.text());
    this.form.controls.text.markAsTouched();
  }

  async import(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      this.ref.close(await this.products.import(this.parsed().rows));
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
