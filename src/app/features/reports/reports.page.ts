import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import type {
  ReportRange,
  SalesReportRow,
  TopProductRow,
} from '../../../../shared/ipc-types';
import { ReportsService } from '../../core/services/reports.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MoneyPipe,
  ],
  templateUrl: './reports.page.html',
})
export class ReportsPage implements OnInit {
  private readonly reports = inject(ReportsService);
  private readonly snack = inject(MatSnackBar);

  readonly from = signal<Date | null>(new Date(Date.now() - 30 * 86400_000));
  readonly to = signal<Date | null>(new Date());
  readonly granularity = signal<ReportRange['granularity']>('day');

  readonly rows = signal<SalesReportRow[]>([]);
  readonly top = signal<TopProductRow[]>([]);
  readonly loading = signal(false);

  readonly salesColumns = ['bucket', 'salesCount', 'totalAmount', 'taxAmount', 'discountAmount'] as const;
  readonly topColumns = ['sku', 'name', 'quantitySold', 'revenue'] as const;

  readonly totals = computed(() => {
    const r = this.rows();
    return {
      sales: r.reduce((s, x) => s + x.salesCount, 0),
      revenue: r.reduce((s, x) => s + x.totalAmount, 0),
      tax: r.reduce((s, x) => s + x.taxAmount, 0),
      discount: r.reduce((s, x) => s + x.discountAmount, 0),
    };
  });

  /** 2026-11-01 → 01/11/2026 and 2026-11 → 11/2026. Week buckets (2026-W44) stay as they are. */
  bucketLabel(bucket: string): string {
    return bucket.replace(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/, (_, year, month, day) =>
      day ? `${day}/${month}/${year}` : `${month}/${year}`,
    );
  }

  async ngOnInit(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    const from = this.from();
    const to = this.to();
    if (!from || !to) {
      this.snack.open('Enter both dates as dd/mm/yyyy', 'OK', { duration: 3000 });
      return;
    }
    const range: ReportRange = {
      from: toISODate(from),
      to: toISODate(to),
      granularity: this.granularity(),
    };
    this.loading.set(true);
    try {
      const [sales, top] = await Promise.all([
        this.reports.sales(range),
        this.reports.topProducts(range, 10),
      ]);
      this.rows.set(sales);
      this.top.set(top);
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.loading.set(false);
    }
  }
}
