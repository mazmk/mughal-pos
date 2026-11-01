import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  BackupCheck,
  BackupCurrentState,
  BackupInfo,
  ClearShopResult,
  RestoreResult,
} from '../../shared/ipc-types';
import { backupService } from '../services/backup.service';
import { assertString, handle } from './ipc-wrapper';

function parseNote(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  return assertString(raw, 'note').slice(0, 200);
}

export function registerBackupIpc(): void {
  handle<[unknown], BackupInfo>(IPC_CHANNELS.backup.create, (_e, note) =>
    backupService.create(parseNote(note))
  );
  handle<[], BackupInfo[]>(IPC_CHANNELS.backup.list, () => backupService.list());
  handle<[], BackupCurrentState>(IPC_CHANNELS.backup.current, () => backupService.current());

  // Filenames are re-validated inside the service (must resolve inside backups/).
  handle<[string], BackupCheck>(IPC_CHANNELS.backup.verify, (_e, filename) =>
    backupService.verify(assertString(filename, 'filename'))
  );
  handle<[string], RestoreResult>(IPC_CHANNELS.backup.restore, (_e, filename) =>
    backupService.restore(assertString(filename, 'filename'))
  );
  handle<[], BackupInfo | null>(IPC_CHANNELS.backup.import, (e) =>
    backupService.import(BrowserWindow.fromWebContents(e.sender))
  );
  handle<[string], string | null>(IPC_CHANNELS.backup.export, (e, filename) =>
    backupService.export(assertString(filename, 'filename'), BrowserWindow.fromWebContents(e.sender))
  );
  handle<[string], { filename: string }>(IPC_CHANNELS.backup.remove, (_e, filename) =>
    backupService.remove(assertString(filename, 'filename'))
  );
  handle<[], void>(IPC_CHANNELS.backup.openFolder, () => backupService.openFolder());
  handle<[], ClearShopResult>(IPC_CHANNELS.backup.clearShop, () => backupService.clearShop());
}
