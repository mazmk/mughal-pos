import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Category, CategoryPatch, NewCategory } from '../../shared/ipc-types';
import { categoriesRepository } from '../services/categories.repository';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

function parseNewCategory(raw: unknown): NewCategory {
  const o = assertObject(raw, 'category');
  return {
    name: assertString(o['name'], 'name'),
    description:
      o['description'] === null || o['description'] === undefined
        ? null
        : assertString(o['description'], 'description'),
  };
}

function parsePatch(raw: unknown): CategoryPatch {
  const o = assertObject(raw, 'patch');
  const patch: CategoryPatch = {};
  if ('name' in o) patch.name = assertString(o['name'], 'name');
  if ('description' in o)
    patch.description =
      o['description'] === null ? null : assertString(o['description'], 'description');
  return patch;
}

export function registerCategoriesIpc(): void {
  handle<[], Category[]>(IPC_CHANNELS.categories.list, () => categoriesRepository.list());

  handle<[number], Category | null>(IPC_CHANNELS.categories.get, (_e, id) =>
    categoriesRepository.get(assertNumber(id, 'id'))
  );

  handle<[unknown], Category>(IPC_CHANNELS.categories.create, (_e, input) =>
    categoriesRepository.create(parseNewCategory(input))
  );

  handle<[number, unknown], Category>(IPC_CHANNELS.categories.update, (_e, id, patch) =>
    categoriesRepository.update(assertNumber(id, 'id'), parsePatch(patch))
  );

  handle<[number], { id: number }>(IPC_CHANNELS.categories.remove, (_e, id) =>
    categoriesRepository.remove(assertNumber(id, 'id'))
  );
}
