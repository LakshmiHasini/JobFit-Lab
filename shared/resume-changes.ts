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
export function proposeResumeChanges(resume: string, report: ScoredReport): ResumeChange[] {
  return report.suggestions.flatMap<ResumeChange>((suggestion) => {
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
