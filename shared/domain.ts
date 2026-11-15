export const skills = [
  { id: 'react', name: 'React', aliases: ['react', 'reactjs', 'react.js'] },
  { id: 'node', name: 'Node.js', aliases: ['node.js', 'nodejs', 'node'] },
  { id: 'express', name: 'Express', aliases: ['express', 'express.js'] },
  { id: 'mongo', name: 'MongoDB', aliases: ['mongodb', 'mongo'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['typescript'] },
  { id: 'javascript', name: 'JavaScript', aliases: ['javascript'] },
  { id: 'java', name: 'Java', aliases: ['java'] },
  { id: 'testing', name: 'API testing', aliases: ['api testing', 'integration tests', 'supertest'] },
  { id: 'auth', name: 'Authentication', aliases: ['authentication', 'session management', 'oauth'] },
  { id: 'jobs', name: 'Background jobs', aliases: ['background jobs', 'background processing', 'bullmq', 'job queues'] },
  { id: 'docker', name: 'Docker', aliases: ['docker', 'containerization'] },
  { id: 'sql', name: 'SQL', aliases: ['sql', 'postgresql', 'mysql'] }
];
export const skillName = (id: string) => skills.find(s => s.id === id)?.name ?? id;
export type Requirement = { id: string; skillId: string; excerpt: string; importance: 'required' | 'preferred' | 'unclear'; confirmed: boolean; evidenceIds: string[] };
export type Project = { id: string; ownerId: string; title: string; description: string; repository: string; createdAt: string };
export type Evidence = { id: string; ownerId: string; projectId: string; skillId: string; statement: string; url: string; createdAt: string };
export type Role = { id: string; ownerId: string; title: string; company: string; description: string; requirements: Requirement[]; version: number; createdAt: string };
export type Task = { id: string; ownerId: string; roleId: string; requirementId: string; title: string; criteria: string; done: boolean; createdAt: string };
export type User = { id: string; name: string; email: string; passwordHash: string; createdAt: string };
export type Workspace = { projects: Project[]; evidence: Evidence[]; roles: Role[]; tasks: Task[] };

// Every match is a proposal. A keyword mention never becomes confirmed evidence.
export function extractRequirements(text: string): Requirement[] {
  const lines = text.split(/\n+|(?<=[!?;])\s+/).map(l => l.trim()).filter(Boolean);
  const found: Requirement[] = [];
  for (const line of lines) {
    for (const skill of skills) {
      const matched = skill.aliases.some(alias => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i').test(line);
      });
      if (!matched) continue;
      const ambiguous = /not required|no experience|not necessary|do not need|don't need/i.test(line);
      const importance = ambiguous ? 'unclear' : /preferred|nice.to.have|bonus|optional/i.test(line) ? 'preferred' : /required|must|essential|requirement/i.test(line) ? 'required' : 'unclear';
      found.push({ id: `req-${found.length + 1}`, skillId: skill.id, excerpt: line, importance, confirmed: false, evidenceIds: [] });
    }
  }
  return found;
}

export function requirementStatus(req: Requirement, evidence: Evidence[]) {
  if (!req.confirmed) return 'Needs review';
  if (req.evidenceIds.some(id => evidence.some(e => e.id === id && e.skillId === req.skillId))) return 'Evidence linked';
  return 'No evidence recorded';
}
