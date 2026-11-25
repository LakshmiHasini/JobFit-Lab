import { api as call } from './lib/api';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Download, Plus, Printer, Save, Trash2 } from 'lucide-react';
import type { CareerProfile } from '../shared/preparation';
import type { Project } from '../shared/domain';
import type { BuiltResume, ProjectStory, ResumeInput } from '../shared/resume-builder';
import { ATSCheck } from './ATSCheck';
import { KeepOpen } from './KeepOpen';


const blankProject = (): ProjectStory => ({
  sourceProjectId: '',
  title: '',
  technologies: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  featured: false,
  link: '',
});

export function ResumeBuilder({
  profile,
  onUse,
  userId,
}: {
  profile: CareerProfile;
  userId: string;
  onUse: (profile: CareerProfile) => void;
}) {
  const inputKey = 'jobfit-resume-builder:' + userId;
  const [input, setInput] = useState<ResumeInput>(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(inputKey) || 'null');
      if (cached && Array.isArray(cached.projects) && cached.projects.length) return cached;
    } catch {}
    return {
      fullName: profile.fullName,
      email: '',
      phone: '',
      location: '',
      github: profile.github ? `https://github.com/${profile.github}` : '',
      linkedin: profile.linkedin,
      leetcode: profile.leetcode,
      gfg: profile.gfg,
      summary: profile.headline || profile.background,
      education: '',
      experience: '',
      certifications: '',
      skills: '',
      targetRole: profile.targetRole,
      jobDescription: profile.jobDescription,
      projects: [blankProject()],
      confirmedFacts: false,
    };
  });
  const [library, setLibrary] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<BuiltResume[]>([]);
  const [active, setActive] = useState<BuiltResume | null>(null);
  const [text, setText] = useState('');
  const [view, setView] = useState<'form' | 'preview' | 'ats'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replace, setReplace] = useState(false);
  useEffect(() => {
    Promise.all([
      call<BuiltResume[]>('/resume-drafts'),
      call<{ projects: Project[] }>('/workspace'),
      call<{ user: { email: string } | null }>('/session'),
    ])
      .then(([saved, workspace, session]) => {
        setDrafts(saved);
        setLibrary(workspace.projects);
        if (session.user) setInput((i) => ({ ...i, email: i.email || session.user!.email }));
      })
      .catch((e) => setError(e.message));
  }, []);
  function remember(value: ResumeInput) {
    try {
      sessionStorage.setItem(inputKey, JSON.stringify(value));
    } catch {}
    return value;
  }
  const update = <K extends keyof ResumeInput>(key: K, value: ResumeInput[K]) =>
    setInput((i) =>
      remember({
        ...i,
        [key]: value,
        ...(key === 'confirmedFacts' ? {} : { confirmedFacts: false }),
      }),
    );
  function project(index: number, patch: Partial<ProjectStory>) {
    setInput((i) =>
      remember({
        ...i,
        confirmedFacts: false,
        projects: i.projects.map((p, n) => (n === index ? { ...p, ...patch } : p)),
      }),
    );
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function generate(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const built = await call<BuiltResume>('/resume-drafts', input);
      setDrafts((items) => [built, ...items]);
      setActive(built);
      setText(built.text);
      setReplace(false);
      setView('preview');
      setNotice('New resume generated and saved separately. Review every section before using it.');
    });
  }
  async function saveText(value = text) {
    if (!active) throw new Error('Generate a resume first.');
    const saved = await call<BuiltResume>('/resume-drafts/' + active.id, { text: value }, 'PATCH');
    setActive(saved);
    setText(saved.text);
    setDrafts((items) => items.map((d) => (d.id === saved.id ? saved : d)));
    return saved;
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jobfit-new-resume.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="resume-builder">
      <section className="studio-panel">
        <h2>A new resume, built from your real work.</h2>
        <p>
          No existing resume is needed. Choose your flagship projects and describe Situation, Task,
          Action, and Result (STAR). The job description prioritizes relevant projects and skills;
          it never becomes a claim about your experience.
        </p>
        <div className="studio-actions">
          <button className="button secondary" onClick={() => setView('form')}>
            Resume details
          </button>
          {active && (
            <>
              <button className="button secondary" onClick={() => setView('preview')}>
                Review resume
              </button>
              <button className="button secondary" onClick={() => setView('ats')}>
                Check ATS score
              </button>
            </>
          )}
        </div>
        {drafts.length > 0 && (
          <label>
            Open a saved resume
            <select
              value={active?.id ?? ''}
              onChange={(e) => {
                const d = drafts.find((d) => d.id === e.target.value);
                if (d) {
                  setActive(d);
                  setInput(remember(d.input));
                  setText(d.text);
                  setReplace(false);
                  setView('preview');
                }
              }}
            >
              <option value="" disabled>
                Select a saved draft
              </option>
              {drafts.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.input.targetRole} · {new Date(d.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="studio-notice" role="status">
          {notice}
        </p>
      )}
      {view === 'form' && (
        <form onSubmit={generate}>
          <section className="studio-panel">
            <h2>Contact and target role</h2>
            <div className="form-grid">
              <BuilderField
                label="Full name"
                value={input.fullName}
                onChange={(v) => update('fullName', v)}
                required
              />
              <BuilderField
                label="Contact email"
                type="email"
                value={input.email}
                onChange={(v) => update('email', v)}
              />
              <BuilderField
                label="Phone (optional)"
                value={input.phone}
                onChange={(v) => update('phone', v)}
              />
              <BuilderField
                label="Location (optional)"
                value={input.location}
                onChange={(v) => update('location', v)}
              />
              <BuilderField
                label="Target role for new resume"
                value={input.targetRole}
                onChange={(v) => update('targetRole', v)}
                required
              />
              <BuilderField
                label="GitHub URL (optional)"
                type="url"
                value={input.github}
                onChange={(v) => update('github', v)}
              />
              <BuilderField
                label="LinkedIn URL (optional)"
                type="url"
                value={input.linkedin}
                onChange={(v) => update('linkedin', v)}
              />
              <BuilderField
                label="LeetCode URL (optional)"
                type="url"
                value={input.leetcode}
                onChange={(v) => update('leetcode', v)}
              />
              <BuilderField
                label="GFG URL (optional)"
                type="url"
                value={input.gfg}
                onChange={(v) => update('gfg', v)}
              />
            </div>
            <BuilderField
              label="Target job description for new resume"
              value={input.jobDescription}
              onChange={(v) => update('jobDescription', v)}
              multiline
              required
              minLength={20}
            />
          </section>
          <section className="studio-panel">
            <h2>Your background and skills</h2>
            <BuilderField
              label="Professional summary (optional)"
              value={input.summary}
              onChange={(v) => update('summary', v)}
              multiline
            />
            <p className="form-help">
              Prefilled from your profile when available. Edit it to reflect your current education
              and experience. We do not infer a degree, years of experience, or achievements.
            </p>
            <BuilderField
              label="Skills you personally used (comma separated)"
              value={input.skills}
              onChange={(v) => update('skills', v)}
              multiline
            />
            <BuilderField
              label="Education: qualification, institution, dates (optional)"
              value={input.education}
              onChange={(v) => update('education', v)}
              multiline
            />
            <BuilderField
              label="Work experience or leadership: roles, organizations, dates, contributions (optional)"
              value={input.experience}
              onChange={(v) => update('experience', v)}
              multiline
            />
            <BuilderField
              label="Certifications (optional)"
              value={input.certifications}
              onChange={(v) => update('certifications', v)}
              multiline
            />
          </section>
          <section className="studio-panel">
            <h2>Select your flagship projects</h2>
            <p>
              Add 1–6 projects. Mark the strongest ones as featured. Other projects are ordered by
              recognized job-topic overlap. Selecting a library project imports its title and link
              only; describe your own contribution below.
            </p>
            {input.projects.map((p, index) => (
              <fieldset className="builder-project" key={index}>
                <legend>Project {index + 1}</legend>
                {library.length > 0 && (
                  <label>
                    Start from a saved project (optional)
                    <select
                      value={p.sourceProjectId}
                      onChange={(e) => {
                        const found = library.find((l) => l.id === e.target.value);
                        project(
                          index,
                          found
                            ? {
                                ...blankProject(),
                                sourceProjectId: found.id,
                                title: found.title,
                                link: found.repository,
                              }
                            : { sourceProjectId: '' },
                        );
                      }}
                    >
                      <option value="">Enter a project manually</option>
                      {library.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="form-grid">
                  <BuilderField
                    label={`Project ${index + 1} title`}
                    value={p.title}
                    onChange={(v) => project(index, { title: v })}
                    required
                  />
                  <BuilderField
                    label={`Project ${index + 1} technologies you used`}
                    value={p.technologies}
                    onChange={(v) => project(index, { technologies: v })}
                  />
                  <BuilderField
                    label={`Project ${index + 1} supporting URL (optional)`}
                    type="url"
                    value={p.link}
                    onChange={(v) => project(index, { link: v })}
                  />
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={p.featured}
                    onChange={(e) => project(index, { featured: e.target.checked })}
                  />
                  Feature this flagship project first
                </label>
                <BuilderField
                  label={`Project ${index + 1} situation: what problem existed? (optional)`}
                  value={p.situation}
                  onChange={(v) => project(index, { situation: v })}
                  multiline
                />
                <BuilderField
                  label={`Project ${index + 1} task: what were you responsible for? (optional)`}
                  value={p.task}
                  onChange={(v) => project(index, { task: v })}
                  multiline
                />
                <BuilderField
                  label={`Project ${index + 1} action: what did you personally implement?`}
                  value={p.action}
                  onChange={(v) => project(index, { action: v })}
                  multiline
                  required
                  minLength={10}
                />
                <BuilderField
                  label={`Project ${index + 1} result: actual outcome or measured impact (optional)`}
                  value={p.result}
                  onChange={(v) => project(index, { result: v })}
                  multiline
                />
                <p className="form-help">
                  Use a qualitative outcome if you did not measure impact. Leave unknown results
                  blank; the builder will not invent numbers.
                </p>
                {input.projects.length > 1 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        'projects',
                        input.projects.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={14} />
                    Remove project
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={input.projects.length >= 6}
              onClick={() => update('projects', [...input.projects, blankProject()])}
            >
              <Plus size={16} />
              Add another project
            </button>
          </section>
          <section className="studio-panel">
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={input.confirmedFacts}
                onChange={(e) => update('confirmedFacts', e.target.checked)}
              />
              I confirm these skills, contributions, and outcomes accurately describe my own work.
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Generating…' : 'Generate my new resume'}
              <ArrowRight size={16} />
            </button>
            <p className="form-help">
              This creates a new saved draft. Your existing profile resume is not replaced.
            </p>
          </section>
        </form>
      )}
      {active && view === 'preview' && (
        <>
          <section className="studio-panel">
            <h2>Your new resume · {active.input.targetRole}</h2>
            <p>
              Single-column text draft, composed from your supplied facts. Relevant skills and
              projects are prioritized, but missing job skills are not inserted.
            </p>
            <label>
              New resume draft
              <textarea
                rows={25}
                maxLength={30000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <div className="studio-actions">
              <button
                className="button primary"
                disabled={busy || text.trim().length < 20}
                onClick={() =>
                  void run(async () => {
                    await saveText();
                    setNotice('Resume draft saved. Your initial generated version is retained.');
                  })
                }
              >
                <Save size={15} />
                Save edits
              </button>
              <button className="button secondary" onClick={download}>
                <Download size={15} />
                Download TXT
              </button>
              <button className="button secondary" onClick={() => window.print()}>
                <Printer size={15} />
                Print / PDF
              </button>
              <button className="button secondary" onClick={() => setView('ats')}>
                Check ATS score
                <ArrowRight size={15} />
              </button>
            </div>
            <p className="form-help">
              Exports use the visible text. Print/PDF uses a simple text layout, not an existing
              document template.
            </p>
          </section>
          <section className="studio-panel">
            <h2>Use this resume for preparation</h2>
            <p>
              This sets your profile resume and target role/job description to this draft's inputs.
              Other profile details stay unchanged.
            </p>
            {profile.resume.trim() && profile.resume !== text && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                Replace my current profile resume with this draft. Keep the previous version.
              </label>
            )}
            <button
              className="button primary"
              disabled={
                busy ||
                text.trim().length < 20 ||
                Boolean(profile.resume.trim() && profile.resume !== text && !replace)
              }
              onClick={() =>
                void run(async () => {
                  const saved = await saveText();
                  const result = await call<{ profile: CareerProfile; draft: BuiltResume }>(
                    `/resume-drafts/${saved.id}/use`,
                    { replaceExisting: replace },
                  );
                  onUse(result.profile);
                  setActive(result.draft);
                  setDrafts((ds) => ds.map((d) => (d.id === result.draft.id ? result.draft : d)));
                  setNotice(
                    'Profile resume updated. You can generate a preparation plan from the Profile tab.',
                  );
                })
              }
            >
              Use this resume for preparation
              <ArrowRight size={15} />
            </button>
            {active.previousProfileResumes.length > 0 && (
              <details>
                <summary>
                  Previous profile resumes retained ({active.previousProfileResumes.length})
                </summary>
                {active.previousProfileResumes.map((prior, i) => (
                  <pre key={i}>{prior}</pre>
                ))}
              </details>
            )}
            <details>
              <summary>Initial generated version</summary>
              <pre>{active.generatedText}</pre>
            </details>
          </section>
        </>
      )}
      {active && (
        <KeepOpen key={active.id} active={view === 'ats'}>
          <ATSCheck
            key={active.id}
            resume={text}
            jobDescription={active.input.jobDescription}
            originalResume={active.generatedText}
            onApply={async (value) => {
              await saveText(value);
            }}
          />
        </KeepOpen>
      )}
      {active && (
        <div className="builder-print">
          <pre>{text}</pre>
        </div>
      )}
    </section>
  );
}
function BuilderField({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  minLength,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
  minLength?: number;
  type?: string;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          rows={3}
          maxLength={label.includes('job description') ? 20000 : 5000}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          maxLength={label.includes('URL') ? 2048 : 500}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
