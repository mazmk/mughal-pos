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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import type {
  ExpenseTypeRow,
  ReportRange,
  SalesReportRow,
  TopProductRow,
} from '../../../../shared/ipc-types';
import { ReportsService } from '../../core/services/reports.service';
import { monthRange, toISODate } from '../../shared/dates';
import { expenseType } from '../../shared/expense-types';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  AutocompleteFieldComponent,
  type AutocompleteOption,
} from '../../shared/components/autocomplete-field/autocomplete-field.component';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    AutocompleteFieldComponent,
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
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

  readonly from = signal<Date | null>(monthRange().from);
  readonly to = signal<Date | null>(monthRange().to);
  readonly granularity = signal<ReportRange['granularity']>('day');
  readonly granularityOptions: readonly AutocompleteOption<ReportRange['granularity']>[] = [
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
  ];

  readonly rows = signal<SalesReportRow[]>([]);
  readonly top = signal<TopProductRow[]>([]);
  readonly expenseTypes = signal<ExpenseTypeRow[]>([]);
  readonly loading = signal(false);
  readonly typeOf = expenseType;

  readonly salesColumns = [
    'bucket',
    'salesCount',
    'totalAmount',
    'profit',
    'otherExpenses',
    'netProfit',
    'stockExpenses',
  ] as const;
  readonly topColumns = ['sku', 'name', 'quantitySold', 'revenue'] as const;
  readonly expenseColumns = ['type', 'count', 'amount'] as const;

  readonly totals = computed(() => {
    const r = this.rows();
    const sum = (pick: (row: SalesReportRow) => number) => r.reduce((s, x) => s + pick(x), 0);
    return {
      sales: sum((x) => x.salesCount),
      revenue: sum((x) => x.totalAmount),
      tax: sum((x) => x.taxAmount),
      discount: sum((x) => x.discountAmount),
      profit: sum((x) => x.profit),
      stockExpenses: sum((x) => x.stockExpenses),
      otherExpenses: sum((x) => x.otherExpenses),
      netProfit: sum((x) => x.netProfit),
    };
  });

  /** Quick ranges. A whole year reads best month by month. */
  setRange(preset: 'this-month' | 'last-month' | 'this-year'): void {
    if (preset === 'this-year') {
      const year = new Date().getFullYear();
      this.from.set(new Date(year, 0, 1));
      this.to.set(new Date(year, 11, 31));
      this.granularity.set('month');
    } else {
      const { from, to } = monthRange(preset === 'this-month' ? 0 : -1);
      this.from.set(from);
      this.to.set(to);
      this.granularity.set('day');
    }
    void this.run();
  }

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
      const [sales, top, expenseTypes] = await Promise.all([
        this.reports.sales(range),
        this.reports.topProducts(range, 10),
        this.reports.expensesByType(range),
      ]);
      this.rows.set(sales);
      this.top.set(top);
      this.expenseTypes.set(expenseTypes);
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.loading.set(false);
    }
  }
}
