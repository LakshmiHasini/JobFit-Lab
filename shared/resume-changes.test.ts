import { describe, it, expect } from 'vitest';
import { scoreResume } from './resume-score';
import {
  changedPassages,
  classifyResumeChanges,
  proposeResumeChanges,
  applyReviewedChange,
  previewResumeChange,
} from './resume-changes';
const resume =
  'Candidate\nACADEMIC BACKGROUND\nUniversity 2025\nSKILLS AND TECHNOLOGIES\nReact\nPROJECTS\n• Built an interface for real users.\n' +
  'Documented practical project decisions and verified the changes with peers. '.repeat(8);
const job = 'Required: React and Java. API testing is preferred.';
describe('explicit resume change review', () => {
  it('puts only measured positive edits in the score-increase group', () => {
    const input = resume + '\n• Worked on React forms for classmates.  ';
    const changes = proposeResumeChanges(input, scoreResume(input, job), job);
    const groups = classifyResumeChanges(input, job, changes);
    expect(groups.increases.length).toBeGreaterThan(0);
    expect(
      groups.increases.every(
        (change) => previewResumeChange(input, input, job, change, change.proposed).delta! > 0,
      ),
    ).toBe(true);
    expect(groups.cleanup.some((change) => change.id === 'spacing')).toBe(true);
    expect(groups.needsFacts.some((change) => change.id === 'missing')).toBe(true);
    expect(groups.increases.some((change) => change.id === 'spacing')).toBe(false);
  });
  it('proposes factual action rewordings without adding keywords or metrics', () => {
    const input = resume + '\n• Rapidly learned new tools during the class project.';
    const changes = proposeResumeChanges(input, scoreResume(input, job), job);
    const action = changes.find((c) => c.id.startsWith('wording-'))!;
    expect(action.requiresInput).toBe(true);
    expect(action.proposed).toBe(
      '• Developed familiarity with new tools during the class project.',
    );
    expect(action.proposed).not.toMatch(/Java|\d/);
    expect(previewResumeChange(input, input, job, action, action.proposed).delta).toBeGreaterThan(
      0,
    );
  });
  it('does not classify zero, negative, or unavailable impacts as verified increases', () => {
    for (const input of ['Candidate  \nReact', resume]) {
      const changes = proposeResumeChanges(input, scoreResume(input, job), job);
      const groups = classifyResumeChanges(input, job, changes);
      expect(
        groups.increases.every(
          (c) => previewResumeChange(input, input, job, c, c.proposed).delta! > 0,
        ),
      ).toBe(true);
    }
  });
  it('checks user-authored additions against the current score rather than assuming a benefit', () => {
    const change = proposeResumeChanges(resume, scoreResume(resume, job), job).find(
      (c) => c.id === 'missing',
    )!;
    expect(
      previewResumeChange(
        resume,
        resume,
        job,
        change,
        'Projects\n- Practiced Java collections in coursework.',
      ).delta,
    ).toBeGreaterThan(0);
    expect(previewResumeChange(resume, resume, job, change, 'A short unrelated note.').delta).toBe(
      0,
    );
  });
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
