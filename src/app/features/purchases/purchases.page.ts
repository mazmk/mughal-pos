import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
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
import type { Purchase } from '../../../../shared/ipc-types';
import { PurchasesService } from '../../core/services/purchases.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PurchaseFormDialog } from './purchase-form.dialog';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    TitleCasePipe,
    MoneyPipe,
  ],
  templateUrl: './purchases.page.html',
})
export class PurchasesPage implements OnInit {
  readonly svc = inject(PurchasesService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = [
    'purchasedAt',
    'reference',
    'supplier',
    'items',
    'total',
    'status',
    'actions',
  ] as const;

  ngOnInit(): void {
    void this.svc.refresh();
  }

  async create(): Promise<void> {
    const ref = this.dialog.open(PurchaseFormDialog, { width: '720px', maxWidth: '95vw' });
    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;
    try {
      await this.svc.create(input);
      this.snack.open('Draft purchase created', 'OK', { duration: 2500 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async receive(p: Purchase): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Receive purchase?',
        message: `Mark purchase as received? Stock will be added for ${p.items.length} line(s).`,
        confirmLabel: 'Receive',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.receive(p.id);
      this.snack.open('Purchase received, stock updated', 'OK', { duration: 2500 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }

  async cancel(p: Purchase): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel purchase?',
        message: 'This marks the draft as cancelled. Stock is unaffected.',
        destructive: true,
        confirmLabel: 'Cancel purchase',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.cancel(p.id);
      this.snack.open('Purchase cancelled', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }
}
