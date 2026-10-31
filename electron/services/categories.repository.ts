import { getDatabase } from '../database/connection';
import type { Category, CategoryPatch, NewCategory } from '../../shared/ipc-types';

interface Row {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const toCategory = (r: Row): Category => ({
  id: r.id,
  name: r.name,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const categoriesRepository = {
  list(): Category[] {
    const rows = getDatabase()
      .prepare(`SELECT * FROM categories ORDER BY name COLLATE NOCASE`)
      .all() as Row[];
    return rows.map(toCategory);
  },

  get(id: number): Category | null {
    const r = getDatabase().prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as
      | Row
      | undefined;
    return r ? toCategory(r) : null;
  },

  create(input: NewCategory): Category {
    const result = getDatabase()
      .prepare(`INSERT INTO categories (name, description) VALUES (@name, @description)`)
      .run({ name: input.name, description: input.description });
    const created = this.get(Number(result.lastInsertRowid));
    if (!created) throw new Error('Category insert succeeded but row not found');
    return created;
  },

  update(id: number, patch: CategoryPatch): Category {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id };
    if (patch.name !== undefined) {
      fields.push('name = @name');
      values['name'] = patch.name;
    }
    if (patch.description !== undefined) {
      fields.push('description = @description');
      values['description'] = patch.description;
    }
    if (fields.length === 0) {
      const existing = this.get(id);
      if (!existing) throw new Error(`Category ${id} not found`);
      return existing;
    }
    fields.push(`updated_at = datetime('now')`);
    getDatabase()
      .prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = @id`)
      .run(values);
    const next = this.get(id);
    if (!next) throw new Error(`Category ${id} not found after update`);
    return next;
  },

  remove(id: number): { id: number } {
    getDatabase().prepare(`DELETE FROM categories WHERE id = ?`).run(id);
    return { id };
  },
};
