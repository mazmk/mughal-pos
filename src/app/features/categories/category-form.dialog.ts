import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Category, NewCategory } from '../../../../shared/ipc-types';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    SubmitFormDirective,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit category' : 'New category' }}</h2>
    <mat-dialog-content>
      <form id="category-form" [formGroup]="form" (appSubmit)="save()" class="flex flex-col gap-3 pt-2 min-w-80">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="80" cdkFocusInitial />
          <mat-error>Enter a name</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" type="submit" form="category-form">
        {{ data ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class CategoryFormDialog {
  private readonly fb = new FormBuilder().nonNullable;
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: [''],
  });

  constructor(
    public ref: MatDialogRef<CategoryFormDialog, NewCategory>,
    @Inject(MAT_DIALOG_DATA) public data: Category | null
  ) {
    if (data) {
      this.form.reset({ name: data.name, description: data.description ?? '' });
    }
  }

  save(): void {
    const { name, description } = this.form.getRawValue();
    this.ref.close({ name: name.trim(), description: description?.trim() || null });
  }
}
