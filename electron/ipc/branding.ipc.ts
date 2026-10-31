import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Setting } from '../../shared/ipc-types';
import { brandingService } from '../services/branding.service';
import { handle } from './ipc-wrapper';

export function registerBrandingIpc(): void {
  handle<[], Setting | null>(IPC_CHANNELS.branding.pickLogo, (e) =>
    brandingService.pickLogo(BrowserWindow.fromWebContents(e.sender))
  );

  handle<[], void>(IPC_CHANNELS.branding.clearLogo, () => brandingService.clearLogo());
}
