import { extractRequirements, skillName } from './domain.js';

export type CareerProfile = {
  id: string;
  ownerId: string;
  createdAt: string;
  fullName: string;
  headline: string;
  github: string;
  linkedin: string;
  leetcode: string;
  gfg: string;
  experience: 'student' | 'junior' | 'experienced';
  background: string;
  codingContext: string;
  resume: string;
  targetRole: string;
  jobDescription: string;
  days: number;
  hoursPerDay: number;
  repositories: RepositoryAnalysis[];
};
export type RepoSignal = { skillId: string; finding: string; url: string };
export type RepositoryAnalysis = {
  name: string;
  url: string;
  description: string;
  language: string;
  signals: RepoSignal[];
  warnings: string[];
};
export type Question = {
  id: string;
  skillId: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};
export type DayPlan = {
  day: number;
  title: string;
  activities: { title: string; minutes: number; outcome: string }[];
};
export const codingExercises = [
  {
    title: 'Two-sum with distinct indices',
    prompt:
      'Given an integer array and a target, return the indices of two distinct elements whose sum equals the target, or null if no pair exists.',
    example: 'Input: [2, 7, 11, 15], target 9 → [0, 1]. Input: [3, 3], target 6 → [0, 1].',
    approach:
      'Scan once with a map from value to earlier index. Check for the complement before inserting the current element. Time O(n), additional space O(n). Test duplicate values, negatives, and no solution.',
  },
  {
    title: 'Longest substring without repeated characters',
    prompt:
      'Return the length of the longest substring that contains no repeated characters. State whether your solution treats characters as UTF-16 units or Unicode code points.',
    example: 'Input: "abcabcbb" → 3. Input: "bbbbb" → 1. Input: "" → 0.',
    approach:
      'Use a sliding window and last-seen positions. Move the left boundary forward when a repeat falls inside the window. Time O(n), space O(k) for the distinct characters tracked.',
  },
  {
    title: 'Design an idempotent background job',
    prompt:
      'An email notification job may be delivered twice. Sketch a design that records a logical operation ID, retries transient failures, and explains what happens if the worker crashes after sending but before recording success.',
    example:
      'Two jobs share operation ID welcome-user-42. Describe how duplicate delivery and partial failure are handled.',
    approach:
      'Use a durable operation record and unique key, plus provider-supported idempotency where available. A database flag alone does not guarantee exactly-once external delivery across a crash. Explain the tradeoff, reconciliation strategy, and tests.',
  },
];
export type PrepSession = {
  id: string;
  ownerId: string;
  createdAt: string;
  role: string;
  jobDescription: string;
  profileSnapshot: CareerProfile;
  repositories: RepositoryAnalysis[];
  plan: DayPlan[];
  originalResume: string;
  draftResume: string;
  questions: Question[];
  interviewPrompts: string[];
  attempts: { at: string; score: number; total: number; weakSkills: string[] }[];
};

