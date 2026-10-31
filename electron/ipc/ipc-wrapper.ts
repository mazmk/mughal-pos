import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { IpcResponse } from '../../shared/ipc-types';

/**
 * Maintenance lock. While set (e.g. during a backup restore, when the database
 * file is being swapped), every channel except health and backup:list is
 * refused, so no sale or stock change can be written to a database that is
 * about to be replaced.
 */
let maintenanceReason: string | null = null;
const ALLOWED_DURING_MAINTENANCE = new Set(['health:status', 'backup:list']);

export function setMaintenance(reason: string | null): void {
  maintenanceReason = reason;
}

export function isInMaintenance(): boolean {
  return maintenanceReason !== null;
}

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
    if (maintenanceReason && !ALLOWED_DURING_MAINTENANCE.has(channel)) {
      return {
        ok: false,
        error: { code: 'MAINTENANCE', message: `${maintenanceReason} Please wait a moment.` },
      } satisfies IpcResponse<TResult>;
    }
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
