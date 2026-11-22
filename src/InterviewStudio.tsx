import { api as request } from './lib/api';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Github,
  LoaderCircle,
  Plus,
  Printer,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { CareerProfile, PrepSession, Question } from '../shared/preparation';
import { skillName } from '../shared/domain';
import { codingExercises } from '../shared/preparation';
import { ATSCheck } from './ATSCheck';
import { readResumeFile } from './lib/resume';
import { ResumeBuilder } from './ResumeBuilder';
import { KeepOpen } from './KeepOpen';
import { readProfileDraft, writeProfileDraft, clearProfileDraft } from './lib/profile-draft';

type SafePrep = Omit<PrepSession, 'questions'> & {
  questions: Omit<Question, 'correct' | 'explanation'>[];
};
type QuizResult = {
  score: number;
  total: number;
  reviewTopics: string[];
  results: { questionId: string; correct: boolean; correctChoice: number; explanation: string }[];
};
export type StudioPage =
  'profile' | 'github' | 'builder' | 'preparation' | 'resume' | 'ats' | 'practice';
const pageDetails: Record<StudioPage, { title: string; description: string }> = {
  profile: {
    title: 'My profile',
    description: 'Your experience, professional links, and current resume, together in one place.',
  },
  github: {
    title: 'GitHub analysis',
    description: 'Connect your public projects to the skills you can demonstrate.',
  },
  builder: {
    title: 'Build a resume',
    description: 'Create a resume from your profile, project contributions, and target job.',
  },
  preparation: {
    title: 'Preparation plan',
    description: 'Choose your target role and timeline, then build a plan around your experience.',
  },
  resume: {
    title: 'Tailor my resume',
    description: 'Review a role-specific draft and keep every change grounded in your experience.',
  },
  ats: {
    title: 'ATS resume check',
    description: 'Check your resume against a job description and review score-improving edits.',
  },
  practice: {
    title: 'Interview practice',
    description: 'Practice questions, quizzes, and coding exercises for your target role.',
  },
};

const initial = (name: string): CareerProfile => ({
  id: '',
  ownerId: '',
  createdAt: '',
  fullName: name,
  headline: '',
  github: '',
  linkedin: '',
  leetcode: '',
  gfg: '',
  experience: 'student',
  background: '',
  codingContext: '',
  resume: '',
  targetRole: '',
  jobDescription: '',
  days: 14,
  hoursPerDay: 2,
  repositories: [],
});

