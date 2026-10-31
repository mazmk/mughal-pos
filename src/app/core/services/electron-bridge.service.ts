import { Injectable } from '@angular/core';
import type { MughalApi } from '../../../../shared/api-contract';
import type { IpcResponse } from '../../../../shared/ipc-types';

/**
 * Thin typed wrapper around window.api.
 *
 * - Centralizes error unwrapping: every IPC returns IpcResponse<T>, this
 *   service throws on error so callers can `await` naturally.
 * - When running outside Electron (e.g. plain `ng serve` in a browser),
 *   isAvailable() returns false and methods reject. This lets the UI
 *   render a graceful offline-dev banner.
 */
@Injectable({ providedIn: 'root' })
export class ElectronBridgeService {
  private readonly bridge: MughalApi | null =
    typeof window !== 'undefined' && 'api' in window ? (window.api as MughalApi) : null;

  isAvailable(): boolean {
    return this.bridge !== null;
  }

  get api(): MughalApi {
    if (!this.bridge) {
      throw new Error('Electron bridge unavailable — are you running outside Electron?');
    }
    return this.bridge;
  }

  async unwrap<T>(response: Promise<IpcResponse<T>>): Promise<T> {
    const result = await response;
    if (!result.ok) {
      const error = new Error(result.error.message) as Error & { code?: string };
      error.code = result.error.code;
      throw error;
    }
    return result.data;
  }
}
