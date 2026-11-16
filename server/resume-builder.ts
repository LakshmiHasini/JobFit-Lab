import { Router } from 'express';
import { z } from 'zod';
import { buildResume } from '../shared/resume-builder.js';
import type { Store } from './store.js';
import { githubUsername } from './github.js';
const optionalText = z.string().trim().max(5000).default('');
const url = z
  .union([
    z.literal(''),
    z.url().refine((v) => /^https?:\/\//i.test(v), 'Use an http or https link'),
  ])
  .default('');
const githubUrl = url.refine(
  (value) => !value || ['github.com', 'www.github.com'].includes(new URL(value).hostname),
  'Use a github.com profile or repository URL.',
);
export const resumeInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.union([z.literal(''), z.email()]).default(''),
  phone: z.string().trim().max(60).default(''),
  location: z.string().trim().max(200).default(''),
  github: githubUrl,
  linkedin: url,
  leetcode: url,
  gfg: url,
  summary: optionalText,
  education: optionalText,
  experience: optionalText,
  certifications: optionalText,
  skills: z.string().trim().max(2000).default(''),
  targetRole: z.string().trim().min(1).max(200),
  jobDescription: z.string().trim().min(20).max(20000),
  confirmedFacts: z.literal(true),
  projects: z
    .array(
      z.object({
        sourceProjectId: z.string().max(100).default(''),
        title: z.string().trim().min(1).max(200),
        technologies: z.string().trim().max(500).default(''),
        situation: optionalText,
        task: optionalText,
        action: z.string().trim().min(10).max(5000),
        result: optionalText,
        featured: z.boolean().default(false),
        link: url,
      }),
    )
    .min(1)
    .max(6),
});
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export function resumeBuilderRoutes(store: Store) {
  const router = Router();
  router.post('/resume-drafts', async (req, res) => {
    const input = resumeInputSchema.parse(req.body);
    const ownerId = req.session.userId!;
    const projects = await store.list('projects', { ownerId });
    if (
      input.projects.some(
        (p) => p.sourceProjectId && !projects.some((owned) => owned.id === p.sourceProjectId),
      )
    )
      fail(404, 'A selected project is not in your workspace.');
    const generatedText = buildResume(input);
    if (generatedText.length > 30000)
      fail(
        400,
        'The generated resume exceeds 30,000 characters. Shorten the project descriptions.',
      );
    res.status(201).json(
      await store.insert('resumeDrafts', {
        ownerId,
        input,
        generatedText,
        text: generatedText,
        previousProfileResumes: [],
      }),
    );
  });
  router.get('/resume-drafts', async (req, res) =>
    res.json(
      (await store.list('resumeDrafts', { ownerId: req.session.userId! })).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    ),
  );
  router.patch('/resume-drafts/:id', async (req, res) => {
    const { text } = z.object({ text: z.string().trim().min(20).max(30000) }).parse(req.body);
    const draft = (
      await store.list('resumeDrafts', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!draft) fail(404, 'Resume draft not found');
    draft.text = text;
    await store.replace('resumeDrafts', draft);
    res.json(draft);
  });
  router.post('/resume-drafts/:id/use', async (req, res) => {
    const { replaceExisting } = z
      .object({ replaceExisting: z.boolean().default(false) })
      .parse(req.body);
    const ownerId = req.session.userId!;
    const draft = (await store.list('resumeDrafts', { id: String(req.params.id), ownerId }))[0];
    if (!draft) fail(404, 'Resume draft not found');
    let profile = (await store.list('profiles', { ownerId }))[0];
    if (profile?.resume.trim() && profile.resume !== draft.text) {
      if (!replaceExisting)
        fail(
          409,
          'Confirm replacing your existing profile resume. The previous version will be retained.',
        );
      if (!draft.previousProfileResumes.includes(profile.resume))
        draft.previousProfileResumes.push(profile.resume);
      await store.replace('resumeDrafts', draft);
    }
    if (profile) {
      profile.resume = draft.text;
      profile.targetRole = draft.input.targetRole;
      profile.jobDescription = draft.input.jobDescription;
      await store.replace('profiles', profile);
    } else
      profile = await store.insert('profiles', {
        ownerId,
        fullName: draft.input.fullName,
        headline: '',
        github: draft.input.github ? githubUsername(draft.input.github) : '',
        linkedin: draft.input.linkedin,
        leetcode: draft.input.leetcode,
        gfg: draft.input.gfg,
        experience: 'student',
        background: draft.input.summary,
        codingContext: '',
        resume: draft.text,
        targetRole: draft.input.targetRole,
        jobDescription: draft.input.jobDescription,
        days: 14,
        hoursPerDay: 2,
        repositories: [],
      });
    res.json({ profile, draft });
  });
  return router;
}
