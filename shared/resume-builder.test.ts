import { describe, it, expect } from 'vitest';
import { buildResume } from './resume-builder';
import { builderInput } from './resume-builder.fixture';
describe('factual project-based resume generation', () => {
  it('orders supplied projects and skills by job relevance without adding missing job skills', () => {
    const text = buildResume(builderInput);
    expect(text.indexOf('React booking interface')).toBeLessThan(
      text.indexOf('Java inventory tool'),
    );
    expect(text).toContain('Skills\nReact, Java');
    expect(text).not.toContain('Python');
    expect(text).toContain(builderInput.education);
    expect(text).toContain(builderInput.projects[1].result);
  });
  it('respects an explicitly featured flagship project', () => {
    const input = structuredClone(builderInput);
    input.projects[0].featured = true;
    const text = buildResume(input);
    expect(text.indexOf('Java inventory tool')).toBeLessThan(
      text.indexOf('React booking interface'),
    );
  });
  it('omits missing sections and does not invent employment or metrics', () => {
    const text = buildResume({
      ...builderInput,
      summary: '',
      education: '',
      projects: [builderInput.projects[0]],
    });
    expect(text).not.toContain('Summary\n');
    expect(text).not.toContain('Education\n');
    expect(text).not.toContain('Experience\n');
    expect(text).not.toMatch(/\d+%|years of experience|increased|improved/);
    expect(text).toContain('Built an item editor and input validation.');
  });
  it('handles marker-only actions without crashing or losing the result', () => {
    const input = structuredClone(builderInput);
    input.projects[0].action = '•\n•\n•\n•\n•\n•';
    input.projects[0].result = 'Validated the result with users.';
    expect(buildResume(input)).toContain('- Validated the result with users.');
  });
  it('normalizes common action bullet markers without duplicating them', () => {
    const input = structuredClone(builderInput);
    input.projects[0].action = '● Built a tool\n▪ Wrote tests\n◦ Reviewed output\n– Deployed it';
    const text = buildResume(input);
    expect(text).toContain('- Built a tool\n- Wrote tests\n- Reviewed output\n- Deployed it');
    expect(text).not.toContain('- ●');
  });
  it('preserves existing sentence punctuation when appending a result', () => {
    const input = structuredClone(builderInput);
    input.projects[0].action = 'Resolved an outage!';
    input.projects[0].result = 'Service recovered.';
    expect(buildResume(input)).toContain('- Resolved an outage! Service recovered.');
  });
});
