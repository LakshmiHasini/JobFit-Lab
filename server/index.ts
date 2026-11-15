import 'dotenv/config';
import MongoStore from 'connect-mongo';
import { randomBytes } from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { createApp } from './app.js';
import { mongoStore } from './store.js';
import { localStorage } from './local.js';

const demo = process.env.DEMO_MODE !== 'false';
const production = process.env.NODE_ENV === 'production';
if (production && demo)
  throw new Error('Demo mode cannot run in production. Configure MongoDB and set DEMO_MODE=false.');
if (production && !process.env.APP_ORIGIN?.startsWith('https://'))
  throw new Error('Production requires an HTTPS APP_ORIGIN.');
if (
  !demo &&
  (!process.env.MONGODB_URI ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32)
)
  throw new Error(
    'MongoDB mode requires MONGODB_URI and a SESSION_SECRET of at least 32 characters.',
  );
const local = demo ? await localStorage(path.resolve('.data')) : null;
const store = local ? local.store : await mongoStore(process.env.MONGODB_URI!);
const app = createApp({
  store,
  demo,
  production,
  origin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173',
  secret: process.env.SESSION_SECRET || local?.secret || randomBytes(32).toString('hex'),
  sessionStore: local
    ? local.sessionStore
    : MongoStore.create({ mongoUrl: process.env.MONGODB_URI! }),
});
if (production) {
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
}
const server = app.listen(
  Number(process.env.PORT ?? 3001),
  production ? '0.0.0.0' : '127.0.0.1',
  () =>
    console.log(
      `JobFit API: http://127.0.0.1:${process.env.PORT ?? 3001} (${demo ? 'local development storage' : 'MongoDB'})`,
    ),
);
process.on('SIGTERM', () => server.close(() => process.exit(0)));
