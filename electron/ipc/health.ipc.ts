import { app } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { HealthStatus, Platform } from '../../shared/ipc-types';
import { getDatabasePath, getSchemaVersion } from '../database/connection';
import { getAppPaths } from '../main/paths';
import { handle } from './ipc-wrapper';

export function registerHealthIpc(): void {
  handle<[], HealthStatus>(IPC_CHANNELS.health.status, async () => {
    const schemaVersion = getSchemaVersion();
    return {
      databaseInitialized: schemaVersion > 0,
      schemaVersion,
      databasePath: getDatabasePath(),
      appVersion: app.getVersion(),
      platform: process.platform as Platform,
      userDataPath: getAppPaths().root,
    };
  });
}
