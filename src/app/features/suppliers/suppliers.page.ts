import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Supplier } from '../../../../shared/ipc-types';
import { SuppliersService } from '../../core/services/suppliers.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SupplierFormDialog } from './supplier-form.dialog';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './suppliers.page.html',
})
export class SuppliersPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly svc = inject(SuppliersService);

  readonly columns = ['name', 'contact', 'phone', 'status', 'actions'] as const;

  ngOnInit(): void {
    void this.svc.refresh();
  }

  async create(): Promise<void> {
    const ref = this.dialog.open(SupplierFormDialog, { data: null, width: '560px' });
    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;
    try {
      await this.svc.create(input);
      this.snack.open('Supplier created', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async edit(s: Supplier): Promise<void> {
    const ref = this.dialog.open(SupplierFormDialog, { data: s, width: '560px' });
    const patch = await firstValueFrom(ref.afterClosed());
    if (!patch) return;
    try {
      await this.svc.update(s.id, patch);
      this.snack.open('Supplier updated', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async remove(s: Supplier): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete supplier?',
        message: `Delete "${s.name}"? Linked purchases keep their records but lose the supplier name.`,
        destructive: true,
        confirmLabel: 'Delete',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.remove(s.id);
      this.snack.open('Supplier deleted', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }
}
