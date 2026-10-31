import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BackupInfo, BackupKind, BackupStatus } from '../../../../shared/ipc-types';
import { BackupService } from '../../core/services/backup.service';
import { SettingsService } from '../../core/services/settings.service';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { RestoreBackupDialog, type RestoreBackupDialogData } from './restore-backup.dialog';

const KIND_LABELS: Record<BackupKind, string> = {
  manual: 'Manual',
  auto: 'Automatic',
  'pre-restore': 'Before restore',
  'pre-migration': 'Before update',
  imported: 'Imported',
};

const STATUS_META: Record<BackupStatus, { icon: string; label: string; tone: string }> = {
  verified: { icon: 'verified', label: 'Verified — checksum and database check passed', tone: 'text-green-600' },
  unverified: { icon: 'help', label: 'Not verified yet — run Verify', tone: 'opacity-70' },
  damaged: { icon: 'error', label: 'Damaged or modified — cannot be restored', tone: 'text-error' },
};

/** A backup older than this (or none at all) is flagged on the panel. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

@Component({
  selector: 'app-backup-panel',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTableModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './backup-panel.component.html',
})
export class BackupPanelComponent implements OnInit {
  readonly backup = inject(BackupService);
  private readonly settings = inject(SettingsService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['createdAt', 'kind', 'contents', 'size', 'status', 'actions'] as const;
  readonly keepOptions = [7, 14, 30, 60] as const;

  /** Filename (or 'import') of the action in progress, to disable buttons. */
  readonly busy = signal<string | null>(null);

  readonly latest = computed<BackupInfo | null>(() => this.backup.items()[0] ?? null);
  readonly stale = computed(() => {
    const latest = this.latest();
    return !latest || Date.now() - Date.parse(latest.createdAt) > STALE_AFTER_MS;
  });
  readonly autoEnabled = computed(() => this.settings.value('backup.auto.enabled', 'true') !== 'false');
  readonly autoKeep = computed(() => Number(this.settings.value('backup.auto.keep', '14')) || 14);

  ngOnInit(): void {
    void this.backup.refresh();
  }

  kindLabel(kind: BackupKind): string {
    return KIND_LABELS[kind];
  }

  status(status: BackupStatus): { icon: string; label: string; tone: string } {
    return STATUS_META[status];
  }

  plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  kindTone(kind: BackupKind): string {
    if (kind === 'manual') return 'bg-primary-container';
    if (kind === 'pre-restore' || kind === 'pre-migration') return 'bg-tertiary-container';
    return 'bg-surface-variant';
  }

  async backUpNow(): Promise<void> {
    await this.run(null, async () => {
      const info = await this.backup.create();
      this.toast(`Backup saved and verified (${this.formatSize(info.sizeBytes)})`);
    });
  }

  async importBackup(): Promise<void> {
    await this.run('import', async () => {
      const info = await this.backup.import();
      if (info) this.toast('Backup imported and verified. Use Restore on it to bring its data back.');
    });
  }

  async openFolder(): Promise<void> {
    await this.run(null, () => this.backup.openFolder());
  }

  async verify(b: BackupInfo): Promise<void> {
    await this.run(b.filename, async () => {
      const check = await this.backup.verify(b.filename);
      if (check.ok) this.toast('Backup is healthy — checksum and database check passed.');
      else this.toast(`Backup problem: ${check.problems.join(' ')}`, 10000);
    });
  }

  async exportBackup(b: BackupInfo): Promise<void> {
    await this.run(b.filename, async () => {
      const saved = await this.backup.export(b.filename);
      if (saved) this.toast(`Exported and checked: ${saved}`, 6000);
    });
  }

  async deleteBackup(b: BackupInfo): Promise<void> {
    const confirmed = await this.confirm({
      title: 'Delete backup?',
      message: `The backup from ${new Date(b.createdAt).toLocaleString()} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    await this.run(b.filename, async () => {
      await this.backup.remove(b.filename);
      this.toast('Backup deleted');
    });
  }

  /** Verifies first, so damaged backups are caught before the user commits. */
  async startRestore(b: BackupInfo): Promise<void> {
    await this.run(b.filename, async () => {
      const check = await this.backup.verify(b.filename);
      if (!check.ok) {
        this.toast(`This backup can't be restored: ${check.problems.join(' ')}`, 10000);
        return;
      }
      this.dialog.open<RestoreBackupDialog, RestoreBackupDialogData, boolean>(RestoreBackupDialog, {
        width: '560px',
        // Focus the dialog itself so it opens scrolled to the top, where the
        // "your data will be replaced" warning is — not down at the input.
        autoFocus: 'dialog',
        data: { backup: check.info, current: this.backup.current() },
      });
    });
  }

  async setAutoEnabled(enabled: boolean): Promise<void> {
    await this.run(null, () => this.settings.set('backup.auto.enabled', String(enabled)));
  }

  async setAutoKeep(keep: number): Promise<void> {
    await this.run(null, () => this.settings.set('backup.auto.keep', String(keep)));
  }

  private async run(key: string | null, action: () => Promise<unknown>): Promise<void> {
    this.busy.set(key ?? 'global');
    try {
      await action();
    } catch (err) {
      this.toast(err instanceof Error ? err.message : String(err), 8000);
    } finally {
      this.busy.set(null);
    }
  }

  private confirm(data: ConfirmDialogData): Promise<boolean> {
    return new Promise((resolve) =>
      this.dialog
        .open(ConfirmDialogComponent, { data })
        .afterClosed()
        .subscribe((result) => resolve(result === true))
    );
  }

  private toast(message: string, duration = 3500): void {
    this.snack.open(message, 'OK', { duration });
  }
}
