import { app } from 'electron';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Centralized filesystem layout for Mughal POS user data.
 * Everything lives under <userData>/TuckShop so the whole folder can be
 * copied to another machine to migrate.
 */
export interface AppPaths {
  root: string;
  database: string;
  databaseFile: string;
  uploads: string;
  productImages: string;
  backups: string;
  exports: string;
  configFile: string;
}

let cached: AppPaths | null = null;

export function getAppPaths(): AppPaths {
  if (cached) return cached;

  const root = join(app.getPath('userData'), 'TuckShop');
  const paths: AppPaths = {
    root,
    database: join(root, 'database'),
    databaseFile: join(root, 'database', 'tuckshop.db'),
    uploads: join(root, 'uploads'),
    productImages: join(root, 'uploads', 'products'),
    backups: join(root, 'backups'),
    exports: join(root, 'exports'),
    configFile: join(root, 'config.json'),
  };

  for (const dir of [
    paths.root,
    paths.database,
    paths.uploads,
    paths.productImages,
    paths.backups,
    paths.exports,
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  cached = paths;
  return paths;
}
