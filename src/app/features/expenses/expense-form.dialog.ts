import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import type {
  AttachmentFile,
  Expense,
  ExpensePatch,
  ExpenseType,
} from '../../../../shared/ipc-types';
import { ExpensesService } from '../../core/services/expenses.service';
import { SubmitFormDirective } from '../../shared/directives/submit-form.directive';
import { EXPENSE_TYPES, expenseType } from '../../shared/expense-types';
import { parseAppDate } from '../../shared/pipes/app-date.pipe';
import { AttachmentViewerDialog } from './attachment-viewer.dialog';
import { AutocompleteFieldComponent } from '../../shared/components/autocomplete-field/autocomplete-field.component';

/** A saved attachment (id set) or one picked in this dialog and not saved yet (file set). */
interface AttachmentItem {
  readonly key: string;
  readonly id: number | null;
  readonly fileName: string;
  readonly isImage: boolean;
  readonly sizeBytes: number;
  readonly file: AttachmentFile | null;
}

const MAX_ATTACHMENTS = 10;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Saves the expense itself rather than handing the form back to the page, so
 * a failed save keeps the picked files instead of throwing them away.
 */
@Component({
  selector: 'app-expense-form-dialog',
  standalone: true,
  imports: [
    AutocompleteFieldComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SubmitFormDirective,
  ],
  templateUrl: './expense-form.dialog.html',
})
export class ExpenseFormDialog implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly expenses = inject(ExpensesService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly ref = inject<MatDialogRef<ExpenseFormDialog, Expense>>(MatDialogRef);
  readonly data = inject<Expense | null>(MAT_DIALOG_DATA);

  readonly types = EXPENSE_TYPES;
  readonly formatBytes = formatBytes;

  readonly form = this.fb.group({
    type: this.fb.control<ExpenseType | null>(null, Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    incurredAt: this.fb.control<Date | null>(new Date(), Validators.required),
    description: ['', Validators.maxLength(500)],
  });

  readonly selectedType = signal<ExpenseType | null>(null);
  readonly hint = computed(() => {
    const type = this.selectedType();
    return type ? expenseType(type).hint : 'Choose a type first';
  });

  private readonly removedIds = signal<number[]>([]);
  readonly saved = computed<AttachmentItem[]>(() =>
    (this.data?.attachments ?? [])
      .filter((a) => !this.removedIds().includes(a.id))
      .map((a) => ({
        key: `saved-${a.id}`,
        id: a.id,
        fileName: a.fileName,
        isImage: a.mimeType.startsWith('image/'),
        sizeBytes: a.sizeBytes,
        file: null,
      }))
  );
  readonly pending = signal<AttachmentItem[]>([]);
  readonly attachments = computed(() => [...this.saved(), ...this.pending()]);
  /** Data URLs for image thumbnails, by item key. Saved ones load after the dialog opens. */
  readonly previews = signal<Record<string, string>>({});

  readonly picking = signal(false);
  readonly saving = signal(false);
  private nextKey = 0;

  constructor() {
    this.form.controls.type.valueChanges.subscribe((t) => this.selectedType.set(t));
    if (this.data) {
      this.form.reset({
        type: this.data.type,
        amount: this.data.amount,
        incurredAt: parseAppDate(this.data.incurredAt),
        description: this.data.description ?? '',
      });
    }
  }

  ngOnInit(): void {
    for (const item of this.saved()) {
      if (!item.isImage || item.id === null) continue;
      const key = item.key;
      this.expenses
        .attachment(item.id)
        .then((file) => this.previews.update((p) => ({ ...p, [key]: dataUrl(file) })))
        .catch(() => undefined);
    }
  }

  async addFiles(): Promise<void> {
    this.picking.set(true);
    try {
      const files = await this.expenses.pickAttachments();
      const room = MAX_ATTACHMENTS - this.attachments().length;
      if (files.length > room) {
        this.snack.open(`An expense can have at most ${MAX_ATTACHMENTS} files`, 'OK', {
          duration: 3000,
        });
      }
      const items = files.slice(0, Math.max(0, room)).map((file) => ({
        key: `new-${this.nextKey++}`,
        id: null,
        fileName: file.fileName,
        isImage: file.mimeType.startsWith('image/'),
        sizeBytes: Math.floor((file.dataBase64.length * 3) / 4),
        file,
      }));
      this.pending.update((list) => [...list, ...items]);
      this.previews.update((p) => {
        const next = { ...p };
        for (const item of items) if (item.isImage && item.file) next[item.key] = dataUrl(item.file);
        return next;
      });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.picking.set(false);
    }
  }

  async view(item: AttachmentItem): Promise<void> {
    try {
      if (item.isImage) {
        const src = this.previews()[item.key];
        if (!src) return;
        this.dialog.open(AttachmentViewerDialog, {
          data: { fileName: item.fileName, src },
          width: '900px',
        });
      } else if (item.id !== null) {
        await this.expenses.openAttachment(item.id);
      }
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  removeAttachment(item: AttachmentItem, index: number): void {
    if (item.id !== null) {
      const id = item.id;
      this.removedIds.update((ids) => [...ids, id]);
    } else {
      this.pending.update((list) => list.filter((i) => i !== item));
    }
    // The removed row's button had focus; land on the row that took its place.
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const buttons = root.querySelectorAll<HTMLElement>('.attachment-remove');
        const next = buttons[Math.min(index, buttons.length - 1)];
        (next ?? root.querySelector<HTMLElement>('.attachment-add'))?.focus();
      },
      { injector: this.injector }
    );
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const v = this.form.getRawValue();
    if (v.type === null || v.amount === null || v.incurredAt === null) return;

    const patch: ExpensePatch = {
      type: v.type,
      amount: Number(v.amount),
      description: v.description.trim() || null,
      incurredAt: this.instantFor(v.incurredAt).toISOString(),
      addAttachments: this.pending().flatMap((i) => (i.file ? [i.file] : [])),
      removeAttachmentIds: this.removedIds(),
    };

    this.saving.set(true);
    try {
      const saved = this.data
        ? await this.expenses.update(this.data.id, patch)
        : await this.expenses.create(patch);
      this.ref.close(saved);
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The form picks a day, not a time. Keep the original time when the day is
   * unchanged, use now for today, and midday otherwise so the day can't shift.
   */
  private instantFor(day: Date): Date {
    const original = this.data ? parseAppDate(this.data.incurredAt) : null;
    if (original && sameDay(original, day)) return original;
    const now = new Date();
    if (sameDay(now, day)) return now;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  }
}

function dataUrl(file: AttachmentFile): string {
  return `data:${file.mimeType};base64,${file.dataBase64}`;
}
