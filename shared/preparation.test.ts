import { describe, it, expect } from 'vitest';
import { buildPreparation, type CareerProfile } from './preparation';
import { sampleProfile } from './preparation.fixture';

describe('preparation generation', () => {
  it('preserves every original resume line and prioritizes relevant bullets without changing chronology', () => {
    const prep = buildPreparation(sampleProfile, []);
    expect(prep.draftResume.split('\n').sort()).toEqual(sampleProfile.resume.split('\n').sort());
    expect(prep.draftResume.indexOf('Built React forms')).toBeLessThan(
      prep.draftResume.indexOf('Organized a study group'),
    );
    expect(prep.draftResume).toContain('EXPERIENCE\n2024: Internship');
  });
  it('keeps every day within the requested time budget and never invents repository signals', () => {
    const prep = buildPreparation(sampleProfile, []);
    expect(prep.plan).toHaveLength(7);
    expect(
      prep.plan.every((day) => day.activities.reduce((total, a) => total + a.minutes, 0) === 60),
    ).toBe(true);
    expect(prep.observed).toEqual([]);
    expect(prep.questions.map((q) => q.skillId)).toContain('react');
    expect(prep.questions.every((q) => q.correct < q.options.length)).toBe(true);
  });
});
