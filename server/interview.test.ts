import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { memoryStore } from './store';
import { sampleProfile } from '../shared/preparation.fixture';
const repositories = [
  {
    name: 'sample-app',
    url: 'https://github.com/sample/sample-app',
    description: 'A sample React app',
    language: 'JavaScript',
    signals: [
      {
        skillId: 'react',
        finding: 'package.json declares react',
        url: 'https://github.com/sample/sample-app/blob/main/package.json',
      },
    ],
    warnings: [],
  },
];
describe('private interview studio', () => {
  it('saves a profile without a target job and requires job details only when building a plan', async () => {
    const app = createApp({
      store: memoryStore(),
      demo: true,
      secret: 'a-long-test-secret-value',
      githubAnalyzer: async () => repositories,
    });
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ name: 'Candidate', email: 'profile@example.test', password: 'safe-test-password' })
      .expect(201);
    const profile = { ...sampleProfile, targetRole: '', jobDescription: '' };
    await agent.put('/api/profile').send(profile).expect(201);
    expect((await agent.get('/api/profile')).body.profile.fullName).toBe(sampleProfile.fullName);
    await agent.post('/api/github/import').send({ count: 1 }).expect(200);
    const missingRole = await agent.post('/api/preparations').send({}).expect(400);
    expect(missingRole.body.error).toContain('target role and job description');
    await agent
      .put('/api/profile')
      .send({ ...profile, targetRole: sampleProfile.targetRole })
      .expect(200);
    await agent.post('/api/preparations').send({}).expect(400);
    await agent
      .put('/api/profile')
      .send({ ...profile, jobDescription: 'Too short' })
      .expect(200);
    await agent.post('/api/preparations').send({}).expect(400);
    await agent.put('/api/profile').send(sampleProfile).expect(200);
    await agent.post('/api/preparations').send({}).expect(201);
  });
  it('persists a full profile, imports idempotently, and keeps quiz answers on the server', async () => {
    const app = createApp({
      store: memoryStore(),
      demo: true,
      secret: 'a-long-test-secret-value',
      githubAnalyzer: async () => repositories,
    });
    const a = request.agent(app),
      b = request.agent(app);
    await a
      .post('/api/auth/register')
      .send({ name: 'Candidate', email: 'a@example.test', password: 'safe-test-password' })
      .expect(201);
    await b
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'b@example.test', password: 'safe-test-password' })
      .expect(201);
    await request(app).get('/api/profile').expect(401);
    await a
      .put('/api/profile')
      .send({ ...sampleProfile, github: 'https://github.com/sample' })
      .expect(201);
    await a.post('/api/github/import').send({ count: 1 }).expect(200);
    await a.post('/api/github/import').send({ count: 1 }).expect(200);
    expect((await a.get('/api/workspace')).body.projects).toHaveLength(1);
    expect((await a.get('/api/workspace')).body.evidence).toHaveLength(1);
    expect((await b.get('/api/profile')).body.profile).toBeNull();
    const prep = (await a.post('/api/preparations').send({}).expect(201)).body;
    expect(prep.questions.length).toBeGreaterThan(0);
    expect(prep.questions[0]).not.toHaveProperty('correct');
    expect(prep.questions[0]).not.toHaveProperty('explanation');
    await b
      .patch(`/api/preparations/${prep.id}/resume`)
      .send({ draftResume: 'An unauthorized replacement resume' })
      .expect(404);
    await b
      .post(`/api/preparations/${prep.id}/quiz`)
      .send({ answers: [{ questionId: prep.questions[0].id, choice: 0 }] })
      .expect(404);
    const result = (
      await a
        .post(`/api/preparations/${prep.id}/quiz`)
        .send({
          answers: prep.questions.map((q: { id: string }) => ({ questionId: q.id, choice: 0 })),
        })
        .expect(200)
    ).body;
    expect(result.total).toBe(prep.questions.length);
    expect(result.results[0].explanation).toBeTruthy();
    const updated = (await a.get('/api/preparations')).body[0];
    expect(updated.attempts).toHaveLength(1);
    await a
      .patch(`/api/preparations/${prep.id}/resume`)
      .send({ draftResume: 'A user-edited resume with truthful details' })
      .expect(200);
    const saved = (await a.get('/api/preparations')).body[0];
    expect(saved.originalResume).toBe(sampleProfile.resume);
    expect(saved.draftResume).not.toBe(saved.originalResume);
  });
  it('rejects unsupported social-link hosts and out-of-budget timelines', async () => {
    const app = createApp({ store: memoryStore(), demo: true, secret: 'a-long-test-secret-value' });
    const agent = request.agent(app);
    await agent.post('/api/auth/demo').send({});
    await agent
      .put('/api/profile')
      .send({ ...sampleProfile, linkedin: 'https://linkedin.com.evil.test/in/me' })
      .expect(400);
    await agent
      .put('/api/profile')
      .send({ ...sampleProfile, days: 0 })
      .expect(400);
    await agent
      .put('/api/profile')
      .send({ ...sampleProfile, github: 'https://evil.test/foo' })
      .expect(400);
  });
});
