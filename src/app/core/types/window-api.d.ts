import type { MughalApi } from '../../../../shared/api-contract';

declare global {
  interface Window {
    readonly api: MughalApi;
  }
}

export {};
