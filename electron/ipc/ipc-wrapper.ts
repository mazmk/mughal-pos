import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { IpcResponse } from '../../shared/ipc-types';

/**
 * Wraps every IPC handler so:
 *   - channel registration is centralized
 *   - thrown errors become structured IpcError responses (never bubble)
 *   - renderer always receives { ok: true, data } | { ok: false, error }
 *
 * Handlers run in the main process. Validate inputs here before touching the DB.
 */
export function handle<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const data = await handler(event, ...(args as TArgs));
      return { ok: true, data } satisfies IpcResponse<TResult>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ipc:${channel}]`, message);
      return {
        ok: false,
        error: {
          code: 'HANDLER_ERROR',
          message,
        },
      } satisfies IpcResponse<TResult>;
    }
  });
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}: expected finite number`);
  }
  return value;
}

export function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}: expected string`);
  }
  return value;
}

export function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected object`);
  }
  return value as Record<string, unknown>;
}