export function InterviewStudio({
  name,
  onImported,
  userId,
  onAuthenticated,
  page: tab,
  onNavigate: setTab,
}: {
  name: string;
  onImported: () => Promise<void>;
  userId: string;
  onAuthenticated: (person: { id: string; name: string; email: string }) => Promise<void>;
  page: StudioPage;
  onNavigate: (page: StudioPage) => void;
}) {
  const [restoredDraft] = useState(() => readProfileDraft(userId));
  const [profile, setProfile] = useState<CareerProfile>(() => restoredDraft ?? initial(name));
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [sessions, setSessions] = useState<SafePrep[]>([]);
  const [selected, setSelected] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(Boolean(restoredDraft));
  const [draft, setDraft] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [practiceNotes, setPracticeNotes] = useState<Record<number, string>>({});
  const active = sessions.find((s) => s.id === selected) ?? sessions[0];
  useEffect(() => {
    let cancelled = false;
    const failed = (error: Error & { status?: number }) => {
      if (cancelled) return;
      setError(error.message);
      if (error.status === 401) setAuthRequired(true);
    };
    const loadProfile = request<{ profile: CareerProfile | null }>('/profile')
      .then(({ profile: saved }) => {
        if (cancelled) return;
        if (restoredDraft) setNotice('Restored your unsaved profile draft from this tab.');
        else if (saved) setProfile(saved);
        setProfileLoaded(true);
      })
      .catch(failed);
    const loadPreparations = request<SafePrep[]>('/preparations')
      .then((saved) => {
        if (!cancelled) setSessions(saved.reverse());
      })
      .catch(failed);
    void Promise.all([loadProfile, loadPreparations]).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    setDraft(active?.draftResume ?? '');
    setAnswers({});
    setResult(null);
    setPracticeNotes({});
  }, [active?.id]);
  useEffect(() => {
    if (ready && dirty) {
      writeProfileDraft(userId, profile);
    }
  }, [profile, dirty, ready, userId]);
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error & { status?: number }).status === 401) setAuthRequired(true);
    } finally {
      setBusy('');
    }
  }
  function update<K extends keyof CareerProfile>(key: K, value: CareerProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profileLoaded) return;
    await run('Saving profile', async () => {
      const saved = await request<CareerProfile>('/profile', profile, 'PUT');
      setProfile(saved);
      setDirty(false);
      clearProfileDraft(userId);
      setNotice('Profile saved. Choose a tool from the sidebar when you’re ready.');
    });
  }
  async function recoverSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    await run('Restoring sign-in and saving profile', async () => {
      const person = await request<{ id: string; name: string; email: string }>('/auth/login', {
        ...values,
        expectedUserId: userId,
      });
      await onAuthenticated(person);
      setAuthRequired(false);
      // If the first load failed and there is no valid restored draft, fetch the
      // saved profile instead of replacing it with an empty initial form.
      if (!profileLoaded && !restoredDraft) {
        const { profile: saved } = await request<{ profile: CareerProfile | null }>('/profile');
        setProfile(saved ?? initial(name));
        setProfileLoaded(true);
        setDirty(false);
        clearProfileDraft(userId);
        setNotice('Signed in. Your saved profile is ready.');
        return;
      }
      const saved = await request<CareerProfile>('/profile', profile, 'PUT');
      setProfile(saved);
      setProfileLoaded(true);
      setDirty(false);
      clearProfileDraft(userId);
      setNotice('Signed in and profile saved. Your form entries have been kept.');
    });
  }
  async function importProjects() {
    await run('Reading GitHub repositories', async () => {
      const data = await request<{ repositories: CareerProfile['repositories']; scope: string }>(
        '/github/import',
        { count: 5 },
      );
      setProfile((p) => ({ ...p, repositories: data.repositories }));
      await onImported();
      setNotice(data.scope);
    });
  }
  async function generate() {
    if (!profileLoaded) return;
    await run('Building your preparation workspace', async () => {
      const saved = await request<CareerProfile>('/profile', profile, 'PUT');
      setProfile(saved);
      setDirty(false);
      clearProfileDraft(userId);
      const prep = await request<SafePrep>('/preparations', {});
      setSessions((s) => [prep, ...s]);
      setSelected(prep.id);
      setTab('preparation');
      setNotice('Your role-specific preparation workspace is ready.');
    });
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    await run('Reading resume', async () => {
      const text = await readResumeFile(file);
      update('resume', text);
      setNotice('Resume text extracted. Review the text before saving your profile.');
    });
  }
  function download(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!ready)
    return (
      <div className="empty-state">
        <LoaderCircle size={24} />
        <p>Loading your interview workspace…</p>
      </div>
    );
  if (!profileLoaded && !authRequired)
    return (
      <section className="studio-panel" aria-label="Profile unavailable">
        <h1>Your profile is temporarily unavailable</h1>
        <p>
          Reload your workspace before making changes so your saved information stays protected.
        </p>
        <p className="error" role="alert">
          {error}
        </p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </section>
    );
  return (
    <section className="interview-studio">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CAREER WORKSPACE</div>
          <h1>{pageDetails[tab].title}</h1>
          <p>{pageDetails[tab].description}</p>
        </div>
      </div>
      {authRequired && (
        <section className="studio-panel" aria-label="Restore sign-in">
          <h2>Sign in to save your profile</h2>
          <p>
            Your session expired. Sign in with the same account to save this draft. Your form
            entries stay on this page while you sign in.
          </p>
          <form onSubmit={recoverSession}>
            <div className="form-grid">
              <label>
                Email address
                <input name="email" type="email" required autoComplete="username" />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={1}
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
            </div>
            <div className="studio-actions">
              <button className="button primary" disabled={Boolean(busy)}>
                Sign in and save profile
              </button>
            </div>
          </form>
        </section>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="studio-notice" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {busy && (
        <div className="studio-notice" role="status">
          <LoaderCircle className="spin" size={17} />
          {busy}…
        </div>
      )}
      <KeepOpen active={tab === 'ats'}>
        <ATSCheck
          key={active?.id ?? 'profile'}
          resume={active ? draft : profile.resume}
          jobDescription={active?.jobDescription ?? profile.jobDescription}
          originalResume={active?.originalResume}
          onApply={
            active
              ? async (text) => {
                  const updated = await request<SafePrep>(
                    `/preparations/${active.id}/resume`,
                    { draftResume: text },
                    'PATCH',
                  );
                  setSessions((list) => list.map((p) => (p.id === updated.id ? updated : p)));
                  setDraft(text);
                }
              : undefined
          }
        />
      </KeepOpen>
      <KeepOpen active={tab === 'builder'}>
        <ResumeBuilder
          userId={userId}
          profile={profile}
          onUse={(saved) => {
            setProfile(saved);
            setDirty(false);
            clearProfileDraft(userId);
          }}
        />
      </KeepOpen>
      {tab === 'profile' && (
        <>
          <form onSubmit={save} className="profile-form">
            <section className="studio-panel">
              <div className="studio-section-title">
                <UserRound size={20} />
                <div>
                  <h2>Your professional profile</h2>
                  <p>Your links stay private to your workspace.</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    required
                    maxLength={200}
                    value={profile.fullName}
                    onChange={(e) => update('fullName', e.target.value)}
                  />
                </label>
                <label>
                  Headline
                  <input
                    placeholder="e.g. Full-stack developer · final-year student"
                    maxLength={200}
                    value={profile.headline}
                    onChange={(e) => update('headline', e.target.value)}
                  />
                </label>
                <label>
                  Experience level
                  <select
                    value={profile.experience}
                    onChange={(e) =>
                      update('experience', e.target.value as CareerProfile['experience'])
                    }
                  >
                    <option value="student">Student / starting out</option>
                    <option value="junior">Early career</option>
                    <option value="experienced">Experienced professional</option>
                  </select>
                </label>
                <label>
                  GitHub username or profile URL
                  <input
                    placeholder="your-username or https://github.com/your-username"
                    value={profile.github}
                    onChange={(e) => update('github', e.target.value)}
                  />
                </label>
                <label>
                  LinkedIn profile (optional)
                  <input
                    type="url"
                    placeholder="https://www.linkedin.com/in/…"
                    value={profile.linkedin}
                    onChange={(e) => update('linkedin', e.target.value)}
                  />
                </label>
                <label>
                  LeetCode profile (optional)
                  <input
                    type="url"
                    placeholder="https://leetcode.com/u/…"
                    value={profile.leetcode}
                    onChange={(e) => update('leetcode', e.target.value)}
                  />
                </label>
                <label>
                  GeeksforGeeks profile (optional)
                  <input
                    type="url"
                    placeholder="https://www.geeksforgeeks.org/user/…"
                    value={profile.gfg}
                    onChange={(e) => update('gfg', e.target.value)}
                  />
                </label>
              </div>
              <label>
                Education, experience, and your contribution
                <textarea
                  rows={3}
                  maxLength={5000}
                  placeholder="Your degree, work experience, project contributions, and achievements you can support."
                  value={profile.background}
                  onChange={(e) => update('background', e.target.value)}
                />
              </label>
              <label>
                Coding practice context (optional, self-reported)
                <textarea
                  rows={3}
                  maxLength={3000}
                  placeholder="Topics you practice on LeetCode/GFG, difficult problem types, and goals. These details are not automatically verified."
                  value={profile.codingContext}
                  onChange={(e) => update('codingContext', e.target.value)}
                />
              </label>
              <p className="form-help">
                GitHub imports public repository metadata and file signals. LinkedIn, LeetCode, and
                GFG are saved profile links; their content and statistics are not scraped or
                automatically verified.
              </p>
            </section>
            <section className="studio-panel">
              <div className="studio-section-title">
                <FileText size={20} />
                <div>
                  <h2>Your current resume (optional)</h2>
                  <p>Upload your current resume or paste its text to include it in your profile.</p>
                </div>
              </div>
              <label className="resume-upload">
                Upload PDF, TXT, or Markdown · up to 5 MB
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <label>
                Resume text
                <textarea
                  maxLength={30000}
                  rows={10}
                  placeholder="Upload a resume or paste its text here. Check PDF extraction before saving."
                  value={profile.resume}
                  onChange={(e) => update('resume', e.target.value)}
                />
              </label>
            </section>
            <div className="studio-actions">
              <button
                className="button primary"
                disabled={Boolean(busy) || !profileLoaded}
                type="submit"
              >
                {dirty ? 'Save profile' : 'Save profile'}
                <ArrowRight size={16} />
              </button>
              <span className="form-help">
                {profileLoaded
                  ? 'Your tools are in the sidebar whenever you’re ready.'
                  : 'Your saved profile could not be loaded. Reload before saving to protect your existing information.'}
              </span>
            </div>
          </form>
        </>
      )}
      {tab === 'github' && (
        <>
          {(!profile.id || !profile.github || dirty) && (
            <div className="studio-notice">
              <p>Add your GitHub username and save your profile before importing projects.</p>
              <button className="text-button" onClick={() => setTab('profile')}>
                Open my profile
              </button>
            </div>
          )}
          <section className="studio-panel github-section">
            <div className="studio-section-title">
              <Github size={21} />
              <div>
                <h2>Analyze your GitHub projects</h2>
                <p>
                  Latest 5 public, non-fork, non-archived repositories. Public source only; nothing
                  is executed.
                </p>
              </div>
            </div>
            <div className="studio-actions">
              <button
                className="button secondary"
                disabled={Boolean(busy) || dirty || !profile.id || !profile.github}
                onClick={() => void importProjects()}
              >
                <Github size={16} />
                {profile.repositories.length
                  ? 'Refresh GitHub analysis'
                  : 'Import & analyze projects'}
              </button>
            </div>
            {dirty && (
              <p className="form-help">Save your changes in My profile before importing.</p>
            )}
            <div className="repository-grid">
              {profile.repositories.map((repo) => (
                <article key={repo.url} className="repository-summary">
                  <a href={repo.url} target="_blank" rel="noreferrer">
                    <strong>{repo.name}</strong>
                    <ExternalLink size={14} />
                  </a>
                  <p>{repo.description || 'No public description provided.'}</p>
                  <div className="signal-tags">
                    {repo.signals.map((s) => (
                      <a
                        key={s.skillId}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="pill"
                        title={s.finding}
                      >
                        {skillName(s.skillId)}
                      </a>
                    ))}
                  </div>
                  {repo.warnings.map((w, i) => (
                    <p className="form-help" key={i}>
                      {w}
                    </p>
                  ))}
                  {!repo.signals.length && (
                    <p className="form-help">
                      No supported signals detected. This does not imply a lack of skill.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === 'preparation' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <section className="studio-panel">
            <div className="studio-section-title">
              <Sparkles size={20} />
              <div>
                <h2>Your target and timeline</h2>
                <p>Use a real job description for role-specific preparation.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Target role
                <input
                  required
                  maxLength={200}
                  placeholder="e.g. Junior MERN developer"
                  value={profile.targetRole}
                  onChange={(e) => update('targetRole', e.target.value)}
                />
              </label>
              <label>
                Days to prepare
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={profile.days}
                  onChange={(e) => update('days', Number(e.target.value))}
                />
              </label>
              <label>
                Hours available each day
                <input
                  type="number"
                  required
                  min={1}
                  max={8}
                  step={0.5}
                  value={profile.hoursPerDay}
                  onChange={(e) => update('hoursPerDay', Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Job description
              <textarea
                required
                minLength={20}
                maxLength={20000}
                rows={6}
                placeholder="Paste the role responsibilities, required skills, and preferred qualifications."
                value={profile.jobDescription}
                onChange={(e) => update('jobDescription', e.target.value)}
              />
            </label>
          </section>

          {(!profile.id || profile.resume.trim().length < 20) && (
            <div className="studio-notice">
              <p>Save your profile and add a resume before building a plan.</p>
              <button className="text-button" type="button" onClick={() => setTab('profile')}>
                Open my profile
              </button>
            </div>
          )}
          <div className="studio-actions">
            <button
              className="button primary"
              type="submit"
              disabled={
                Boolean(busy) || !profileLoaded || !profile.id || profile.resume.trim().length < 20
              }
            >
              {active ? 'Build a new preparation plan' : 'Build my preparation plan'}
            </button>
            <span className="form-help">
              Your target and timeline are saved when you build a plan.
            </span>
          </div>
        </form>
      )}
      {(tab === 'resume' || tab === 'practice') && !active && (
        <div className="empty-state">
          <Sparkles size={27} />
          <h2>Build your preparation plan first.</h2>
          <p>
            Add your target role and timeline. Build a resume or upload one, then generate a
            preparation workspace.
          </p>
          <button className="button primary" onClick={() => setTab('preparation')}>
            Open preparation plan
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {(tab === 'preparation' || tab === 'resume' || tab === 'practice') && active && (
        <>
          <div className="prep-selector">
            <label>
              Preparation workspace
              <select value={active.id} onChange={(e) => setSelected(e.target.value)}>
                {sessions.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.role} · {new Date(s.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <span className="form-help">
              Saved snapshot · {active.plan.length} days · {active.profileSnapshot.hoursPerDay}{' '}
              hours/day
            </span>
          </div>
          {tab === 'preparation' && (
            <>
              <div className="studio-panel">
                <h2>Your role-specific route</h2>
                <p>
                  Topics without repository signals appear first. Signals are not a proficiency
                  assessment. The current technical mapping covers 12 skills; compare the plan with
                  the complete job description.
                </p>
                <div className="studio-actions">
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        'jobfit-preparation-plan.txt',
                        active.plan
                          .map(
                            (day) =>
                              `Day ${day.day}: ${day.title}\n${day.activities.map((a) => `- ${a.minutes} min: ${a.title}\n  Outcome: ${a.outcome}`).join('\n')}`,
                          )
                          .join('\n\n'),
                      )
                    }
                  >
                    <Download size={15} />
                    Download plan
                  </button>
                </div>
              </div>
              <div className="day-plan">
                {active.plan.map((day) => (
                  <details key={day.day} open={day.day === 1}>
                    <summary>
                      <span className="day-number">{String(day.day).padStart(2, '0')}</span>
                      <strong>{day.title}</strong>
                      <span>{day.activities.reduce((n, a) => n + a.minutes, 0)} min</span>
                    </summary>
                    <div className="day-activities">
                      {day.activities.map((a, i) => (
                        <div key={i}>
                          <span className="pill">{a.minutes} min</span>
                          <div>
                            <h3>{a.title}</h3>
                            <p>{a.outcome}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <div className="studio-actions">
                <button className="button primary" onClick={() => setTab('resume')}>
                  Review my resume
                  <ArrowRight size={15} />
                </button>
                <button className="button secondary" onClick={() => setTab('practice')}>
                  Start interview practice
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {tab === 'resume' && (
            <>
              <section className="studio-panel">
                <h2>Tailor the emphasis. Preserve the facts.</h2>
                <div className="studio-actions">
                  <button className="button primary" onClick={() => setTab('ats')}>
                    Check this resume for ATS
                    <ArrowRight size={15} />
                  </button>
                </div>
                <p>
                  This draft prioritizes relevant bullets within your existing bullet lists. It
                  preserves your original sections, experience, and claims. No employers,
                  qualifications, metrics, or project contributions are invented.
                </p>
                <p>
                  Review the job description and add only truthful details from work you can
                  explain. The current version does not use an AI rewriting service.
                </p>
              </section>
              <div className="resume-comparison">
                <section className="studio-panel">
                  <h2>Original resume</h2>
                  <pre>{active.originalResume}</pre>
                </section>
                <section className="studio-panel">
                  <h2>Editable tailored draft</h2>
                  <label className="sr-label" htmlFor="tailored-resume">
                    Tailored resume text
                  </label>
                  <textarea
                    id="tailored-resume"
                    rows={22}
                    value={draft}
                    maxLength={30000}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="studio-actions">
                    <button
                      className="button primary"
                      disabled={Boolean(busy) || draft.trim().length < 20}
                      onClick={() =>
                        void run('Saving resume draft', async () => {
                          const updated = await request<SafePrep>(
                            `/preparations/${active.id}/resume`,
                            { draftResume: draft },
                            'PATCH',
                          );
                          setSessions((s) => s.map((p) => (p.id === updated.id ? updated : p)));
                          setNotice('Resume draft saved. Your original is unchanged.');
                        })
                      }
                    >
                      Save draft
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => download('jobfit-tailored-resume.txt', draft)}
                    >
                      <Download size={15} />
                      TXT
                    </button>
                    <button className="button secondary" onClick={() => window.print()}>
                      <Printer size={15} />
                      Print / PDF
                    </button>
                  </div>
                  <p className="form-help">
                    Downloads and print include the currently visible draft. Save it to keep edits
                    in this workspace.
                  </p>
                </section>
              </div>
              <section className="studio-panel">
                <h2>Project stories to prepare</h2>
                {active.repositories.map((repo) => (
                  <p key={repo.url}>
                    <strong>{repo.name}:</strong> Explain the problem, your own contribution, and
                    one decision supported by a source file. Use metrics only if you actually
                    measured them.
                  </p>
                ))}
              </section>
              <div className="print-resume">
                <h1>{active.profileSnapshot.fullName}</h1>
                <pre>{draft}</pre>
              </div>
            </>
          )}
          {tab === 'practice' && (
            <>
              <section className="studio-panel">
                <h2>Technical quiz · {active.role}</h2>
                <p>
                  Curated questions selected from the recognized role topics. Answer every question
                  before checking your explanations. These are practice questions, not predictions
                  of an employer's interview.
                </p>
                {active.questions.map((q, index) => (
                  <fieldset className="quiz-question" key={q.id}>
                    <legend>
                      {index + 1}. {q.prompt}
                    </legend>
                    {q.options.map((option, i) => (
                      <label key={i}>
                        <input
                          type="radio"
                          name={q.id}
                          value={i}
                          checked={answers[q.id] === i}
                          onChange={() => {
                            setAnswers((a) => ({ ...a, [q.id]: i }));
                            setResult(null);
                          }}
                        />
                        {option}
                      </label>
                    ))}
                    {result && (
                      <div
                        className={`quiz-explanation ${result.results.find((r) => r.questionId === q.id)?.correct ? 'correct' : 'incorrect'}`}
                      >
                        <strong>
                          {result.results.find((r) => r.questionId === q.id)?.correct
                            ? 'Correct'
                            : 'Review this topic'}
                        </strong>
                        <p>
                          {
                            q.options[
                              result.results.find((r) => r.questionId === q.id)!.correctChoice
                            ]
                          }
                        </p>
                        <p>{result.results.find((r) => r.questionId === q.id)?.explanation}</p>
                      </div>
                    )}
                  </fieldset>
                ))}
                <button
                  className="button primary"
                  disabled={
                    Boolean(busy) ||
                    !active.questions.length ||
                    Object.keys(answers).length !== active.questions.length
                  }
                  onClick={() =>
                    void run('Checking answers', async () => {
                      const graded = await request<QuizResult>(`/preparations/${active.id}/quiz`, {
                        answers: Object.entries(answers).map(([questionId, choice]) => ({
                          questionId,
                          choice,
                        })),
                      });
                      setResult(graded);
                      setNotice(
                        `${graded.score}/${graded.total} correct on this quiz. ${graded.reviewTopics.length ? 'Review: ' + graded.reviewTopics.join(', ') : 'Review the explanations and practice answering aloud.'}`,
                      );
                    })
                  }
                >
                  Check answers & explanations
                  <ArrowRight size={16} />
                </button>
                {active.attempts.length > 0 && (
                  <p className="form-help">
                    {active.attempts.length} previous attempts saved with this preparation
                    workspace.
                  </p>
                )}
              </section>
              <section className="studio-panel">
                <h2>Coding and problem-solving practice</h2>
                <p>
                  Use your preferred editor and explain your approach aloud. These exercises are not
                  automatically executed or graded. Work through the fundamentals, then the
                  job-design exercise.
                </p>
                <div className="studio-actions">
                  {active.profileSnapshot.leetcode && (
                    <a
                      className="button secondary"
                      href={active.profileSnapshot.leetcode}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Your LeetCode profile
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {active.profileSnapshot.gfg && (
                    <a
                      className="button secondary"
                      href={active.profileSnapshot.gfg}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Your GFG profile
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                {codingExercises.map((exercise, index) => (
                  <details className="mock-question" key={exercise.title}>
                    <summary>{exercise.title}</summary>
                    <p>{exercise.prompt}</p>
                    <p>
                      <strong>Examples:</strong> {exercise.example}
                    </p>
                    <label>
                      Solution and reasoning notes
                      <textarea
                        rows={5}
                        value={practiceNotes[100 + index] ?? ''}
                        onChange={(e) =>
                          setPracticeNotes((n) => ({ ...n, [100 + index]: e.target.value }))
                        }
                      />
                    </label>
                    <details>
                      <summary>Review the approach after trying</summary>
                      <p>{exercise.approach}</p>
                    </details>
                  </details>
                ))}
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      'jobfit-coding-notes.txt',
                      codingExercises
                        .map((e, i) => `${e.title}\n${practiceNotes[100 + i] ?? ''}`)
                        .join('\n\n'),
                    )
                  }
                >
                  <Download size={15} />
                  Download coding notes
                </button>
              </section>
              <section className="studio-panel">
                <h2>Mock interview and project deep dives</h2>
                <p>
                  Practice aloud in 2–3 minutes. Check: situation → your action → tradeoff → result.
                  Draft notes below are temporary; download them before leaving this page.
                </p>
                {active.interviewPrompts.map((prompt, index) => (
                  <details className="mock-question" key={index}>
                    <summary>{prompt}</summary>
                    <label>
                      Your answer notes
                      <textarea
                        rows={4}
                        placeholder="Use real examples and explain what you personally did."
                        value={practiceNotes[index] ?? ''}
                        onChange={(e) =>
                          setPracticeNotes((notes) => ({ ...notes, [index]: e.target.value }))
                        }
                      />
                    </label>
                  </details>
                ))}
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      'jobfit-interview-notes.txt',
                      active.interviewPrompts
                        .map((p, i) => `${i + 1}. ${p}\n${practiceNotes[i] ?? ''}`)
                        .join('\n\n'),
                    )
                  }
                >
                  <Download size={15} />
                  Download interview notes
                </button>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
