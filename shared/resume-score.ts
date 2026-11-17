import { checkResume, formatAtsReport, type AtsReport } from './ats.js';

export type ScoreCategory = {
  id: string;
  name: string;
  earned: number;
  maximum: number;
  explanation: string;
};
export type ResumeSuggestion = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  fixId?: string;
};
export type ScoredReport = AtsReport & {
  overallScore: number | null;
  categories: ScoreCategory[];
  suggestions: ResumeSuggestion[];
  scoreLabel: string;
};
export type ResumeScan = {
  id: string;
  ownerId: string;
  createdAt: string;
  resume: string;
  jobDescription: string;
  report: ScoredReport;
};
export type ScanSummary = {
  id: string;
  createdAt: string;
  score: number | null;
  keywordCoverage: number | null;
  version: string;
};

export function applyResumeFix(resume: string, fixId: string) {
  if (fixId === 'spacing')
    return resume
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  if (fixId === 'bullets') return resume.replace(/^[\t ]*[•●▪◦*–][\t ]+/gm, '- ');
  if (fixId === 'headings')
    return resume
      .split('\n')
      .map((line) => {
        const value = line.trim();
        if (/^(?:profile summary|professional summary|career summary|summary)\s*:?$/i.test(value))
          return 'Summary';
        if (/^(?:technical skills|skills and technologies|skills & tools)\s*:?$/i.test(value))
          return 'Skills';
        if (/^(?:education|academic background)\s*:?$/i.test(value)) return 'Education';
        return line;
      })
      .join('\n');
  return resume;
}

