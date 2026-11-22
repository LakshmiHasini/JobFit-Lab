import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleProfile } from '../../shared/preparation.fixture';
import { readProfileDraft, writeProfileDraft, clearProfileDraft } from './profile-draft';

afterEach(() => vi.unstubAllGlobals());

function storage(initial?: string) {
  const values = new Map<string, string>(
    initial === undefined ? [] : [['jobfit-profile-draft:one', initial]],
  );
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

describe('profile draft recovery', () => {
  it('restores a complete draft without dropping its resume or repository findings', () => {
    storage();
    const draft = {
      ...sampleProfile,
      repositories: [
        {
          name: 'Project',
          url: 'https://github.com/sample/project',
          description: '',
          language: 'TypeScript',
          signals: [
            {
              skillId: 'react',
              finding: 'Declared React',
              url: 'https://github.com/sample/project/blob/main/package.json',
            },
          ],
          warnings: ['Public metadata only'],
        },
      ],
    };
    writeProfileDraft('one', draft);
    expect(readProfileDraft('one')).toEqual(draft);
    expect(readProfileDraft('two')).toBeNull();
    clearProfileDraft('one');
    expect(readProfileDraft('one')).toBeNull();
  });

  it.each([
    '{invalid',
    '{}',
    'null',
    'true',
    JSON.stringify({ ...sampleProfile, repositories: [{}] }),
  ])('ignores an unreadable or incomplete draft: %s', (value) => {
    storage(value);
    expect(readProfileDraft('one')).toBeNull();
  });

  it('rejects a draft attributed to another account even under the current account key', () => {
    storage(JSON.stringify({ ...sampleProfile, ownerId: 'two' }));
    expect(readProfileDraft('one')).toBeNull();
  });

  it('retains unfinished form fields before the profile has first been saved', () => {
    storage();
    const draft = {
      ...sampleProfile,
      id: '',
      ownerId: '',
      fullName: '',
      targetRole: '',
      jobDescription: '',
      days: 0,
    };
    writeProfileDraft('one', draft);
    expect(readProfileDraft('one')).toEqual(draft);
  });

  it('does not turn a successful API save into an error when browser storage is disabled or full', () => {
    const denied = () => {
      throw new Error('Browser storage denied');
    };
    vi.stubGlobal('sessionStorage', { getItem: denied, setItem: denied, removeItem: denied });
    expect(readProfileDraft('one')).toBeNull();
    expect(() => writeProfileDraft('one', sampleProfile)).not.toThrow();
    expect(() => clearProfileDraft('one')).not.toThrow();
  });
});
