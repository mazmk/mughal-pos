import { dialog, nativeImage, type BrowserWindow } from 'electron';
import { readFileSync, statSync } from 'node:fs';
import type { Setting } from '../../shared/ipc-types';
import { settingsRepository } from './settings.repository';

/** Setting holding the shop logo as a PNG data URL ('' = use the Mughal POS mark). */
export const SHOP_LOGO_KEY = 'shop.logo';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
// Shown at ~40px tall in the header; 256px keeps it crisp on high-DPI screens
// while the stored data URL stays small (it lives in the settings table, so it
// is included in every backup).
const MAX_HEIGHT = 256;
const MAX_WIDTH = 1024;

export const brandingService = {
  async pickLogo(parent: BrowserWindow | null): Promise<Setting | null> {
    const options: Electron.OpenDialogOptions = {
      title: 'Choose shop logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    };
    const picked = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    const file = picked.filePaths[0];
    if (picked.canceled || !file) return null;

    if (statSync(file).size > MAX_INPUT_BYTES) {
      throw new Error('That image is larger than 5 MB. Choose a smaller file.');
    }
    // nativeImage decodes PNG/JPEG only; anything else comes back empty.
    const image = nativeImage.createFromBuffer(readFileSync(file));
    if (image.isEmpty()) throw new Error('That file is not a PNG or JPEG image.');

    const { width, height } = image.getSize();
    const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
    const normalised =
      scale < 1
        ? image.resize({
            width: Math.round(width * scale),
            height: Math.round(height * scale),
            quality: 'best',
          })
        : image;

    const dataUrl = `data:image/png;base64,${normalised.toPNG().toString('base64')}`;
    return settingsRepository.set(SHOP_LOGO_KEY, dataUrl);
  },

  clearLogo(): void {
    settingsRepository.set(SHOP_LOGO_KEY, '');
  },
};
