import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { memoryStore } from './store';
describe('private resume scan history', () => {
  it('computes scores on the server, preserves past scans and isolates accounts', async () => {
    const app = createApp({
      store: memoryStore(),
      demo: true,
      secret: 'a-session-secret-long-enough-for-tests',
    });
    const a = request.agent(app),
      b = request.agent(app);
    await a
      .post('/api/auth/register')
      .send({ name: 'Avery', email: 'avery@example.test', password: 'a-long-test-password' })
      .expect(201);
    await b
      .post('/api/auth/register')
      .send({ name: 'Blair', email: 'blair@example.test', password: 'a-long-test-password' })
      .expect(201);
    await request(app).get('/api/resume-scans').expect(401);
    const body = {
      resume: 'React development '.repeat(60),
      jobDescription: 'Required: React and Docker experience.',
      report: { overallScore: 100 },
    };
    const first = (await a.post('/api/resume-scans').send(body).expect(201)).body;
    expect(first.report.overallScore).not.toBe(100);
    expect(first.report.version).toBe('jobfit-resume-score-v2');
    await a
      .post('/api/resume-scans')
      .send({ ...body, resume: 'A different React resume '.repeat(40) })
      .expect(201);
    const original = (await a.get('/api/resume-scans/' + first.id).expect(200)).body;
    expect(original.resume).toBe(body.resume.trim());
    expect((await a.get('/api/resume-scans')).body).toHaveLength(2);
    expect((await a.get('/api/resume-scans')).body[0]).not.toHaveProperty('resume');
    expect((await b.get('/api/resume-scans')).body).toHaveLength(0);
    await b.get('/api/resume-scans/' + first.id).expect(404);
    await a.post('/api/resume-scans').send({ resume: '', jobDescription: '' }).expect(400);
  });
});
