import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { localStorage } from './local';
import { createApp } from './app';
import { sampleProfile } from '../shared/preparation.fixture';

describe('local profile and session persistence', () => {
  it('removes an expired session from disk before reporting it missing', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'jobfit-expired-session-'));
    try {
      const first = await localStorage(dir);
      const expired = { cookie: { expires: new Date(Date.now() - 1000) } } as never;
      await new Promise<void>((resolve, reject) =>
        first.sessionStore.set('expired', expired, (error) => (error ? reject(error) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        first.sessionStore.get('expired', (error, value) => {
          if (error) return reject(error);
          expect(value).toBeNull();
          resolve();
        }),
      );
      const persisted = JSON.parse(
        await (await import('node:fs/promises')).readFile(path.join(dir, 'workspace.json'), 'utf8'),
      );
      expect(persisted.sessions.expired).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('keeps a saved profile, password login, and cookie session after reinitialization', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'jobfit-persistence-'));
    try {
      const first = await localStorage(dir);
      const app = createApp({ ...first, demo: true });
      const agent = request.agent(app);
      const credentials = {
        name: 'Persistence test',
        email: 'persist@example.test',
        password: 'persistent-test-password',
      };
      const registered = await agent.post('/api/auth/register').send(credentials).expect(201);
      const cookie = registered.headers['set-cookie'][0].split(';')[0];
      await agent.put('/api/profile').send(sampleProfile).expect(201);
      const reopened = await localStorage(dir);
      expect(reopened.secret).toBe(first.secret);
      const afterRestart = createApp({ ...reopened, demo: true });
      const loaded = await request(afterRestart)
        .get('/api/profile')
        .set('Cookie', cookie)
        .expect(200);
      expect(loaded.body.profile.resume).toBe(sampleProfile.resume);
      expect(loaded.body.profile.ownerId).toBe(registered.body.id);
      await request(afterRestart).post('/api/auth/login').send(credentials).expect(200);
      expect((await stat(path.join(dir, 'workspace.json'))).mode & 0o777).toBe(0o600);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
