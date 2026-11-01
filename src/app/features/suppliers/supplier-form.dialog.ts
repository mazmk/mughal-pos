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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NewSupplier, Supplier } from '../../../../shared/ipc-types';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';

@Component({
  selector: 'app-supplier-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    SubmitFormDirective,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit supplier' : 'New supplier' }}</h2>
    <mat-dialog-content>
      <form id="supplier-form" [formGroup]="form" (appSubmit)="save()" class="grid gap-3 pt-2 sm:grid-cols-2">
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="120" cdkFocusInitial />
          <mat-error>Enter a name</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contact name</mat-label>
          <input matInput formControlName="contactName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput formControlName="phone" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          <mat-error>Enter a valid email</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
        <mat-slide-toggle formControlName="isActive" class="sm:col-span-2">Active</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" type="submit" form="supplier-form">
        {{ data ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class SupplierFormDialog {
  private readonly fb = new FormBuilder().nonNullable;
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    contactName: [''],
    phone: [''],
    email: ['', Validators.email],
    address: [''],
    notes: [''],
    isActive: [true],
  });

  constructor(
    public ref: MatDialogRef<SupplierFormDialog, NewSupplier>,
    @Inject(MAT_DIALOG_DATA) public data: Supplier | null
  ) {
    if (data) {
      this.form.reset({
        name: data.name,
        contactName: data.contactName ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
        notes: data.notes ?? '',
        isActive: data.isActive === 1,
      });
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    this.ref.close({
      name: v.name.trim(),
      contactName: v.contactName?.trim() || null,
      phone: v.phone?.trim() || null,
      email: v.email?.trim() || null,
      address: v.address?.trim() || null,
      notes: v.notes?.trim() || null,
      isActive: v.isActive ? 1 : 0,
    });
  }
}
