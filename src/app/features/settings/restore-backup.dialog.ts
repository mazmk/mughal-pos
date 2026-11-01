import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  BackupCounts,
  BackupCurrentState,
  BackupInfo,
  RestoreResult,
} from '../../../../shared/ipc-types';
import { BackupService } from '../../core/services/backup.service';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';

export interface RestoreBackupDialogData {
  backup: BackupInfo;
  current: BackupCurrentState | null;
}

const CONFIRM_WORD = 'RESTORE';

const COUNT_ROWS: readonly { key: keyof BackupCounts; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'stockMovements', label: 'Stock movements' },
];

type Step = 'confirm' | 'restoring' | 'done' | 'error';

/**
 * Restore flow: compare → type RESTORE → restore (main process takes a safety
 * copy first) → reload. The dialog cannot be dismissed while restoring.
 */
@Component({
  selector: 'app-restore-backup-dialog',
  standalone: true,
  imports: [
    AppDatePipe,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Restore backup</h2>
    <mat-dialog-content>
      @switch (step()) {
        @case ('confirm') {
          <div class="flex flex-col gap-4">
            <div class="flex gap-3 p-4 rounded-lg bg-error-container">
              <mat-icon class="shrink-0">warning</mat-icon>
              <div class="flex flex-col gap-1 text-sm">
                <strong>Your current data will be replaced.</strong>
                <span>
                  The shop goes back to how it was on
                  <strong>{{ data.backup.createdAt | appDate: 'datetime-seconds' }}</strong>. Anything entered
                  after that (sales, stock, products) will no longer appear.
                </span>
              </div>
            </div>

            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-left">
                  <th class="py-2 pr-4 font-medium opacity-70"></th>
                  <th class="py-2 px-4 text-right font-medium opacity-70">Now</th>
                  <th class="py-2 pl-4 text-right font-medium opacity-70">In backup</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows; track row.key) {
                  <tr class="border-t border-outline-variant">
                    <td class="py-2 pr-4">{{ row.label }}</td>
                    <td class="py-2 px-4 text-right">{{ currentCount(row.key) }}</td>
                    <td
                      class="py-2 pl-4 text-right font-semibold"
                      [class.text-error]="isFewer(row.key)"
                    >
                      {{ backupCount(row.key) }}
                    </td>
                  </tr>
                }
                <tr class="border-t border-outline-variant">
                  <td class="py-2 pr-4">Last sale</td>
                  <td class="py-2 px-4 text-right">{{ (data.current?.lastSaleAt | appDate: 'datetime') ?? '—' }}</td>
                  <td class="py-2 pl-4 text-right font-semibold">
                    {{ (data.backup.lastSaleAt | appDate: 'datetime') ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="flex gap-3 p-4 rounded-lg bg-primary-container">
              <mat-icon class="shrink-0">shield</mat-icon>
              <span class="text-sm">
                A <strong>safety backup</strong> of your current data is made automatically first.
                If anything looks wrong afterwards, restore the backup marked
                <strong>Before restore</strong> to undo.
              </span>
            </div>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Type {{ confirmWord }} to confirm</mat-label>
              <input
                matInput
                [ngModel]="typed()"
                (ngModelChange)="typed.set($event)"
                (keydown.enter)="restore()"
                autocomplete="off"
              />
            </mat-form-field>
          </div>
        }
        @case ('restoring') {
          <div class="flex flex-col items-center gap-4 py-8 text-center">
            <mat-spinner diameter="40" />
            <div class="flex flex-col gap-1">
              <strong>Restoring…</strong>
              <span class="text-sm opacity-80">
                Saving a safety copy, checking the backup, then switching data. Don't close the app.
              </span>
            </div>
          </div>
        }
        @case ('done') {
          <div class="flex flex-col items-center gap-3 py-6 text-center">
            <mat-icon class="!h-12 !w-12 !text-5xl text-primary">task_alt</mat-icon>
            <strong>Restore complete</strong>
            <span class="text-sm opacity-80">
              Your previous data was saved as
              <span class="font-mono">{{ safetyFilename() }}</span>
              (Before restore). The app will reload to show the restored data.
            </span>
          </div>
        }
        @case ('error') {
          <div class="flex gap-3 p-4 rounded-lg bg-error-container">
            <mat-icon class="shrink-0">error</mat-icon>
            <div class="flex flex-col gap-1 text-sm">
              <strong>The backup was not restored.</strong>
              <span>{{ errorMessage() }}</span>
            </div>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @switch (step()) {
        @case ('confirm') {
          <button mat-button (click)="ref.close(false)">Cancel</button>
          <button mat-flat-button color="warn" [disabled]="!confirmed()" (click)="restore()">
            <mat-icon>settings_backup_restore</mat-icon>
            Restore
          </button>
        }
        @case ('done') {
          <button mat-flat-button color="primary" (click)="reload()">Reload now</button>
        }
        @case ('error') {
          <button mat-button (click)="ref.close(false)">Close</button>
        }
      }
    </mat-dialog-actions>
  `,
})
export class RestoreBackupDialog {
  readonly data = inject<RestoreBackupDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<RestoreBackupDialog, boolean>>(MatDialogRef);
  private readonly backups = inject(BackupService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly rows = COUNT_ROWS;
  readonly confirmWord = CONFIRM_WORD;
  readonly step = signal<Step>('confirm');
  readonly typed = signal('');
  readonly confirmed = computed(() => this.typed().trim().toUpperCase() === CONFIRM_WORD);
  readonly result = signal<RestoreResult | null>(null);
  readonly safetyFilename = computed(() => this.result()?.safetyBackup.filename ?? '');
  readonly errorMessage = signal('');

  constructor() {
    this.ref.disableClose = true;
    // disableClose also turns off Esc; bring it back for every step that can be left.
    this.ref
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.key === 'Escape' && this.step() !== 'restoring') this.ref.close(false);
      });
  }

  currentCount(key: keyof BackupCounts): string {
    return this.data.current ? String(this.data.current.counts[key]) : '—';
  }

  backupCount(key: keyof BackupCounts): string {
    return this.data.backup.counts ? String(this.data.backup.counts[key]) : '—';
  }

  /** Highlights rows where restoring would leave fewer records than today. */
  isFewer(key: keyof BackupCounts): boolean {
    const now = this.data.current?.counts[key];
    const then = this.data.backup.counts?.[key];
    return now !== undefined && then !== undefined && then < now;
  }

  async restore(): Promise<void> {
    if (!this.confirmed()) return;
    this.step.set('restoring');
    try {
      this.result.set(await this.backups.restore(this.data.backup.filename));
      this.step.set('done');
      this.focusStep('mat-dialog-actions button');
      setTimeout(() => this.reload(), 4000);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
      this.step.set('error');
      this.focusStep('mat-dialog-actions button');
    }
  }

  reload(): void {
    // Every service signal holds pre-restore data; a full reload is the safe reset.
    location.reload();
  }

  /** The button that had focus is gone once the step changes. */
  private focusStep(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