// Curated questions have authored answers. No generated hiring/readiness score.
const bank: Omit<Question, 'id'>[] = [
  {
    skillId: 'react',
    prompt: 'A React state update depends on the previous value. Which update is safest?',
    options: [
      'setCount(count + 1) in every delayed callback',
      'setCount(previous => previous + 1)',
      'Mutate count directly',
      'Write count into the DOM',
    ],
    correct: 1,
    explanation:
      'A functional updater receives the pending state, avoiding stale values captured by a delayed callback.',
  },
  {
    skillId: 'node',
    prompt:
      'Which task should usually be moved off a Node.js request handler to avoid blocking other requests?',
    options: [
      'Reading a query parameter',
      'Returning JSON',
      'A CPU-heavy synchronous calculation',
      'Awaiting an asynchronous database query',
    ],
    correct: 2,
    explanation:
      'CPU-heavy synchronous work blocks the event loop. Worker threads or a separate worker service can handle it.',
  },
  {
    skillId: 'express',
    prompt: 'Where should an Express API enforce ownership of a private project?',
    options: [
      'Only in the React route guard',
      'In backend authorization before accessing the record',
      'Only by hiding the project ID',
      'Only in a CSS class',
    ],
    correct: 1,
    explanation:
      'The server must authenticate the caller and constrain access by owner or authorized membership. UI controls are not access control.',
  },
  {
    skillId: 'mongo',
    prompt:
      'An application frequently finds records by ownerId and createdAt. What should guide index design?',
    options: [
      'Index every field',
      'Use only an index on the largest string',
      'Inspect query patterns and consider a compound index',
      'Avoid indexes for all user data',
    ],
    correct: 2,
    explanation:
      'Indexes should follow actual filter and sort patterns. A suitable compound index may help; measure query plans and consider write overhead.',
  },
  {
    skillId: 'typescript',
    prompt: 'What happens to TypeScript types at runtime?',
    options: [
      'They validate every HTTP request automatically',
      'They are erased; external input still needs runtime validation',
      'They encrypt request bodies',
      'They replace database constraints',
    ],
    correct: 1,
    explanation:
      'Static types do not validate untrusted JSON at runtime. Use runtime schemas or explicit validation at system boundaries.',
  },
  {
    skillId: 'javascript',
    prompt: 'Why can Promise.all be inappropriate for a very large set of network requests?',
    options: [
      'It always executes sequentially',
      'It prevents all errors',
      'It can start too many concurrent operations',
      'It only supports strings',
    ],
    correct: 2,
    explanation:
      'Mapping a large collection to promises can start all requests at once. Use a concurrency limit when resources or upstream rate limits matter.',
  },
  {
    skillId: 'java',
    prompt: 'Which statement about equals and hashCode is correct?',
    options: [
      'Equal objects must have equal hash codes',
      'Matching hash codes prove equality',
      'equals compares only memory addresses in every class',
      'hashCode must always be unique',
    ],
    correct: 0,
    explanation:
      'Objects considered equal must have the same hash code. Hash collisions can occur, so matching hashes do not prove equality.',
  },
  {
    skillId: 'testing',
    prompt: 'Which test best checks private-record authorization?',
    options: [
      'Assert a button is purple',
      'Have a second account request the first account’s record',
      'Snapshot the login heading',
      'Check only the HTTP success path',
    ],
    correct: 1,
    explanation:
      'A cross-account request exercises the actual ownership boundary and helps catch insecure direct object access.',
  },
  {
    skillId: 'auth',
    prompt: 'Why regenerate a session ID after successful login?',
    options: [
      'To reduce JSON size',
      'To mitigate session fixation',
      'To replace password hashing',
      'To make the cookie readable by JavaScript',
    ],
    correct: 1,
    explanation:
      'Regenerating the session ID prevents a pre-login session identifier from being reused as the authenticated session.',
  },
  {
    skillId: 'jobs',
    prompt: 'A queue may deliver the same job again. What property should its handler aim for?',
    options: [
      'Depend on running exactly once',
      'Ignore all failures',
      'Be idempotent for the same logical operation',
      'Always create a new payment',
    ],
    correct: 2,
    explanation:
      'Retries and duplicate delivery are possible. An idempotent handler avoids repeating side effects for the same operation.',
  },
  {
    skillId: 'docker',
    prompt: 'Where should runtime secrets be supplied to a container?',
    options: [
      'Committed in the Dockerfile',
      'In the image name',
      'Through runtime secret/environment configuration',
      'In a public README',
    ],
    correct: 2,
    explanation:
      'Supply secrets at runtime using the deployment system’s secret facilities. Do not bake them into an image or repository.',
  },
  {
    skillId: 'sql',
    prompt: 'Why use a database transaction when moving value between two accounts?',
    options: [
      'To guarantee related changes commit or roll back together',
      'To remove all authorization checks',
      'To prevent every possible application bug',
      'To avoid storing a balance',
    ],
    correct: 0,
    explanation:
      'A transaction provides atomicity for related updates. Correct constraints, isolation, validation, and authorization still matter.',
  },
];

