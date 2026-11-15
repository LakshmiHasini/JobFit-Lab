import { skills } from './domain.js';

const terms = [
  ...skills,
  { id: 'python', name: 'Python', aliases: ['python'] },
  { id: 'cpp', name: 'C++', aliases: ['c++'] },
  { id: 'csharp', name: 'C#', aliases: ['c#', 'c sharp'] },
  { id: 'html', name: 'HTML', aliases: ['html', 'html5'] },
  { id: 'css', name: 'CSS', aliases: ['css', 'css3'] },
  { id: 'git', name: 'Git', aliases: ['git'] },
  { id: 'rest', name: 'REST APIs', aliases: ['rest', 'restful', 'rest api', 'rest apis'] },
  { id: 'dsa', name: 'Data structures', aliases: ['data structures', 'data structure', 'dsa'] },
  { id: 'algorithms', name: 'Algorithms', aliases: ['algorithms', 'algorithm'] },
  {
    id: 'oop',
    name: 'Object-oriented programming',
    aliases: ['object-oriented', 'object oriented', 'oop', 'oops'],
  },
  { id: 'cloud', name: 'Cloud platforms', aliases: ['cloud', 'aws', 'azure', 'gcp'] },
  { id: 'agile', name: 'Agile', aliases: ['agile', 'scrum'] },
  { id: 'communication', name: 'Communication', aliases: ['communication'] },
  { id: 'teamwork', name: 'Teamwork', aliases: ['teamwork', 'team collaboration'] },
  {
    id: 'problem-solving',
    name: 'Problem-solving',
    aliases: ['problem-solving', 'problem solving'],
  },
];
const matcher = (aliases: string[]) =>
  new RegExp(
    `(?<![a-z0-9+#])(?:${aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-z0-9+#])`,
    'i',
  );
