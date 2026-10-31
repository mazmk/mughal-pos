import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from "@angular/core";
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
import type { Sale } from '../../../../shared/ipc-types';
import { SalesService } from '../../core/services/sales.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-sales-page',
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
  templateUrl: './sales.page.html',
})
export class SalesPage implements OnInit {
  readonly svc = inject(SalesService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['soldAt', 'reference', 'items', 'payment', 'total', 'status', 'actions'] as const;
  readonly expandedId = signal<number | null>(null);

  ngOnInit(): void {
    void this.svc.refresh();
  }

  toggle(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async voidSale(s: Sale): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Void sale?',
        message: `Void ${s.reference}? Stock will be returned to inventory as a 'return' movement.`,
        destructive: true,
        confirmLabel: 'Void',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.void(s.id);
      this.snack.open('Sale voided', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }
}
