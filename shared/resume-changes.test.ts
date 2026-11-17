import { describe, it, expect } from 'vitest';
import { scoreResume } from './resume-score';
import {
  changedPassages,
  proposeResumeChanges,
  applyReviewedChange,
  previewResumeChange,
} from './resume-changes';
const resume =
  'Candidate\nACADEMIC BACKGROUND\nUniversity 2025\nSKILLS AND TECHNOLOGIES\nReact\nPROJECTS\n• Built an interface for real users.\n' +
  'Documented practical project decisions and verified the changes with peers. '.repeat(8);
const job = 'Required: React and Java. API testing is preferred.';
describe('explicit resume change review', () => {
  it('shows changed lines without obscuring them among untouched text', () => {
    expect(
      changedPassages('OLD HEADING\nUntouched fact\nOLD SKILLS', 'Heading\nUntouched fact\nSkills'),
    ).toEqual([
      { before: 'OLD HEADING', after: 'Heading' },
      { before: 'OLD SKILLS', after: 'Skills' },
    ]);
    expect(changedPassages('', 'New section\nA truthful detail')).toEqual([
      { before: '', after: 'New section\nA truthful detail' },
    ]);
  });
  it('proposes exact changes without modifying the resume and computes their actual rubric impact', () => {
    const changes = proposeResumeChanges(resume, scoreResume(resume, job));
    const heading = changes.find((c) => c.id === 'headings')!;
    expect(heading).toBeDefined();
    expect(resume.slice(heading.start, heading.end)).toBe(heading.before);
    const preview = previewResumeChange(resume, resume, job, heading, heading.proposed);
    expect(preview.after).toContain('Education');
    expect(preview.after).toContain('Skills\nReact');
    expect(preview.delta).toBe(
      scoreResume(preview.after, job).overallScore! - scoreResume(resume, job).overallScore!,
    );
    expect(preview.after).not.toContain('Java');
  });
  it('does not fabricate missing skills or numbers and requires user text for additions', () => {
    const changes = proposeResumeChanges(resume, scoreResume(resume, job));
    const missing = changes.find((c) => c.id === 'missing')!;
    expect(missing.requiresInput).toBe(true);
    expect(missing.proposed).toBe('');
    expect(() => applyReviewedChange(resume, resume, missing, ' ')).toThrow(
      'Write the exact truthful text',
    );
    const added = applyReviewedChange(
      resume,
      resume,
      missing,
      'Projects\n- Practiced Java collections in a class exercise.',
    );
    expect(added).toContain(resume.trimEnd());
    expect(added).toContain('Practiced Java collections');
  });
  it('refuses to guess at stale replacements, including repeated identical text', () => {
    const duplicate = resume + '\n• Built an interface for real users.';
    const change = proposeResumeChanges(duplicate, scoreResume(duplicate, job)).find(
      (c) => c.id === 'numbers',
    )!;
    expect(change.kind).toBe('replace');
    const changed = applyReviewedChange(
      duplicate,
      duplicate,
      change,
      '- Built an interface for 3 classmates.',
    );
    expect(changed).toContain('\n• Built an interface for real users.');
    expect(() => applyReviewedChange(changed, duplicate, change, 'Different text')).toThrow(
      'Rescan',
    );
  });
  it('shows zero points honestly for changes that do not affect the rubric', () => {
    const text = 'Candidate  \n' + resume;
    const spacing = proposeResumeChanges(text, scoreResume(text, job)).find(
      (c) => c.id === 'spacing',
    )!;
    const preview = previewResumeChange(text, text, job, spacing, spacing.proposed);
    expect(preview.delta).toBe(0);
    expect(preview.categories).toEqual([]);
  });
  it('reports unavailable impact for inputs without a score', () => {
    const text = 'Candidate  \nReact';
    const spacing = proposeResumeChanges(text, scoreResume(text, job)).find(
      (c) => c.id === 'spacing',
    )!;
    expect(previewResumeChange(text, text, job, spacing, spacing.proposed).delta).toBeNull();
  });
});