const relevantLines = (text: string) =>
  text
    .split(/\n|(?<=[.!?;])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
export type AtsKeyword = {
  id: string;
  name: string;
  importance: 'required' | 'preferred' | 'mentioned';
  matched: boolean;
  jobExcerpt: string;
  resumeExcerpt: string | null;
};
export type AtsFinding = { id: string; status: 'pass' | 'review'; title: string; detail: string };
export type AtsReport = {
  version: string;
  keywordCoverage: number | null;
  matched: number;
  total: number;
  keywords: AtsKeyword[];
  checks: AtsFinding[];
  wordCount: number;
  bulletCount: number;
  limitations: string[];
};

export function checkResume(resume: string, jobDescription: string): AtsReport {
  const lines = relevantLines(jobDescription);
  let section: AtsKeyword['importance'] = 'mentioned';
  const candidates: { text: string; importance: AtsKeyword['importance'] }[] = [];
  for (const text of lines) {
    if (/^(?:nice to have|preferred|bonus|desirable)/i.test(text)) section = 'preferred';
    else if (/^(?:requirements|qualifications|must have|required skills|essential)/i.test(text))
      section = 'required';
    else if (/^(?:benefits|about us|about the company|compensation|equal opportunity)/i.test(text))
      section = 'mentioned';
    const importance = /preferred|nice.to.have|optional|bonus/i.test(text)
      ? 'preferred'
      : /\brequired\b|\bmust\b|\bessential\b/i.test(text)
        ? 'required'
        : section;
    candidates.push({ text, importance });
  }
  const keywords: AtsKeyword[] = [];
  for (const term of terms) {
    const regex = matcher(term.aliases);
    const matches = candidates.filter(
      (c) =>
        regex.test(c.text) &&
        !/not required|not necessary|no experience (?:is )?required/i.test(c.text),
    );
    if (!matches.length) continue;
    const source =
      matches.find((c) => c.importance === 'required') ??
      matches.find((c) => c.importance === 'preferred') ??
      matches[0];
    const excerpt = relevantLines(resume).find((line) => regex.test(line)) ?? null;
    keywords.push({
      id: term.id,
      name: term.name,
      importance: source.importance,
      matched: !!excerpt,
      jobExcerpt: source.text.slice(0, 500),
      resumeExcerpt: excerpt?.slice(0, 500) ?? null,
    });
  }
  const resumeLines = resume.split('\n');
  const bullets = resumeLines.filter((line) => /^\s*[-*•]\s+/.test(line));
  const wordCount = resume.trim() ? resume.trim().split(/\s+/).length : 0;
  const heading = (pattern: RegExp) =>
    resumeLines.some((line) => pattern.test(line.trim().replace(/[:：]$/, '')));
  const check = (
    id: string,
    passes: boolean,
    title: string,
    pass: string,
    review: string,
  ): AtsFinding => ({
    id,
    status: passes ? 'pass' : 'review',
    title,
    detail: passes ? pass : review,
  });
  const checks = [
    check(
      'email',
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(resume),
      'Email in extracted text',
      'An email address is readable in the text.',
      'Add a readable email address in the main resume body.',
    ),
    check(
      'skills',
      heading(/^(?:technical\s+)?skills(?:\s*(?:&|and)\s*(?:tools|technologies))?$/i),
      'Skills section',
      'A recognizable Skills heading was found.',
      'Use a clear Skills or Technical Skills heading if you have skills to list.',
    ),
    check(
      'education',
      heading(/^education(?:\s*(?:&|and)\s*certifications)?$/i),
      'Education section',
      'An Education heading was found.',
      'Consider a clear Education heading if your education is relevant.',
    ),
    check(
      'experience',
      heading(
        /^(?:(?:work|professional)\s+)?experience(?:\s*(?:&|and)\s*leadership)?$|^(?:selected\s+)?projects(?:\s*(?:&|and)\s*experience)?$/i,
      ),
      'Experience or projects section',
      'A clear Experience or Projects heading was found.',
      'Add a clearly labeled Experience or Projects section with truthful examples.',
    ),
    check(
      'bullets',
      bullets.length > 0,
      'Scannable accomplishment bullets',
      `${bullets.length} bullet lines found. This is a readability check, not an ATS requirement.`,
      'Consider short accomplishment bullets under projects or experience for readability.',
    ),
    check(
      'text',
      !/[\uFFFD\u0000]/.test(resume) && wordCount >= 30,
      'Extracted text quality',
      'No replacement characters were found and the text contains at least 30 words.',
      'Review the extracted text for missing content or broken characters; paste corrected text if needed.',
    ),
    check(
      'length',
      wordCount >= 150 && wordCount <= 1200,
      'Resume length for manual review',
      `${wordCount} words. This broad review range is a JobFit heuristic, not a vendor limit.`,
      `${wordCount} words. Review whether the text is complete or unnecessarily long; no universal word limit is assumed.`,
    ),
  ];
  const matched = keywords.filter((k) => k.matched).length;
  return {
    version: 'jobfit-text-check-v1',
    keywordCoverage: keywords.length ? Math.round((matched / keywords.length) * 100) : null,
    matched,
    total: keywords.length,
    keywords,
    checks,
    wordCount,
    bulletCount: bullets.length,
    limitations: [
      'Keyword coverage = unique recognized job-description terms found in the resume / unique recognized job-description terms. Repeating keywords earns no extra credit.',
      'This is a local text comparison, not an employer ATS score, qualification assessment, or hiring prediction. Keywords mentioned together may be alternatives rather than separate requirements.',
      'The dictionary is limited. Unrecognized requirements and semantic equivalents can be missed. Review every excerpt and the complete job description.',
      'The original PDF/DOCX layout, columns, tables, headers, text boxes, images, font size, file size, and reading order are not inspected by this text check. Review the exported document separately.',
      'Add missing terms only when they accurately describe experience you can explain. Do not invent achievements or add hidden keywords.',
    ],
  };
}

export function formatAtsReport(report: AtsReport) {
  return [
    'JobFit Lab — ATS-oriented resume text check',
    `Method: ${report.version}`,
    report.keywordCoverage === null
      ? 'Keyword coverage: unavailable (no supported job terms recognized)'
      : `Keyword coverage: ${report.keywordCoverage}% (${report.matched}/${report.total} recognized terms)`,
    '\nJOB TERMS',
    ...report.keywords.map(
      (k) =>
        `${k.matched ? 'FOUND' : 'NOT FOUND'}: ${k.name} (${k.importance})\n  Job: ${k.jobExcerpt}\n  Resume: ${k.resumeExcerpt ?? 'No matching text found'}`,
    ),
    '\nTEXT CHECKS',
    ...report.checks.map((c) => `${c.status.toUpperCase()}: ${c.title} — ${c.detail}`),
    '\nLIMITATIONS',
    ...report.limitations,
  ].join('\n');
}
