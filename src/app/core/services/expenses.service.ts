import { Injectable, inject, signal } from '@angular/core';
import type {
  AttachmentFile,
  DateRange,
  Expense,
  ExpensePatch,
  NewExpense,
} from '../../../../shared/ipc-types';
import { thisMonth } from '../../shared/dates';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly items = signal<Expense[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Dates `items` was loaded for; refresh() reloads the same range. */
  readonly range = signal<DateRange>(thisMonth());

  async refresh(range: DateRange = this.range()): Promise<void> {
    this.range.set(range);
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.bridge.unwrap(this.bridge.api.expenses.list(range)));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: NewExpense): Promise<Expense> {
    const created = await this.bridge.unwrap(this.bridge.api.expenses.create(input));
    await this.refresh();
    return created;
  }

  async update(id: number, patch: ExpensePatch): Promise<Expense> {
    const updated = await this.bridge.unwrap(this.bridge.api.expenses.update(id, patch));
    await this.refresh();
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.bridge.unwrap(this.bridge.api.expenses.remove(id));
    await this.refresh();
  }

  pickAttachments(): Promise<AttachmentFile[]> {
    return this.bridge.unwrap(this.bridge.api.expenses.pickAttachments());
  }

  attachment(id: number): Promise<AttachmentFile> {
    return this.bridge.unwrap(this.bridge.api.expenses.attachment(id));
  }

  openAttachment(id: number): Promise<void> {
    return this.bridge.unwrap(this.bridge.api.expenses.openAttachment(id));
  }
}
