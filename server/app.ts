import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './store.js';
import { extractRequirements, skills } from '../shared/domain.js';
import { interviewRoutes } from './interview.js';
import { analyzeGithub } from './github.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}
const text = z.string().trim().min(1).max(5000);
const link = z.union([
  z.literal(''),
  z.url().refine((value) => /^https?:\/\//i.test(value), 'Use an http or https link'),
]);
const skillId = z.enum(skills.map((s) => s.id) as [string, ...string[]]);
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const verifyPassword = (password: string, stored: string) => {
  const [salt, digest] = stored.split(':');
  return timingSafeEqual(Buffer.from(digest, 'hex'), scryptSync(password, salt, 64));
};
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

export function createApp(options: {
  store: Store;
  demo: boolean;
  secret: string;
  sessionStore?: session.Store;
  origin?: string;
  production?: boolean;
  githubAnalyzer?: typeof analyzeGithub;
}) {
  const { store, demo } = options;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (req, res, next) => {
    if (
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== options.origin
    ) {
      res.status(403).json({ error: 'Untrusted request origin' });
      return;
    }
    next();
  });
  if (options.production) app.set('trust proxy', 1);
  app.use(
    session({
      name: 'jobfit.sid',
      secret: options.secret,
      store: options.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(options.production),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', storage: demo ? 'local-development' : 'mongodb' }),
  );
  app.get('/api/session', async (req, res) => {
    const user = req.session.userId
      ? (await store.list('users', { id: req.session.userId }))[0]
      : null;
    res.json({ user: user ? { id: user.id, name: user.name, email: user.email } : null, demo });
  });
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  async function establish(req: express.Request, userId: string) {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.userId = userId;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
  }
  app.post('/api/auth/register', async (req, res) => {
    const input = z
      .object({
        name: text.max(80),
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(10).max(128),
      })
      .parse(req.body);
    if ((await store.list('users', { email: input.email })).length)
      fail(409, 'An account with this email already exists');
    const user = await store.insert('users', {
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
    });
    await establish(req, user.id);
    res.status(201).json({ id: user.id, name: user.name, email: user.email });
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = z
      .object({
        email: z.email().transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const user = (await store.list('users', { email: input.email }))[0];
    if (!user || !verifyPassword(input.password, user.passwordHash))
      fail(401, 'Email or password is incorrect');
    await establish(req, user.id);
    res.json({ id: user.id, name: user.name, email: user.email });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
    res.clearCookie('jobfit.sid').json({ ok: true });
  });
  app.post('/api/auth/demo', async (req, res) => {
    if (!demo) fail(404, 'Demo is disabled');
    // Every demo visitor gets an isolated workspace, not a shared mutable account.
    const user = await store.insert('users', {
      name: 'Alex Morgan',
      email: `demo-${randomBytes(8).toString('hex')}@example.test`,
      passwordHash: hashPassword(randomBytes(32).toString('hex')),
    });
    const project = await store.insert('projects', {
      ownerId: user.id,
      title: 'CollabBoard',
      description: 'A team workspace with task boards, accounts, and project permissions.',
      repository: '',
    });
    await store.insert('evidence', {
      ownerId: user.id,
      projectId: project.id,
      skillId: 'react',
      statement: 'Built task boards with reusable React components and controlled forms.',
      url: '',
    });
    await store.insert('evidence', {
      ownerId: user.id,
      projectId: project.id,
      skillId: 'auth',
      statement: 'Implemented session authentication with protected API routes.',
      url: '',
    });
    await store.insert('roles', {
      ownerId: user.id,
      title: 'Full-stack developer',
      company: 'Northstar Studio · sample role',
      description:
        'Required: React and Node.js for product development.\nMust have authentication experience.\nPreferred: API testing and background jobs.',
      requirements: extractRequirements(
        'Required: React and Node.js for product development.\nMust have authentication experience.\nPreferred: API testing and background jobs.',
      ),
      version: 1,
    });
    await establish(req, user.id);
    res.json({ id: user.id, name: user.name, email: user.email });
  });
  app.use('/api', (req, res, next) => {
    if (!req.session.userId) {
      res.status(401).json({ error: 'Please sign in' });
      return;
    }
    next();
  });
  app.get('/api/workspace', async (req, res) => {
    const ownerId = req.session.userId!;
    const [projects, evidence, roles, tasks] = await Promise.all([
      store.list('projects', { ownerId }),
      store.list('evidence', { ownerId }),
      store.list('roles', { ownerId }),
      store.list('tasks', { ownerId }),
    ]);
    res.json({ projects, evidence, roles, tasks });
  });
  app.use('/api', interviewRoutes(store, options.githubAnalyzer));
  app.post('/api/projects', async (req, res) => {
    const input = z
      .object({ title: text.max(100), description: text, repository: link.default('') })
      .parse(req.body);
    res
      .status(201)
      .json(await store.insert('projects', { ...input, ownerId: req.session.userId! }));
  });
  app.post('/api/evidence', async (req, res) => {
    const input = z
      .object({ projectId: text, skillId, statement: text, url: link.default('') })
      .parse(req.body);
    if (
      !(await store.list('projects', { id: input.projectId, ownerId: req.session.userId! })).length
    )
      fail(404, 'Project not found');
    res
      .status(201)
      .json(await store.insert('evidence', { ...input, ownerId: req.session.userId! }));
  });
  app.post('/api/roles', async (req, res) => {
    const input = z
      .object({ title: text.max(100), company: text.max(100), description: text.min(20) })
      .parse(req.body);
    res.status(201).json(
      await store.insert('roles', {
        ...input,
        ownerId: req.session.userId!,
        version: 1,
        requirements: extractRequirements(input.description),
      }),
    );
  });
  app.patch('/api/roles/:id/requirements/:requirementId', async (req, res) => {
    const input = z
      .object({
        confirmed: z.boolean(),
        importance: z.enum(['required', 'preferred', 'unclear']),
        evidenceIds: z.array(z.string()).max(50),
      })
      .parse(req.body);
    const role = (
      await store.list('roles', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!role) fail(404, 'Role not found');
    const requirement = role.requirements.find((r) => r.id === req.params.requirementId);
    if (!requirement) fail(404, 'Requirement not found');
    const evidence = await store.list('evidence', { ownerId: req.session.userId! });
    if (
      input.evidenceIds.some(
        (id) => !evidence.some((e) => e.id === id && e.skillId === requirement.skillId),
      )
    )
      fail(400, 'Evidence must belong to you and match this skill');
    Object.assign(requirement, input);
    await store.replace('roles', role);
    res.json(role);
  });
  app.post('/api/tasks', async (req, res) => {
    const input = z
      .object({ roleId: text, requirementId: text, title: text.max(200), criteria: text })
      .parse(req.body);
    const role = (await store.list('roles', { id: input.roleId, ownerId: req.session.userId! }))[0];
    if (!role?.requirements.some((r) => r.id === input.requirementId && r.confirmed))
      fail(400, 'Choose a confirmed requirement from your role');
    res
      .status(201)
      .json(await store.insert('tasks', { ...input, ownerId: req.session.userId!, done: false }));
  });
  app.patch('/api/tasks/:id', async (req, res) => {
    const input = z.object({ done: z.boolean() }).parse(req.body);
    const task = (
      await store.list('tasks', { id: String(req.params.id), ownerId: req.session.userId! })
    )[0];
    if (!task) fail(404, 'Task not found');
    Object.assign(task, input);
    await store.replace('tasks', task);
    res.json(task);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
        return;
      }
      const error = err as { status?: number; code?: number; message?: string };
      const status = error.code === 11000 ? 409 : (error.status ?? 500);
      if (status >= 500) console.error(err);
      res.status(status).json({
        error:
          status === 409
            ? 'This record already exists'
            : status >= 500
              ? 'Something went wrong. Please try again.'
              : error.message,
      });
    },
  );
  return app;
}
