import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { memoryStore } from './store';
import { sampleProfile } from '../shared/preparation.fixture';

const origin = 'http://127.0.0.1:5173';
const credentials = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'a-long-test-password',
};
const setup = () =>
  createApp({
    store: memoryStore(),
    demo: true,
    secret: 'test-session-secret-at-least-32-characters',
    origin,
  });
describe('workspace API', () => {
  let app: ReturnType<typeof setup>;
  beforeEach(() => {
    app = setup();
  });
  it('keeps actionable conflict messages when an account already exists', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const duplicate = await request(app).post('/api/auth/register').send(credentials).expect(409);
    expect(duplicate.body.error).toBe('An account with this email already exists');
  });
  it('recovers only the original account session before an existing profile draft can be saved', async () => {
    const original = request.agent(app);
    const other = request.agent(app);
    const registered = await original.post('/api/auth/register').send(credentials).expect(201);
    await original.put('/api/profile').send(sampleProfile).expect(201);
    const otherCredentials = { ...credentials, email: 'other-recovery@example.com' };
    const second = await other.post('/api/auth/register').send(otherCredentials).expect(201);
    await other
      .put('/api/profile')
      .send({ ...sampleProfile, resume: 'Other account resume remains unchanged.' })
      .expect(201);
    await original.post('/api/auth/logout').send({}).expect(200);

    const rejected = await original
      .post('/api/auth/login')
      .send({ ...otherCredentials, expectedUserId: registered.body.id })
      .expect(409);
    expect(rejected.body.error).toContain('account that opened this workspace');
    expect((await original.get('/api/session')).body.user).toBeNull();
    await original
      .put('/api/profile')
      .send({ ...sampleProfile, resume: 'Unsaved original account draft' })
      .expect(401);
    expect((await other.get('/api/profile')).body.profile.resume).toBe(
      'Other account resume remains unchanged.',
    );

    await original
      .post('/api/auth/login')
      .send({ ...credentials, expectedUserId: registered.body.id })
      .expect(200);
    await original
      .put('/api/profile')
      .send({ ...sampleProfile, resume: 'Recovered original account draft' })
      .expect(200);
    const saved = (await original.get('/api/profile')).body.profile;
    expect(saved.ownerId).toBe(registered.body.id);
    expect(saved.ownerId).not.toBe(second.body.id);
    expect(saved.resume).toBe('Recovered original account draft');
  });
  it('protects workspace access and supports account lifecycle', async () => {
    await request(app).get('/api/workspace').expect(401);
    const agent = request.agent(app);
    const user = await agent.post('/api/auth/register').send(credentials).expect(201);
    expect(user.body.passwordHash).toBeUndefined();
    expect((await agent.get('/api/session')).body.user.email).toBe(credentials.email);
    await agent.post('/api/auth/logout').send({}).expect(200);
    await agent.get('/api/workspace').expect(401);
    await agent
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong' })
      .expect(401);
    await agent.post('/api/auth/login').send(credentials).expect(200);
  });
  it('keeps users isolated and prevents cross-owner or wrong-skill evidence associations', async () => {
    const a = request.agent(app),
      b = request.agent(app);
    await a.post('/api/auth/register').send(credentials);
    await b.post('/api/auth/register').send({ ...credentials, email: 'other@example.com' });
    const project = (
      await a
        .post('/api/projects')
        .send({ title: 'Project', description: 'My project', repository: '' })
        .expect(201)
    ).body;
    const evidence = (
      await a
        .post('/api/evidence')
        .send({ projectId: project.id, skillId: 'react', statement: 'Built a React form', url: '' })
        .expect(201)
    ).body;
    await b
      .post('/api/evidence')
      .send({ projectId: project.id, skillId: 'react', statement: 'Not mine', url: '' })
      .expect(404);
    const role = (
      await b
        .post('/api/roles')
        .send({
          title: 'Developer',
          company: 'Sample',
          description: 'Required: React and Node.js experience',
        })
        .expect(201)
    ).body;
    await b
      .patch(`/api/roles/${role.id}/requirements/${role.requirements[0].id}`)
      .send({ confirmed: true, importance: 'required', evidenceIds: [evidence.id] })
      .expect(400);
    await a
      .patch(`/api/roles/${role.id}/requirements/${role.requirements[0].id}`)
      .send({ confirmed: true, importance: 'required', evidenceIds: [] })
      .expect(404);
    const workspace = (await b.get('/api/workspace')).body;
    expect(workspace.projects).toHaveLength(0);
    expect(workspace.evidence).toHaveLength(0);
  });
  it('supports localhost and 127.0.0.1 sign-in with persistent session cookies in development', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').set('Origin', origin).send(credentials).expect(201);
    await agent.post('/api/auth/logout').set('Origin', origin).send({}).expect(200);
    await agent
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send(credentials)
      .expect(200);
    expect((await agent.get('/api/session')).body.user.email).toBe(credentials.email);
    await agent
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .send({})
      .expect(200);
    await agent.post('/api/auth/login').set('Origin', origin).send(credentials).expect(200);

    const reverse = createApp({
      store: memoryStore(),
      demo: true,
      secret: 'test-session-secret-at-least-32-characters',
      origin: 'http://localhost:5173',
    });
    await request(reverse)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
  });
  it('rejects other local ports, protocols and lookalike hosts, and keeps production origins exact', async () => {
    for (const untrusted of [
      'http://localhost:5174',
      'https://localhost:5173',
      'http://localhost.example:5173',
      'null',
    ]) {
      await request(app)
        .post('/api/auth/login')
        .set('Origin', untrusted)
        .send(credentials)
        .expect(403);
    }
    const production = createApp({
      store: memoryStore(),
      demo: false,
      production: true,
      secret: 'test-session-secret-at-least-32-characters',
      origin,
    });
    await request(production)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send(credentials)
      .expect(403);
    await request(production)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(401);
  });
  it('requires review before task creation and task completion never creates evidence', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/demo').send({}).expect(200);
    const before = (await agent.get('/api/workspace')).body;
    const role = before.roles[0],
      req = role.requirements[0];
    const body = {
      roleId: role.id,
      requirementId: req.id,
      title: 'Build an example',
      criteria: 'A working example and tests',
    };
    await agent.post('/api/tasks').send(body).expect(400);
    await agent
      .patch(`/api/roles/${role.id}/requirements/${req.id}`)
      .send({ confirmed: true, importance: 'required', evidenceIds: [] })
      .expect(200);
    const task = (await agent.post('/api/tasks').send(body).expect(201)).body;
    await agent.patch(`/api/tasks/${task.id}`).send({ done: true }).expect(200);
    const after = (await agent.get('/api/workspace')).body;
    expect(after.evidence).toEqual(before.evidence);
    expect(after.roles[0].requirements[0].evidenceIds).toHaveLength(0);
    expect(after.tasks[0].done).toBe(true);
  });
  it('rejects invalid input, unsafe URLs, and untrusted browser origins', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/demo').send({});
    await agent.post('/api/projects').send({ title: ' ', description: 'text' }).expect(400);
    await agent
      .post('/api/projects')
      .send({ title: 'Project', description: 'text', repository: 'javascript:alert(1)' })
      .expect(400);
    await agent
      .post('/api/projects')
      .set('Origin', 'https://other.example')
      .send({ title: 'Project', description: 'text' })
      .expect(403);
    await agent
      .post('/api/projects')
      .set('Origin', origin)
      .send({ title: 'Project', description: 'text' })
      .expect(201);
  });
  it('isolates demo visitors and disables demo entry outside demo mode', async () => {
    const a = request.agent(app),
      b = request.agent(app);
    const first = await a.post('/api/auth/demo').send({});
    const second = await b.post('/api/auth/demo').send({});
    expect(first.body.id).not.toBe(second.body.id);
    const prodLike = createApp({
      store: memoryStore(),
      demo: false,
      secret: 'another-long-session-secret-value',
    });
    await request(prodLike).post('/api/auth/demo').send({}).expect(404);
  });
});
