import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { memoryStore } from './store';
import { builderInput } from '../shared/resume-builder.fixture';
import { sampleProfile } from '../shared/preparation.fixture';
const app = () =>
  createApp({ store: memoryStore(), demo: true, secret: 'resume-builder-test-session-secret' });
describe('new resume workflow', () => {
  it('supports no existing resume and no GitHub import through preparation generation', async () => {
    const service = app(),
      a = request.agent(service),
      b = request.agent(service);
    await a
      .post('/api/auth/register')
      .send({ name: 'Avery', email: 'a@example.test', password: 'a-long-password' })
      .expect(201);
    await b
      .post('/api/auth/register')
      .send({ name: 'Blair', email: 'b@example.test', password: 'b-long-password' })
      .expect(201);
    await a
      .put('/api/profile')
      .send({ ...sampleProfile, resume: '', github: '' })
      .expect(201);
    await a.post('/api/preparations').send({}).expect(400);
    const built = (await a.post('/api/resume-drafts').send(builderInput).expect(201)).body;
    expect((await a.get('/api/profile')).body.profile.resume).toBe('');
    await b
      .patch('/api/resume-drafts/' + built.id)
      .send({ text: 'An unauthorized resume replacement' })
      .expect(404);
    await b
      .post('/api/resume-drafts/' + built.id + '/use')
      .send({})
      .expect(404);
    expect((await b.get('/api/resume-drafts')).body).toHaveLength(0);
    await a
      .post('/api/resume-drafts/' + built.id + '/use')
      .send({})
      .expect(200);
    const profile = (await a.get('/api/profile')).body.profile;
    expect(profile.resume).toBe(built.text);
    expect(profile.targetRole).toBe(builderInput.targetRole);
    const prep = (await a.post('/api/preparations').send({}).expect(201)).body;
    expect(prep.originalResume).toBe(built.text);
    expect(prep.repositories).toHaveLength(0);
  });
  it('requires explicit replacement and retains the previous resume and initial generated version', async () => {
    const a = request.agent(app());
    await a.post('/api/auth/demo').send({});
    await a.put('/api/profile').send(sampleProfile).expect(201);
    const built = (await a.post('/api/resume-drafts').send(builderInput).expect(201)).body;
    const edited = built.text + '\n\nAdditional user-reviewed detail.';
    await a
      .patch('/api/resume-drafts/' + built.id)
      .send({ text: edited })
      .expect(200);
    await a
      .post('/api/resume-drafts/' + built.id + '/use')
      .send({})
      .expect(409);
    const used = (
      await a
        .post('/api/resume-drafts/' + built.id + '/use')
        .send({ replaceExisting: true })
        .expect(200)
    ).body;
    expect(used.profile.resume).toBe(edited);
    expect(used.draft.previousProfileResumes).toContain(sampleProfile.resume);
    expect(used.draft.generatedText).toBe(built.generatedText);
  });
  it('requires fact confirmation and rejects project references from another account', async () => {
    const service = app(),
      a = request.agent(service),
      b = request.agent(service);
    await a.post('/api/auth/demo').send({});
    await b.post('/api/auth/demo').send({});
    await a
      .post('/api/resume-drafts')
      .send({ ...builderInput, confirmedFacts: false })
      .expect(400);
    const other = (await b.get('/api/workspace')).body.projects[0];
    const invalid = structuredClone(builderInput);
    invalid.projects[0].sourceProjectId = other.id;
    await a.post('/api/resume-drafts').send(invalid).expect(404);
    await request(service).get('/api/resume-drafts').expect(401);
  });
});
