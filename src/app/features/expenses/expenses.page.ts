import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Expense, ExpenseType } from '../../../../shared/ipc-types';
import { ExpensesService } from '../../core/services/expenses.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { monthRange, toISODate } from '../../shared/dates';
import { EXPENSE_TYPES, expenseType } from '../../shared/expense-types';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ExpenseFormDialog } from './expense-form.dialog';
import {
  AutocompleteFieldComponent,
  type AutocompleteOption,
} from '../../shared/components/autocomplete-field/autocomplete-field.component';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [
    AutocompleteFieldComponent,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AppDatePipe,
    MoneyPipe,
  ],
  templateUrl: './expenses.page.html',
})
export class ExpensesPage implements OnInit {
  readonly svc = inject(ExpensesService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly addButton = viewChild.required('addButton', { read: ElementRef<HTMLElement> });

  readonly typeFilterOptions: readonly AutocompleteOption<ExpenseType | 'all'>[] = [
    { value: 'all', label: 'All types', icon: 'list' },
    ...EXPENSE_TYPES,
  ];
  readonly typeOf = expenseType;
  readonly columns = ['incurredAt', 'type', 'description', 'files', 'amount', 'actions'] as const;

  readonly from = signal<Date | null>(monthRange().from);
  readonly to = signal<Date | null>(monthRange().to);
  readonly typeFilter = signal<ExpenseType | 'all'>('all');
  readonly query = signal('');

  readonly filtered = computed(() => {
    const type = this.typeFilter();
    const q = this.query().trim().toLowerCase();
    return this.svc
      .items()
      .filter((e) => type === 'all' || e.type === type)
      .filter((e) => !q || (e.description?.toLowerCase().includes(q) ?? false));
  });

  readonly total = computed(() => this.filtered().reduce((sum, e) => sum + e.amount, 0));

  /** Spend per type over the loaded dates, ignoring the type and search filters. */
  readonly byType = computed(() =>
    EXPENSE_TYPES.map((t) => ({
      ...t,
      amount: this.svc
        .items()
        .filter((e) => e.type === t.value)
        .reduce((sum, e) => sum + e.amount, 0),
    })).filter((t) => t.amount > 0)
  );

  ngOnInit(): void {
    void this.load();
  }

  setMonth(offset: number): void {
    const { from, to } = monthRange(offset);
    this.from.set(from);
    this.to.set(to);
    void this.load();
  }

  async load(): Promise<void> {
    const from = this.from();
    const to = this.to();
    if (!from || !to) {
      this.snack.open('Enter both dates as dd/mm/yyyy', 'OK', { duration: 3000 });
      return;
    }
    await this.svc.refresh({ from: toISODate(from), to: toISODate(to) });
  }

  async create(): Promise<void> {
    const ref = this.dialog.open(ExpenseFormDialog, { data: null, width: '600px' });
    if (await firstValueFrom(ref.afterClosed())) {
      this.snack.open('Expense added', 'OK', { duration: 2000 });
    }
  }

  async edit(e: Expense): Promise<void> {
    const ref = this.dialog.open(ExpenseFormDialog, { data: e, width: '600px' });
    if (await firstValueFrom(ref.afterClosed())) {
      this.snack.open('Expense updated', 'OK', { duration: 2000 });
    }
  }

  async remove(e: Expense): Promise<void> {
    const files = e.attachments.length;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete expense?',
        message:
          `Delete this ${expenseType(e.type).label.toLowerCase()} expense` +
          (files ? ` and its ${files} attached file${files === 1 ? '' : 's'}` : '') +
          '? This cannot be undone, except by restoring a backup.',
        destructive: true,
        confirmLabel: 'Delete',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    try {
      await this.svc.remove(e.id);
      // Its row, and the button that had focus, are gone.
      this.addButton().nativeElement.focus();
      this.snack.open('Expense deleted', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    }
  }
}
