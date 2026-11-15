import type { RepositoryAnalysis } from '../shared/preparation.js';

type Repo = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  fork: boolean;
  archived: boolean;
};
export function githubUsername(input: string) {
  let value = input.trim();
  if (/^(?:www\.)?github\.com\//i.test(value)) value = 'https://' + value;
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw Object.assign(new Error('Enter a valid GitHub profile link.'), { status: 400 });
    }
    if (!['github.com', 'www.github.com'].includes(url.hostname) || url.username || url.password)
      throw Object.assign(new Error('Use a github.com profile or repository link.'), {
        status: 400,
      });
    // Profile tabs/fragments and repository links all identify the same account owner.
    value = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else value = value.replace(/^@/, '').replace(/\/$/, '');
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value) || value.includes('--'))
    throw Object.assign(
      new Error('Enter a GitHub username or profile URL, without a repository path.'),
      { status: 400 },
    );
  return value;
}
export async function analyzeGithub(
  input: string,
  limit = 5,
  request: typeof fetch = fetch,
): Promise<RepositoryAnalysis[]> {
  const username = githubUsername(input);
  async function get(path: string, optional = false): Promise<any> {
    const response = await request(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'JobFit-Lab',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (optional && response.status === 404) return null;
    if (!response.ok)
      throw Object.assign(
        new Error(
          response.status === 403 || response.status === 429
            ? 'GitHub rate limit reached. Please try later, or configure a server-side GitHub token.'
            : response.status === 404
              ? 'GitHub profile not found or no public repository is accessible.'
              : 'GitHub is unavailable. Try again shortly.',
        ),
        { status: 502 },
      );
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 8_000_000)
      throw Object.assign(new Error('Repository response exceeds the analysis size limit.'), {
        status: 422,
      });
    return response.json();
  }
  const repos: Repo[] = await get(`/users/${username}/repos?sort=updated&per_page=100&type=owner`);
  const selected = repos.filter((r) => !r.fork && !r.archived).slice(0, limit);
  const results: RepositoryAnalysis[] = [];
  for (const repo of selected) {
    const result: RepositoryAnalysis = {
      name: repo.name,
      url: `https://github.com/${username}/${encodeURIComponent(repo.name)}`,
      description: repo.description ?? '',
      language: repo.language ?? 'Not reported',
      signals: [],
      warnings: [],
    };
    const base = `/repos/${username}/${encodeURIComponent(repo.name)}`;
    try {
      const tree = await get(
        `${base}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
        true,
      );
      if (!tree) {
        result.warnings.push('Empty repository or file tree unavailable.');
        results.push(result);
        continue;
      }
      if (tree.truncated)
        result.warnings.push('GitHub truncated the file tree; analysis is partial.');
      const files: { path: string; type: string; size?: number }[] = tree.tree ?? [];
      const blob = (path: string) =>
        `${result.url}/blob/${encodeURIComponent(repo.default_branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const manifests = files
        .filter(
          (f) =>
            f.type === 'blob' &&
            /(^|\/)package\.json$/.test(f.path) &&
            !/(node_modules|vendor)\//.test(f.path) &&
            (f.size ?? 0) < 100000,
        )
        .slice(0, 2);
      for (const manifest of manifests) {
        const content = await get(
          `${base}/contents/${manifest.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repo.default_branch)}`,
          true,
        );
        if (!content?.content || content.encoding !== 'base64') continue;
        const pkg = JSON.parse(Buffer.from(content.content, 'base64').toString('utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const patterns: Record<string, string[]> = {
          react: ['react'],
          node: ['express', 'fastify', 'koa'],
          express: ['express'],
          mongo: ['mongoose', 'mongodb'],
          typescript: ['typescript'],
          testing: ['supertest'],
          auth: ['express-session', 'passport', 'next-auth'],
          jobs: ['bullmq', 'bull'],
        };
        for (const [skillId, names] of Object.entries(patterns)) {
          const declared = names.filter((name) => Object.hasOwn(deps, name));
          if (declared.length && !result.signals.some((s) => s.skillId === skillId))
            result.signals.push({
              skillId,
              finding: `${manifest.path} declares ${declared.join(', ')}. Dependency presence is a project signal, not proof of your contribution.`,
              url: blob(manifest.path),
            });
        }
      }
      const docker = files.find((f) => /(^|\/)Dockerfile$/.test(f.path));
      if (docker)
        result.signals.push({
          skillId: 'docker',
          finding: 'A Dockerfile is present; runtime behavior has not been verified.',
          url: blob(docker.path),
        });
      const test = files.find(
        (f) => /\.(test|spec)\.[jt]sx?$/.test(f.path) && !f.path.includes('node_modules/'),
      );
      if (test && !result.signals.some((s) => s.skillId === 'testing'))
        result.signals.push({
          skillId: 'testing',
          finding:
            'A test-named source file is present; tests have not been executed or evaluated.',
          url: blob(test.path),
        });
      const extension =
        repo.language === 'JavaScript'
          ? 'javascript'
          : repo.language === 'Java'
            ? 'java'
            : repo.language === 'TypeScript'
              ? 'typescript'
              : '';
      if (extension && !result.signals.some((s) => s.skillId === extension))
        result.signals.push({
          skillId: extension,
          finding: `GitHub reports ${repo.language} as the primary language.`,
          url: result.url,
        });
    } catch (error) {
      result.warnings.push((error as Error).message);
    }
    results.push(result);
  }
  return results;
}
