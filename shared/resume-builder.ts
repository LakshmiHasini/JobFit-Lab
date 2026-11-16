import { checkResume } from './ats.js';

export type ProjectStory = {
  sourceProjectId: string;
  title: string;
  technologies: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  featured: boolean;
  link: string;
};
export type ResumeInput = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  github: string;
  linkedin: string;
  leetcode: string;
  gfg: string;
  summary: string;
  education: string;
  experience: string;
  certifications: string;
  skills: string;
  targetRole: string;
  jobDescription: string;
  projects: ProjectStory[];
  confirmedFacts: boolean;
};
export type BuiltResume = {
  id: string;
  ownerId: string;
  createdAt: string;
  input: ResumeInput;
  generatedText: string;
  text: string;
  previousProfileResumes: string[];
};

const section = (title: string, body: string) => (body.trim() ? `${title}\n${body.trim()}` : '');
const bullets = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);
export function buildResume(input: ResumeInput): string {
  // Job language orders existing material; it never becomes a claim about the candidate.
  const relevance = (text: string) => checkResume(text, input.jobDescription).matched;
  const projects = input.projects
    .map((project, index) => ({
      project,
      index,
      relevance: relevance(
        [project.title, project.technologies, project.action, project.result].join(' '),
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.project.featured) - Number(a.project.featured) ||
        b.relevance - a.relevance ||
        a.index - b.index,
    );
  const projectText = projects
    .map(({ project: p }) => {
      const actions = bullets(p.action);
      if (p.result.trim())
        actions[actions.length - 1] =
          `${actions[actions.length - 1].replace(/[.\s]+$/, '')}. ${p.result.trim()}`;
      return [
        p.title.trim() + (p.technologies.trim() ? ` | ${p.technologies.trim()}` : ''),
        p.link.trim(),
        p.situation.trim() ? `Context: ${p.situation.trim()}` : '',
        p.task.trim() ? `Objective: ${p.task.trim()}` : '',
        ...actions.map((a) => '- ' + a),
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  const skills = input.skills
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((skill, index) => ({ skill, index, relevance: relevance(skill) }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .map((s) => s.skill)
    .join(', ');
  return [
    input.fullName.trim(),
    [input.email, input.phone, input.location]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' | '),
    [input.linkedin, input.github, input.leetcode, input.gfg]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' | '),
    '',
    section('Summary', input.summary),
    section('Skills', skills),
    section('Projects', projectText),
    section('Experience', input.experience),
    section('Education', input.education),
    section('Certifications', input.certifications),
  ]
    .filter((value, index) => value || index === 3)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
