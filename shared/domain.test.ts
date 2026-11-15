import { describe, it, expect } from 'vitest';
import { extractRequirements, requirementStatus, type Evidence } from './domain';
describe('requirement proposals', () => {
  it('normalizes aliases without confusing Java and JavaScript', () => {
    expect(extractRequirements('JavaScript required').map((r) => r.skillId)).toEqual([
      'javascript',
    ]);
    expect(extractRequirements('React.js required')[0].skillId).toBe('react');
  });
  it('never auto-confirms a match and preserves exact source text', () => {
    const line = 'Required: Node.js and MongoDB.';
    const results = extractRequirements(line);
    expect(results).toHaveLength(2);
    expect(
      results.every((r) => r.excerpt === line && !r.confirmed && r.evidenceIds.length === 0),
    ).toBe(true);
  });
  it('keeps negated mentions ambiguous', () => {
    expect(extractRequirements('Docker is not required')[0].importance).toBe('unclear');
    expect(extractRequirements('Preferred: API testing')[0].importance).toBe('preferred');
  });
  it('never treats an unresolved or wrong-skill evidence ID as coverage', () => {
    const req = {
      ...extractRequirements('React required')[0],
      confirmed: true,
      evidenceIds: ['removed'],
    };
    expect(requirementStatus(req, [])).toBe('No evidence recorded');
    expect(requirementStatus(req, [{ id: 'removed', skillId: 'java' } as Evidence])).toBe(
      'No evidence recorded',
    );
  });
});
