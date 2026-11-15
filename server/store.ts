import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { User, Project, Evidence, Role, Task } from '../shared/domain.js';

export type Records = { users: User; projects: Project; evidence: Evidence; roles: Role; tasks: Task };
export interface Store {
  list<K extends keyof Records>(kind: K, filter: Partial<Records[K]>): Promise<Records[K][]>;
  insert<K extends keyof Records>(kind: K, data: Omit<Records[K], 'id' | 'createdAt'>): Promise<Records[K]>;
  replace<K extends keyof Records>(kind: K, value: Records[K]): Promise<void>;
}

export function memoryStore(): Store {
  const data = new Map<string, unknown[]>();
  const rows = (kind: string) => { if (!data.has(kind)) data.set(kind, []); return data.get(kind)!; };
  return {
    async list(kind, filter) {
      return structuredClone(rows(kind).filter(row => Object.entries(filter).every(([key, value]) => (row as Record<string, unknown>)[key] === value))) as never;
    },
    async insert(kind, input) {
      const row = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      rows(kind).push(structuredClone(row));
      return row as never;
    },
    async replace(kind, row) {
      const index = rows(kind).findIndex(item => (item as { id: string }).id === row.id);
      if (index < 0) throw new Error('Record not found');
      rows(kind)[index] = structuredClone(row);
    }
  };
}

export async function mongoStore(uri: string): Promise<Store> {
  await mongoose.connect(uri);
  const base = { id: { type: String, required: true, unique: true }, createdAt: { type: String, required: true } };
  const owned = { ...base, ownerId: { type: String, required: true, index: true } };
  const schemas = {
    users: new mongoose.Schema({ ...base, name: String, email: { type: String, unique: true, required: true }, passwordHash: { type: String, required: true } }),
    projects: new mongoose.Schema({ ...owned, title: String, description: String, repository: String }),
    evidence: new mongoose.Schema({ ...owned, projectId: { type: String, index: true }, skillId: String, statement: String, url: String }),
    roles: new mongoose.Schema({ ...owned, title: String, company: String, description: String, version: Number, requirements: [{ _id: false, id: String, skillId: String, excerpt: String, importance: String, confirmed: Boolean, evidenceIds: [String] }] }),
    tasks: new mongoose.Schema({ ...owned, roleId: String, requirementId: String, title: String, criteria: String, done: Boolean })
  };
  const models = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, mongoose.models[name] ?? mongoose.model(name, schema)]));
  await Promise.all(Object.values(models).map(model => model.init()));
  return {
    async list(kind, filter) { return await models[kind].find(filter).select('-_id -__v').lean() as never; },
    async insert(kind, input) {
      const row = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      await models[kind].create(row);
      return row as never;
    },
    async replace(kind, row) { await models[kind].replaceOne({ id: row.id }, row, { runValidators: true }); }
  };
}
