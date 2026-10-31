import { registerHealthIpc } from './health.ipc';
import { registerProductsIpc } from './products.ipc';
import { registerSettingsIpc } from './settings.ipc';

export function registerAllIpcHandlers(): void {
  registerHealthIpc();
  registerSettingsIpc();
  registerProductsIpc();
}
