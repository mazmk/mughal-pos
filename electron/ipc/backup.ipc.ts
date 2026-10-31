import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { BackupInfo } from '../../shared/ipc-types';
import { backupService } from '../services/backup.service';
import { handle } from './ipc-wrapper';

export function registerBackupIpc(): void {
  handle<[], BackupInfo>(IPC_CHANNELS.backup.create, () => backupService.create());
  handle<[], BackupInfo[]>(IPC_CHANNELS.backup.list, () => backupService.list());
}