export function scoreResume(resume: string, jobDescription: string): ScoredReport {
  const report = checkResume(resume, jobDescription);
  const passes = (id: string) => report.checks.some((c) => c.id === id && c.status === 'pass');
  const lines = resume.split('\n');
  const bulletLines = lines.filter((line) => /^[\t ]*[-*•●▪◦–][\t ]+\S/.test(line));
  const bullets = bulletLines.map((line) => line.replace(/^[\t ]*[-*•●▪◦–][\t ]+/, ''));
  const action =
    /^(?:built|developed|implemented|designed|created|engineered|integrated|tested|optimized|automated|reduced|increased|led|coordinated|delivered|maintained|analyzed|debugged|contributed|improved|migrated|refactored|wrote|deployed|collaborated|resolved|documented|used)\b/i;
  const number =
    /\b\d+(?:\.\d+)?\s*(?:%|x\b|users?\b|requests?\b|hours?\b|minutes?\b|seconds?\b|ms\b|records?\b|tests?\b|endpoints?\b|members?\b|teams?\b|pages?\b|students?\b|participants?\b|events?\b|projects?\b|hackathons?\b|competitions?\b)/i;
  const actionCount = bullets.filter((b) => action.test(b)).length;
  const quantified = bullets.filter((b) => number.test(b)).length;
  const concise = bullets.filter((b) => b.trim().split(/\s+/).length <= 35).length;
  const dates = /\b(?:19|20)\d{2}\b/.test(resume);
  const phone = (resume.match(/\+?\d[\d ()-]{7,}\d/g) ?? []).some((s) => {
    const length = s.replace(/\D/g, '').length;
    return length >= 10 && length <= 15;
  });
  const professionalLink = /(?:github\.com\/|linkedin\.com\/|https?:\/\/\S+)/i.test(resume);
  const summaryIndex = lines.findIndex((line) =>
    /^(?:(?:profile|professional|career)\s+)?summary\s*:?$/i.test(line.trim()),
  );
  let summaryWords = 0;
  if (summaryIndex >= 0) {
    const body: string[] = [];
    for (const line of lines.slice(summaryIndex + 1)) {
      if (
        /^(?:education|skills|technical skills|projects|experience|work experience|certifications)\s*:?$/i.test(
          line.trim(),
        )
      )
        break;
      body.push(line);
    }
    summaryWords = body.join(' ').trim().split(/\s+/).filter(Boolean).length;
  }
  const weight = (kind: string) => (kind === 'required' ? 3 : kind === 'preferred' ? 1 : 2);
  const maxKeywordWeight = report.keywords.reduce((n, k) => n + weight(k.importance), 0);
  const matchedWeight = report.keywords
    .filter((k) => k.matched)
    .reduce((n, k) => n + weight(k.importance), 0);
  const round = (n: number) => Math.round(n * 10) / 10;
  const ratio = (count: number) => (bullets.length ? count / bullets.length : 0);
  const categories: ScoreCategory[] = [
    {
      id: 'alignment',
      name: 'Job alignment',
      maximum: 30,
      earned: round(maxKeywordWeight ? (30 * matchedWeight) / maxKeywordWeight : 0),
      explanation:
        'Recognized required terms weigh 3, mentioned terms 2, preferred terms 1. This category contributes 30 points; repeated words do not add credit.',
    },
    {
      id: 'structure',
      name: 'Section structure',
      maximum: 20,
      earned:
        [passes('skills'), passes('education'), passes('experience'), dates].filter(Boolean)
          .length * 5,
      explanation:
        '5 points each for recognizable Skills, Education, Experience/Projects headings and a year in the text. Presence is checked, not factual accuracy.',
    },
    {
      id: 'impact',
      name: 'Bullet quality',
      maximum: 20,
      earned: round((bullets.length ? 5 : 0) + 10 * ratio(actionCount) + 5 * ratio(quantified)),
      explanation: `5 points for bullets, up to 10 for action-led bullets (${actionCount}/${bullets.length}), and up to 5 for number-plus-scope bullets (${quantified}/${bullets.length}). Numbers are not verified; do not invent metrics.`,
    },
    {
      id: 'readability',
      name: 'Text readability',
      maximum: 15,
      earned: round(
        (passes('length') ? 5 : 0) +
          4 * ratio(concise) +
          (passes('text') ? 3 : 0) +
          (lines.some((l) => l.trim().split(/\s+/).length > 80) ? 0 : 3),
      ),
      explanation:
        '5 points for the broad 150–1,200 word review range, up to 4 for concise bullets (35 words or fewer), 3 for extractable text, 3 for no 80+ word lines. These are JobFit style heuristics, not vendor rules.',
    },
    {
      id: 'contact',
      name: 'Contact completeness',
      maximum: 10,
      earned: (passes('email') ? 4 : 0) + (phone ? 3 : 0) + (professionalLink ? 3 : 0),
      explanation:
        '4 points for an email-shaped string, 3 for a phone-shaped string, 3 for a web/profile link. Detection cannot verify that the details are correct or reachable.',
    },
    {
      id: 'summary',
      name: 'Professional summary',
      maximum: 5,
      earned: summaryIndex < 0 ? 0 : 3 + (summaryWords >= 20 && summaryWords <= 100 ? 2 : 0),
      explanation:
        '3 points for a Summary heading, 2 for a 20–100 word summary. A summary is a style preference in this rubric, not a universal ATS requirement.',
    },
  ];
  const suggestions: ResumeSuggestion[] = [];
  const missing = report.keywords
    .filter((k) => !k.matched)
    .sort((a, b) => weight(b.importance) - weight(a.importance));
  if (missing.length)
    suggestions.push({
      id: 'missing',
      priority: 'high',
      title: 'Review missing job language',
      detail: `Not found: ${missing
        .slice(0, 8)
        .map((k) => k.name)
        .join(
          ', ',
        )}. Add concrete examples only for skills you genuinely used. Some job terms may be alternatives; review their excerpts.`,
    });
  for (const c of report.checks.filter(
    (c) =>
      c.status === 'review' &&
      ['email', 'skills', 'education', 'experience', 'text'].includes(c.id),
  ))
    suggestions.push({
      id: c.id,
      priority: c.id === 'text' ? 'high' : 'medium',
      title: c.title,
      detail: c.detail,
    });
  if (bullets.length && actionCount < bullets.length)
    suggestions.push({
      id: 'actions',
      priority: 'medium',
      title: 'Make your contribution clearer',
      detail: `${bullets.length - actionCount} bullet(s) do not start with a recognized action verb. Describe what you personally did, using wording supported by your work.`,
    });
  if (quantified < bullets.length)
    suggestions.push({
      id: 'numbers',
      priority: 'medium',
      title: 'Show scope where you can support it',
      detail:
        'If you measured usage, latency, test coverage, or team scope, include the real number and context. Date ranges and phone numbers do not count. Leave a number out if you cannot support it.',
    });
  if (summaryIndex < 0)
    suggestions.push({
      id: 'summary',
      priority: 'low',
      title: 'Consider a concise professional summary',
      detail:
        'If useful for this application, summarize your real background and relevant strengths. This is a rubric preference, not a mandatory ATS section.',
    });
  for (const [fixId, title, detail] of [
    [
      'headings',
      'Standardize existing headings',
      'Preview consistent heading labels without adding new sections or changing your claims.',
    ],
    [
      'bullets',
      'Normalize bullet markers',
      'Preview standard hyphen bullets; every accomplishment stays unchanged.',
    ],
    [
      'spacing',
      'Clean trailing whitespace',
      'Remove trailing spaces and excess blank lines without rewriting your experience.',
    ],
  ])
    if (applyResumeFix(resume, fixId) !== resume)
      suggestions.push({ id: fixId, priority: 'low', title, detail, fixId });
  const overallScore =
    report.total && report.wordCount >= 50
      ? Math.round(categories.reduce((n, c) => n + c.earned, 0))
      : null;
  return {
    ...report,
    version: 'jobfit-resume-score-v2',
    overallScore,
    categories,
    suggestions,
    scoreLabel:
      overallScore === null
        ? 'More input needed'
        : overallScore >= 80
          ? 'Strong on this rubric'
          : overallScore >= 60
            ? 'Room to strengthen'
            : 'Focus on the essentials',
    limitations: [
      'Overall score = the rounded sum of six disclosed category contributions. JobFit selected these weights; this rubric is not validated against employer screening outcomes and is not Cake’s proprietary scoring model.',
      'Overall scoring requires at least 50 resume words and a recognized job term. Scores below this input threshold are unavailable, not zero.',
      ...report.limitations,
    ],
  };
}

export function formatScoredReport(report: ScoredReport) {
  return [
    'JobFit ATS readiness estimate: ' +
      (report.overallScore === null ? 'not available' : `${report.overallScore}/100`),
    ...report.categories.map((c) => `${c.name}: ${c.earned}/${c.maximum}\n${c.explanation}`),
    '\nPRIORITIZED IMPROVEMENTS',
    ...report.suggestions.map((s) => `${s.priority.toUpperCase()}: ${s.title}\n${s.detail}`),
    '\n' + formatAtsReport(report),
  ].join('\n');
}
