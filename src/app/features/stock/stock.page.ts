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
import type { StockMovementReason } from '../../../../shared/ipc-types';
import { StockService } from '../../core/services/stock.service';
import { StockAdjustDialog } from './stock-adjust.dialog';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    DatePipe,
    TitleCasePipe,
  ],
  templateUrl: './stock.page.html',
})
export class StockPage implements OnInit {
  readonly svc = inject(StockService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['occurredAt', 'product', 'reason', 'quantity', 'note'] as const;

  private readonly reasonColorMap: Record<StockMovementReason, 'primary' | 'accent' | 'warn' | undefined> = {
    opening: 'primary',
    restock: 'primary',
    sale: undefined,
    damage: 'warn',
    adjustment: 'accent',
    return: 'accent',
  };

  colorFor(reason: StockMovementReason): 'primary' | 'accent' | 'warn' | undefined {
    return this.reasonColorMap[reason];
  }

  ngOnInit(): void {
    void this.svc.refresh();
  }

  async record(): Promise<void> {
    const ref = this.dialog.open(StockAdjustDialog, { width: '560px' });
    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;
    try {
      await this.svc.adjust(input);
      this.snack.open('Stock movement recorded', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 4000 });
    }
  }
}
