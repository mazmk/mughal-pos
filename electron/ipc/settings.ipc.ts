import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Setting } from '../../shared/ipc-types';
import { SHOP_LOGO_KEY } from '../services/branding.service';
import { settingsRepository } from '../services/settings.repository';
import { assertString, handle } from './ipc-wrapper';

export function registerSettingsIpc(): void {
  handle<[string], Setting | null>(IPC_CHANNELS.settings.get, (_e, key) =>
    settingsRepository.get(assertString(key, 'key'))
  );

  handle<[string, string], Setting>(IPC_CHANNELS.settings.set, (_e, key, value) => {
    const k = assertString(key, 'key');
    // The logo is only written by the branding service, which validates and resizes the image.
    if (k === SHOP_LOGO_KEY) throw new Error('Use branding.pickLogo() to change the shop logo');
    return settingsRepository.set(k, assertString(value, 'value'));
  });

  handle<[], Setting[]>(IPC_CHANNELS.settings.list, () => settingsRepository.list());
}
