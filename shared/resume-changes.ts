import { applyResumeFix, scoreResume, type ScoredReport } from './resume-score.js';

export type ResumeChange = {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  before: string;
  proposed: string;
  start: number;
  end: number;
  kind: 'replace' | 'append' | 'document';
  requiresInput: boolean;
};

export function changedPassages(before: string, after: string) {
  const left = before.split('\n'),
    right = after.split('\n');
  // Normalizations preserve line count; omit untouched intervening lines for clarity.
  if (left.length === right.length)
    return left.flatMap((line, i) =>
      line === right[i] ? [] : [{ before: line, after: right[i] }],
    );
  return [{ before, after }];
}

// All offsets refer to a scanned snapshot. Replacements never guess at repeated text.
export function proposeResumeChanges(
  resume: string,
  report: ScoredReport,
  job?: string,
): ResumeChange[] {
  const suggestions = report.suggestions.flatMap<ResumeChange>((suggestion) => {
    const base = {
      id: suggestion.id,
      title: suggestion.title,
      reason: suggestion.detail,
      priority: suggestion.priority,
    };
    if (suggestion.fixId) {
      const after = applyResumeFix(resume, suggestion.fixId);
      if (after === resume) return [];
      let start = 0;
      while (start < resume.length && start < after.length && resume[start] === after[start])
        start++;
      let oldEnd = resume.length,
        newEnd = after.length;
      while (oldEnd > start && newEnd > start && resume[oldEnd - 1] === after[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }
      return [
        {
          ...base,
          kind: 'document' as const,
          before: resume.slice(start, oldEnd),
          proposed: after.slice(start, newEnd),
          start,
          end: oldEnd,
          requiresInput: false,
        },
      ];
    }
    const bullet = /^(?:[ \t]*[-*•●▪◦–][ \t]+).+$/m.exec(resume);
    if (bullet && ['actions', 'numbers'].includes(suggestion.id)) {
      return [
        {
          ...base,
          kind: 'replace' as const,
          before: bullet[0],
          proposed: bullet[0],
          start: bullet.index,
          end: bullet.index + bullet[0].length,
          requiresInput: true,
        },
      ];
    }
    return [
      {
        ...base,
        kind: 'append' as const,
        before: '',
        proposed: '',
        start: resume.length,
        end: resume.length,
        requiresInput: true,
      },
    ];
  });
  if (job) {
    // Conservative rewordings retain the action/ownership described by the source.
    // They are never accepted without the user's factual confirmation.
    const rewrites: [RegExp, string][] = [
      [/^Worked on\s+/i, 'Contributed to '],
      [/^Helped build\s+/i, 'Contributed to building '],
      [/^Responsible for developing\s+/i, 'Developed '],
      [/^Responsible for implementing\s+/i, 'Implemented '],
      [/^Rapidly learned\s+/i, 'Developed familiarity with '],
    ];
    for (const match of resume.matchAll(/^[ \t]*[-*•●▪◦–][ \t]+.+$/gm)) {
      const prefix = match[0].match(/^[ \t]*[-*•●▪◦–][ \t]+/)![0];
      const body = match[0].slice(prefix.length);
      const rewrite = rewrites.find(([pattern]) => pattern.test(body));
      if (!rewrite) continue;
      const candidate: ResumeChange = {
        id: `wording-${match.index}`,
        title: 'Clarify an existing action',
        reason:
          'Rephrase this supplied contribution with an action-led opening. Review that the new wording preserves your personal role; no skills, outcomes, or numbers are added.',
        priority: 'medium',
        before: match[0],
        proposed: prefix + body.replace(rewrite[0], rewrite[1]),
        start: match.index!,
        end: match.index! + match[0].length,
        kind: 'replace',
        requiresInput: true,
      };
      const preview = previewResumeChange(resume, resume, job, candidate, candidate.proposed);
      if (preview.delta !== null && preview.delta > 0) suggestions.push(candidate);
    }
  }
  return suggestions;
}

export function classifyResumeChanges(resume: string, job: string, changes: ResumeChange[]) {
  const evaluated = changes.map((change) => {
    try {
      return {
        change,
        delta: previewResumeChange(resume, resume, job, change, change.proposed).delta,
      };
    } catch {
      return { change, delta: null };
    }
  });
  return {
    increases: evaluated
      .filter((item) => item.delta !== null && item.delta > 0)
      .sort((a, b) => b.delta! - a.delta!)
      .map((item) => item.change),
    needsFacts: evaluated
      .filter((item) => item.change.requiresInput && !(item.delta !== null && item.delta > 0))
      .map((item) => item.change),
    cleanup: evaluated
      .filter((item) => !item.change.requiresInput && !(item.delta !== null && item.delta > 0))
      .map((item) => item.change),
  };
}

export function applyReviewedChange(
  current: string,
  snapshot: string,
  change: ResumeChange,
  replacement: string,
): string {
  if (change.requiresInput && !replacement.trim())
    throw new Error('Write the exact truthful text you want to add or replace before accepting.');
  if (change.kind === 'append') return current.trimEnd() + '\n\n' + replacement.trim();
  // A snapshot mismatch must be reviewed afresh, rather than editing the wrong occurrence.
  if (current !== snapshot)
    throw new Error(
      'The resume changed after this scan. Rescan before accepting this replacement.',
    );
  if (current.slice(change.start, change.end) !== change.before)
    throw new Error('The original passage no longer matches. Rescan to review the new text.');
  return current.slice(0, change.start) + replacement + current.slice(change.end);
}

export function previewResumeChange(
  current: string,
  snapshot: string,
  job: string,
  change: ResumeChange,
  replacement: string,
) {
  const after = applyReviewedChange(current, snapshot, change, replacement);
  const beforeReport = scoreResume(current, job),
    afterReport = scoreResume(after, job);
  return {
    after,
    beforeScore: beforeReport.overallScore,
    afterScore: afterReport.overallScore,
    delta:
      beforeReport.overallScore === null || afterReport.overallScore === null
        ? null
        : afterReport.overallScore - beforeReport.overallScore,
    categories: afterReport.categories.flatMap((c) => {
      const prior = beforeReport.categories.find((b) => b.id === c.id)!;
      return c.earned === prior.earned
        ? []
        : [{ name: c.name, before: prior.earned, after: c.earned, maximum: c.maximum }];
    }),
  };
}
