import session from 'express-session';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Store, Records } from './store.js';

type State = {
  secret: string;
  records: Record<string, unknown[]>;
  sessions: Record<string, session.SessionData>;
};
// Single-process development storage only. MongoDB remains the production adapter.
export async function localStorage(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'workspace.json');
  let state: State;
  try {
    state = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    state = { secret: randomBytes(32).toString('hex'), records: {}, sessions: {} };
  }
  let pending = Promise.resolve();
  const flush = () => {
    const snapshot = JSON.stringify(state);
    const operation = pending.then(async () => {
      await writeFile(file + '.tmp', snapshot, { mode: 0o600 });
      await rename(file + '.tmp', file);
    });
    pending = operation.catch(() => {});
    return operation;
  };
  await flush();
  const rows = (kind: string) => state.records[kind] ?? (state.records[kind] = []);
  const store: Store = {
    async list(kind, filter) {
      return structuredClone(
        rows(kind).filter((row) =>
          Object.entries(filter).every(
            ([key, value]) => (row as Record<string, unknown>)[key] === value,
          ),
        ),
      ) as never;
    },
    async insert(kind, input) {
      const row = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      rows(kind).push(structuredClone(row));
      await flush();
      return row as never;
    },
    async replace(kind, row) {
      const index = rows(kind).findIndex((item) => (item as { id: string }).id === row.id);
      if (index < 0) throw new Error('Record not found');
      rows(kind)[index] = structuredClone(row);
      await flush();
    },
  };
  class LocalSessions extends session.Store {
    get(id: string, callback: (err: unknown, value?: session.SessionData | null) => void) {
      const value = state.sessions[id];
      const expires = value?.cookie?.expires;
      if (expires && new Date(expires).getTime() <= Date.now()) {
        delete state.sessions[id];
        void flush().then(
          () => callback(null, null),
          (error) => callback(error),
        );
        return;
      }
      callback(null, value ? structuredClone(value) : null);
    }
    set(id: string, value: session.SessionData, callback?: (error?: unknown) => void) {
      state.sessions[id] = structuredClone(value);
      void flush().then(
        () => callback?.(),
        (error) => callback?.(error),
      );
    }
    destroy(id: string, callback?: (error?: unknown) => void) {
      delete state.sessions[id];
      void flush().then(
        () => callback?.(),
        (error) => callback?.(error),
      );
    }
    touch(id: string, value: session.SessionData, callback?: (error?: unknown) => void) {
      this.set(id, value, callback);
    }
  }
  return { store, sessionStore: new LocalSessions(), secret: state.secret };
}