export function buildPreparation(profile: CareerProfile, repositories: RepositoryAnalysis[]) {
  const required = [...new Set(extractRequirements(profile.jobDescription).map((r) => r.skillId))];
  const observed = new Set(repositories.flatMap((r) => r.signals.map((s) => s.skillId)));
  const topics = (required.length ? required : ['javascript', 'testing', 'auth']).sort(
    (a, b) => Number(observed.has(a)) - Number(observed.has(b)),
  );
  const minutes = Math.round(profile.hoursPerDay * 60);
  const plan: DayPlan[] = Array.from({ length: profile.days }, (_, index) => {
    const last = index === profile.days - 1;
    const topic = topics[index % topics.length];
    const study = Math.floor(minutes * 0.4),
      practice = Math.floor(minutes * 0.4);
    return {
      day: index + 1,
      title: last
        ? 'Resume review and mock interview'
        : `${skillName(topic)} · ${observed.has(topic) ? 'explain your project decisions' : 'close an evidence gap'}`,
      activities: last
        ? [
            {
              title: 'Review the tailored resume',
              minutes: Math.floor(minutes / 2),
              outcome: 'Every claim is accurate, relevant, and supported by your experience.',
            },
            {
              title: 'Run a timed mock interview',
              minutes: minutes - Math.floor(minutes / 2),
              outcome:
                'Answer a technical question, a project deep dive, and a behavioral prompt; note what to improve.',
            },
          ]
        : [
            {
              title: `Review ${skillName(topic)} fundamentals`,
              minutes: study,
              outcome: `Write a concise explanation of ${skillName(topic)} and one relevant tradeoff.`,
            },
            {
              title: observed.has(topic)
                ? 'Inspect and explain a relevant project file'
                : 'Build a small demonstrable example',
              minutes: practice,
              outcome: observed.has(topic)
                ? 'Record the source file, design decision, failure case, and what you personally contributed.'
                : 'Produce runnable code and a test or reproducible example; record the limitation.',
            },
            {
              title: 'Practice retrieval without notes',
              minutes: minutes - study - practice,
              outcome: 'Answer a practice question, check the explanation, and record a follow-up.',
            },
          ],
    };
  });
  // Reorder only contiguous bullet lists, preserving headings, contact details, and chronology.
  const lines = profile.resume.split('\n');
  const relevance = (line: string) =>
    extractRequirements(line).filter((r) => topics.includes(r.skillId)).length;
  for (let start = 0; start < lines.length; start++) {
    if (!/^\s*[-*•]\s/.test(lines[start])) continue;
    let end = start + 1;
    while (end < lines.length && /^\s*[-*•]\s/.test(lines[end])) end++;
    lines.splice(
      start,
      end - start,
      ...lines.slice(start, end).sort((a, b) => relevance(b) - relevance(a)),
    );
    start = end - 1;
  }
  const questions = bank
    .filter((q) => topics.includes(q.skillId))
    .map((q, i) => ({ ...q, id: `q-${i + 1}` }));
  const interviewPrompts = [
    `Give a 90-second introduction connecting your real experience to ${profile.targetRole}.`,
    ...topics
      .slice(0, 4)
      .map(
        (t) =>
          `Explain a ${skillName(t)} design decision, an alternative you considered, and a failure case. If you have not implemented it, explain how you would validate a small example.`,
      ),
    ...repositories
      .slice(0, 3)
      .map(
        (r) =>
          `Walk through ${r.name}: the user problem, your personal contribution, the request/data flow, and one change you would make. Point to a source file rather than relying on the README.`,
      ),
    `Describe a difficult bug from your ${profile.experience === 'student' ? 'coursework or projects' : 'professional or project work'} using situation, task, action, and result. Use only an actual example.`,
    ...(profile.codingContext.trim()
      ? [
          `Your self-reported coding focus is: ${profile.codingContext}. Walk through one problem you actually attempted, explain your first approach, and improve its complexity.`,
        ]
      : []),
    'What would you ask the interviewer about the team’s engineering practices and the role’s first 90 days?',
  ];
  return {
    plan,
    draftResume: lines.join('\n'),
    questions,
    interviewPrompts,
    topics,
    observed: [...observed],
  };
}
