import { describe, it, expect, vi } from 'vitest';
import { analyzeGithub, githubUsername } from './github';
describe('GitHub source analysis', () => {
  it('accepts profile handles and rejects arbitrary URL fetch targets', () => {
    expect(githubUsername('https://github.com/sample-user/')).toBe('sample-user');
    expect(githubUsername('github.com/sample-user?tab=repositories')).toBe('sample-user');
    expect(githubUsername('https://github.com/sample-user/project/tree/main')).toBe('sample-user');
    expect(githubUsername('@sample-user')).toBe('sample-user');
    expect(() => githubUsername('http://127.0.0.1/internal')).toThrow();
    expect(() => githubUsername('sample/repo')).toThrow();
  });
  it('links signals to actual manifests and distinguishes missing metadata', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let value: unknown;
      if (url.includes('/users/'))
        value = [
          {
            name: 'example',
            default_branch: 'main',
            language: 'TypeScript',
            description: 'Example project',
            fork: false,
            archived: false,
          },
        ];
      else if (url.includes('/git/trees/'))
        value = {
          tree: [
            { path: 'package.json', type: 'blob', size: 200 },
            { path: 'src/app.test.ts', type: 'blob', size: 100 },
          ],
          truncated: false,
        };
      else
        value = {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({ dependencies: { react: '19' } })).toString(
            'base64',
          ),
        };
      return new Response(JSON.stringify(value), { status: 200 });
    });
    const results = await analyzeGithub('sample', 1, mock as typeof fetch);
    expect(results[0].signals.find((s) => s.skillId === 'react')?.url).toBe(
      'https://github.com/sample/example/blob/main/package.json',
    );
    expect(results[0].signals.some((s) => s.skillId === 'testing')).toBe(true);
    expect(results[0].signals.some((s) => s.skillId === 'auth')).toBe(false);
    expect(mock).toHaveBeenCalledTimes(3);
  });
});
