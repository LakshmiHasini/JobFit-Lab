import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Store } from './store.js';
import { analyzeGithub, githubUsername } from './github.js';
import { buildPreparation, type PrepSession } from '../shared/preparation.js';
import { skillName } from '../shared/domain.js';
import { scoreResume } from '../shared/resume-score.js';
import { resumeBuilderRoutes } from './resume-builder.js';

const short = z.string().trim().max(200);
const social = (host: string) =>
  z.union([
    z.literal(''),
    z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' && (url.hostname === host || url.hostname.endsWith('.' + host))
      );
    }, `Use an https ${host} profile URL`),
  ]);
const profileSchema = z.object({
  fullName: short.min(1),
  headline: short,
  github: z
    .string()
    .max(100)
    .default('')
    .transform((value) => (value ? githubUsername(value) : '')),
  linkedin: social('linkedin.com'),
  leetcode: social('leetcode.com'),
  gfg: social('geeksforgeeks.org'),
  experience: z.enum(['student', 'junior', 'experienced']),
  background: z.string().max(5000),
  codingContext: z.string().max(3000),
  resume: z.string().max(30000).default(''),
  targetRole: short.min(1),
  jobDescription: z.string().min(20).max(20000),
  days: z.number().int().min(1).max(60),
  hoursPerDay: z.number().min(1).max(8),
});
const publicSession = (prep: PrepSession) => ({
  ...prep,
  questions: prep.questions.map(({ correct, explanation, ...question }) => question),
});
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

export function interviewRoutes(store: Store, githubAnalyzer = analyzeGithub) {
  const router = Router();
  router.use(resumeBuilderRoutes(store));
  router.post('/resume-scans', async (req, res) => {
    const input = z
      .object({
        resume: z.string().trim().min(20).max(30000),
        jobDescription: z.string().trim().min(20).max(20000),
      })
      .parse(req.body);
    const scan = await store.insert('resumeScans', {
      ...input,
      ownerId: req.session.userId!,
      report: scoreResume(input.resume, input.jobDescription),
    });
    res.status(201).json(scan);
  });
  router.get('/resume-scans', async (req, res) => {
    const scans = await store.list('resumeScans', { ownerId: req.session.userId! });
    res.json(
      scans
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20)
        .map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          score: s.report.overallScore,
          keywordCoverage: s.report.keywordCoverage,
          version: s.report.version,
        })),
    );
  });
  router.get('/resume-scans/:id', async (req, res) => {
    const scan = (
      await store.list('resumeScans', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!scan) fail(404, 'Scan not found');
    res.json(scan);
  });
  router.get('/profile', async (req, res) =>
    res.json({
      profile: (await store.list('profiles', { ownerId: req.session.userId! }))[0] ?? null,
    }),
  );
  router.put('/profile', async (req, res) => {
    const input = profileSchema.parse(req.body);
    const existing = (await store.list('profiles', { ownerId: req.session.userId! }))[0];
    if (existing) {
      Object.assign(existing, input, {
        repositories: existing.github === input.github ? existing.repositories : [],
      });
      await store.replace('profiles', existing);
      res.json(existing);
    } else
      res.status(201).json(
        await store.insert('profiles', {
          ...input,
          ownerId: req.session.userId!,
          repositories: [],
        }),
      );
  });
  router.post(
    '/github/import',
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 6,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { count } = z
        .object({ count: z.number().int().min(1).max(8).default(5) })
        .parse(req.body);
      const ownerId = req.session.userId!;
      const profile = (await store.list('profiles', { ownerId }))[0];
      if (!profile) fail(400, 'Complete your profile first.');
      if (!profile.github)
        fail(
          400,
          'Add your GitHub handle before importing, or build a resume from manually entered projects.',
        );
      const repositories = await githubAnalyzer(profile.github, count);
      if (!repositories.length)
        fail(422, 'No public, non-fork, non-archived repositories were found.');
      const existing = await store.list('projects', { ownerId });
      const evidence = await store.list('evidence', { ownerId });
      for (const repo of repositories) {
        const project =
          existing.find((p) => p.repository === repo.url) ??
          (await store.insert('projects', {
            ownerId,
            title: repo.name,
            description:
              repo.description || `Public repository. Primary language: ${repo.language}.`,
            repository: repo.url,
          }));
        for (const signal of repo.signals) {
          if (
            evidence.some(
              (e) =>
                e.projectId === project.id && e.skillId === signal.skillId && e.url === signal.url,
            )
          )
            continue;
          const added = await store.insert('evidence', {
            ownerId,
            projectId: project.id,
            skillId: signal.skillId,
            statement: `GitHub signal (review your contribution): ${signal.finding}`,
            url: signal.url,
          });
          evidence.push(added);
        }
      }
      profile.repositories = repositories;
      await store.replace('profiles', profile);
      res.json({
        repositories,
        scope: `Analyzed ${repositories.length} most recently updated non-fork repositories from the latest 100 public repositories. Files and dependencies are signals; code was not executed.`,
      });
    },
  );
  router.get('/preparations', async (req, res) =>
    res.json(
      (await store.list('preparations', { ownerId: req.session.userId! })).map(publicSession),
    ),
  );
  router.post('/preparations', async (req, res) => {
    const profile = (await store.list('profiles', { ownerId: req.session.userId! }))[0];
    if (!profile) fail(400, 'Complete your profile first.');
    if (profile.resume.trim().length < 20)
      fail(
        400,
        'Build a new resume or upload your current resume before generating a preparation plan.',
      );
    const generated = buildPreparation(profile, profile.repositories);
    const prep = await store.insert('preparations', {
      ownerId: req.session.userId!,
      role: profile.targetRole,
      jobDescription: profile.jobDescription,
      profileSnapshot: profile,
      repositories: profile.repositories,
      plan: generated.plan,
      originalResume: profile.resume,
      draftResume: generated.draftResume,
      questions: generated.questions,
      interviewPrompts: generated.interviewPrompts,
      attempts: [],
    });
    res.status(201).json(publicSession(prep));
  });
  router.patch('/preparations/:id/resume', async (req, res) => {
    const { draftResume } = z
      .object({ draftResume: z.string().min(20).max(30000) })
      .parse(req.body);
    const prep = (
      await store.list('preparations', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!prep) fail(404, 'Preparation not found');
    prep.draftResume = draftResume;
    await store.replace('preparations', prep);
    res.json(publicSession(prep));
  });
  router.post('/preparations/:id/quiz', async (req, res) => {
    const { answers } = z
      .object({
        answers: z
          .array(z.object({ questionId: z.string(), choice: z.number().int().min(0).max(3) }))
          .min(1)
          .max(20),
      })
      .parse(req.body);
    const prep = (
      await store.list('preparations', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!prep) fail(404, 'Preparation not found');
    if (
      new Set(answers.map((a) => a.questionId)).size !== answers.length ||
      answers.some((a) => !prep.questions.some((q) => q.id === a.questionId))
    )
      fail(400, 'Submit each known question once.');
    const results = prep.questions.map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        correct: answer?.choice === q.correct,
        correctChoice: q.correct,
        explanation: q.explanation,
        skillId: q.skillId,
      };
    });
    const score = results.filter((r) => r.correct).length;
    const weakSkills = [...new Set(results.filter((r) => !r.correct).map((r) => r.skillId))];
    prep.attempts.push({ at: new Date().toISOString(), score, total: results.length, weakSkills });
    prep.attempts = prep.attempts.slice(-20);
    await store.replace('preparations', prep);
    res.json({ score, total: results.length, results, reviewTopics: weakSkills.map(skillName) });
  });
  return router;
}
