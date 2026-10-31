import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Setting } from '../../shared/ipc-types';
import { settingsRepository } from '../services/settings.repository';
import { assertString, handle } from './ipc-wrapper';

export function registerSettingsIpc(): void {
  handle<[string], Setting | null>(IPC_CHANNELS.settings.get, (_e, key) =>
    settingsRepository.get(assertString(key, 'key'))
  );

  handle<[string, string], Setting>(IPC_CHANNELS.settings.set, (_e, key, value) =>
    settingsRepository.set(assertString(key, 'key'), assertString(value, 'value'))
  );

  handle<[], Setting[]>(IPC_CHANNELS.settings.list, () => settingsRepository.list());
}
