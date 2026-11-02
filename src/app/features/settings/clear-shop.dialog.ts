import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { BackupCounts, BackupCurrentState } from '../../../../shared/ipc-types';
import { BackupService } from '../../core/services/backup.service';

export interface ClearShopDialogData {
  current: BackupCurrentState | null;
}

const CONFIRM_WORD = 'CLEAR';

const COUNT_ROWS: readonly { key: keyof BackupCounts; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'sales', label: 'Sales' },
  { key: 'expenses', label: 'Expenses' },
];

type Step = 'warn' | 'confirm' | 'clearing' | 'done' | 'error';

/**
 * Double confirmation: read what will be deleted → type CLEAR → clear (main
 * process takes a safety copy first) → reload. The confirm button is disabled
 * until the word is typed, so a double-click cannot get through both steps.
 */
@Component({
  selector: 'app-clear-shop-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Clear shop</h2>
    <mat-dialog-content>
      @switch (step()) {
        @case ('warn') {
          <div class="flex flex-col gap-4">
            <div class="flex gap-3 p-4 rounded-lg bg-error-container">
              <mat-icon class="shrink-0">warning</mat-icon>
              <div class="flex flex-col gap-1 text-sm">
                <strong>Every record in this shop will be deleted.</strong>
                <span>
                  This includes all products, categories, sales and expenses, with their
                  attached files. Settings go back to their defaults, including the shop name and logo.
                </span>
              </div>
            </div>

            <div class="flex gap-3 p-4 rounded-lg bg-primary-container">
              <mat-icon class="shrink-0">shield</mat-icon>
              <span class="text-sm">
                Backups are kept. A <strong>safety backup</strong> of your current data is made
                first. To undo, restore the backup marked <strong>Before clearing</strong>.
              </span>
            </div>

            @if (data.current; as current) {
              <table class="w-full text-sm border-collapse">
                <tbody>
                  @for (row of rows; track row.key) {
                    <tr class="border-t border-outline-variant">
                      <td class="py-2 pr-4">{{ row.label }}</td>
                      <td class="py-2 pl-4 text-right font-semibold">{{ current.counts[row.key] ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }
        @case ('confirm') {
          <div class="flex flex-col gap-4">
            <div class="flex gap-3 p-4 rounded-lg bg-error-container">
              <mat-icon class="shrink-0">warning</mat-icon>
              <div class="flex flex-col gap-1 text-sm">
                <strong>Are you sure?</strong>
                <span>The app will start again as an empty shop.</span>
              </div>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Type {{ confirmWord }} to confirm</mat-label>
              <input
                matInput
                [ngModel]="typed()"
                (ngModelChange)="typed.set($event)"
                (keydown.enter)="clear()"
                autocomplete="off"
              />
            </mat-form-field>
          </div>
        }
        @case ('clearing') {
          <div class="flex flex-col items-center gap-4 py-8 text-center">
            <mat-spinner diameter="40" />
            <div class="flex flex-col gap-1">
              <strong>Clearing…</strong>
              <span class="text-sm opacity-80">
                Saving a safety copy, then deleting records. Don't close the app.
              </span>
            </div>
          </div>
        }
        @case ('done') {
          <div class="flex flex-col items-center gap-3 py-6 text-center">
            <mat-icon class="!h-12 !w-12 !text-5xl text-primary">task_alt</mat-icon>
            <strong>Shop cleared</strong>
            <span class="text-sm opacity-80">
              Your previous data was saved as
              <span class="font-mono">{{ safetyFilename() }}</span>
              (Before clearing). The app will reload now.
            </span>
          </div>
        }
        @case ('error') {
          <div class="flex gap-3 p-4 rounded-lg bg-error-container">
            <mat-icon class="shrink-0">error</mat-icon>
            <div class="flex flex-col gap-1 text-sm">
              <strong>The shop was not cleared.</strong>
              <span>{{ errorMessage() }}</span>
            </div>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @switch (step()) {
        @case ('warn') {
          <button mat-button (click)="ref.close(false)">Cancel</button>
          <button mat-flat-button class="!bg-error !text-on-error" (click)="continue()">
            Continue
          </button>
        }
        @case ('confirm') {
          <button mat-button (click)="ref.close(false)">Cancel</button>
          <button
            mat-flat-button
            [class.!bg-error]="confirmed()"
            [class.!text-on-error]="confirmed()"
            [disabled]="!confirmed()"
            (click)="clear()"
          >
            <mat-icon>delete_forever</mat-icon>
            Clear shop
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
export class ClearShopDialog {
  readonly data = inject<ClearShopDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ClearShopDialog, boolean>>(MatDialogRef);
  private readonly backups = inject(BackupService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly rows = COUNT_ROWS;
  readonly confirmWord = CONFIRM_WORD;
  readonly step = signal<Step>('warn');
  readonly typed = signal('');
  readonly confirmed = computed(() => this.typed().trim().toUpperCase() === CONFIRM_WORD);
  readonly safetyFilename = signal('');
  readonly errorMessage = signal('');

  constructor() {
    this.ref.disableClose = true;
    // disableClose also turns off Esc; bring it back for every step that can be left.
    this.ref
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.key === 'Escape' && this.step() !== 'clearing') this.ref.close(false);
      });
  }

  continue(): void {
    this.step.set('confirm');
    this.focusStep('input');
  }

  async clear(): Promise<void> {
    if (!this.confirmed()) return;
    this.step.set('clearing');
    try {
      const { safetyBackup } = await this.backups.clearShop();
      this.safetyFilename.set(safetyBackup.filename);
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
    // Every service signal holds the deleted data; a full reload is the safe reset.
    location.reload();
  }

  /** The button that had focus is gone once the step changes. */
  private focusStep(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
