import { describe, it, expect } from 'vitest';
import { applyResumeFix, scoreResume, formatScoredReport } from './resume-score';
const resume = `Avery Example\navery@example.test | +91 9876543210 | https://github.com/avery\nPROFILE SUMMARY\nDeveloper building accessible interfaces and practical backend services. I work with teams to explain tradeoffs, write tests, and improve features through small, verifiable changes.\nEDUCATION\nComputer Science 2025–2029\nTECHNICAL SKILLS\nReact, TypeScript, JavaScript, Express, MongoDB\nPROJECTS\n• Built React components for 30 students using accessible forms and clear validation.\n• Implemented an Express API with session authentication and ownership checks.\n• Wrote 12 tests for invalid input and cross-account access failures.\n• Documented the setup and limitations of the project for other contributors.\n• Integrated a MongoDB collection with indexes based on actual filter patterns.\n• Debugged asynchronous updates and recorded a reproducible case for the team.\n• Coordinated a small delivery with peers and explained design choices during review.\n• Improved error handling so interrupted requests show a meaningful recovery action.`;
describe('transparent resume score', () => {
  it('has bounded disclosed categories whose rounded sum equals the overall score', () => {
    const report = scoreResume(
      resume,
      'Required: React, Express and authentication. Preferred: Docker.',
    );
    expect(report.categories.reduce((n, c) => n + c.maximum, 0)).toBe(100);
    expect(report.overallScore).toBe(
      Math.round(report.categories.reduce((n, c) => n + c.earned, 0)),
    );
    expect(report.categories.every((c) => c.earned >= 0 && c.earned <= c.maximum)).toBe(true);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(formatScoredReport(report)).toContain('JobFit ATS readiness estimate');
  });
  it('does not award an overall score for sparse resumes or an unsupported job', () => {
    expect(scoreResume('React developer', 'Required: React').overallScore).toBeNull();
    expect(scoreResume(resume, 'Pastry chef for a small bakery').overallScore).toBeNull();
  });
  it('does not treat dates and phone numbers as quantified accomplishments', () => {
    const plain = scoreResume(
      resume.replace(/for 30 students/, 'for students').replace('12 tests', 'tests'),
      'React required',
    );
    const quantified = scoreResume(resume, 'React required');
    expect(quantified.categories.find((c) => c.id === 'impact')!.earned).toBeGreaterThan(
      plain.categories.find((c) => c.id === 'impact')!.earned,
    );
    expect(plain.categories.find((c) => c.id === 'impact')!.explanation).toContain('(0/8)');
  });
  it('only changes existing labels, markers and whitespace in quick fixes', () => {
    const fixed = applyResumeFix(applyResumeFix(resume, 'headings'), 'bullets');
    expect(fixed).toContain('Summary\nDeveloper');
    expect(fixed).toContain('Skills\nReact');
    expect(fixed).toContain('- Built React components for 30 students');
    expect(fixed).toContain('Computer Science 2025–2029');
    expect(applyResumeFix(resume, 'unknown')).toBe(resume);
    expect(applyResumeFix('A  \n\n\nB\n', 'spacing')).toBe('A\n\nB\n');
  });
});
