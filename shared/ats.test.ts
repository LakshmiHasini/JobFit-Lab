import { describe, it, expect } from 'vitest';
import { checkResume, formatAtsReport } from './ats';

describe('explainable ATS text checks', () => {
  it('uses unique job terms, normalizes aliases, and does not confuse Java and JavaScript', () => {
    const report = checkResume(
      'Built React.js forms using JavaScript. React React React.',
      'Required: React and JavaScript. Preferred: Java.',
    );
    expect(report.total).toBe(3);
    expect(report.matched).toBe(2);
    expect(report.keywordCoverage).toBe(67);
    expect(report.keywords.find((k) => k.id === 'java')?.matched).toBe(false);
    expect(report.keywords.find((k) => k.id === 'react')?.resumeExcerpt).toContain('React.js');
    expect(report.keywords.find((k) => k.id === 'java')?.importance).toBe('preferred');
  });
  it('recognizes punctuation-bearing language names without cross matching', () => {
    const report = checkResume('Built a C++ example.', 'Required: C++ and C#.');
    expect(report.keywords.find((k) => k.id === 'cpp')?.matched).toBe(true);
    expect(report.keywords.find((k) => k.id === 'csharp')?.matched).toBe(false);
  });
  it('does not invent a match percentage when the dictionary recognizes no job terms', () => {
    const report = checkResume(
      'A detailed resume describing several activities.',
      'Seeking a pastry chef with bakery experience.',
    );
    expect(report.keywordCoverage).toBeNull();
    expect(report.total).toBe(0);
  });
  it('reports observable section checks and distinguishes uninspected document layout', () => {
    const report = checkResume(
      'Person\nperson@example.test\nTECHNICAL SKILLS\nReact\nEDUCATION\nUniversity\nPROJECTS\n- Built React components',
      'Required: React',
    );
    expect(report.checks.find((c) => c.id === 'skills')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'education')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'email')?.status).toBe('pass');
    expect(report.bulletCount).toBe(1);
    expect(report.limitations.some((l) => l.includes('not inspected'))).toBe(true);
    expect(formatAtsReport(report)).toContain('not an employer ATS score');
  });
  it('excludes explicitly negated job requirements and gives repetition no extra credit', () => {
    expect(checkResume('React', 'Docker is not required.').total).toBe(0);
    expect(checkResume('React '.repeat(20), 'React required').keywordCoverage).toBe(
      checkResume('React', 'React required').keywordCoverage,
    );
  });
  it('recognizes common bullet markers while ignoring empty bullet lines', () => {
    const report = checkResume(
      '● Built a tool\n▪ Wrote tests\n◦ Documented setup\n– Fixed a bug\n• ',
      'React',
    );
    expect(report.bulletCount).toBe(4);
    expect(report.checks.find((check) => check.id === 'bullets')?.status).toBe('pass');
  });
});
