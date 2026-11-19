import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Code2,
  ExternalLink,
  FlaskConical,
  FolderOpen,
  FilePlus2,
  FileSearch,
  FilePenLine,
  Github,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  Search,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import {
  requirementStatus,
  skillName,
  skills,
  type Requirement,
  type Role,
  type Workspace,
} from '../shared/domain';
import './styles.css';
import { InterviewStudio, type StudioPage } from './InterviewStudio';

type Person = { id: string; name: string; email: string };
type Page = StudioPage | 'overview' | 'projects' | 'roles' | 'tasks';
function isStudioPage(page: Page): page is StudioPage {
  return !['overview', 'projects', 'roles', 'tasks'].includes(page);
}
type ModalState =
  | { type: 'project' }
  | { type: 'evidence'; projectId: string }
  | { type: 'role' }
  | { type: 'task'; role: Role; requirement: Requirement };
const empty: Workspace = { projects: [], evidence: [], roles: [], tasks: [] };
async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function App() {
  const [user, setUser] = useState<Person | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Workspace>(empty);
  const [page, setPage] = useState<Page>('profile');
  const [navOpen, setNavOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = async () => setData(await api<Workspace>('/workspace'));
  useEffect(() => {
    api<{ user: Person | null; demo: boolean }>('/session')
      .then(async (session) => {
        setDemo(session.demo);
        if (session.user) {
          await refresh();
          setUser(session.user);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  async function authenticated(person: Person) {
    await refresh();
    if (user?.id !== person.id) setPage('profile');
    setUser(person);
    setError('');
  }
  async function mutate(path: string, body: unknown, method = 'POST') {
    if (pending) return false;
    setPending(true);
    setError('');
    try {
      await api(path, body, method);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  }
  const role = data.roles.find((r) => r.id === selectedRole) ?? data.roles[0];
  const confirmed = data.roles.flatMap((r) => r.requirements).filter((r) => r.confirmed);
  const linked = confirmed.filter((r) => requirementStatus(r, data.evidence) === 'Evidence linked');
  const openTasks = data.tasks.filter((t) => !t.done);
  const navigateRole = (id: string) => {
    setSelectedRole(id);
    setPage('roles');
  };
  const navigate = (next: Page) => {
    setPage(next);
    setNavOpen(false);
    window.scrollTo(0, 0);
  };
  if (!ready)
    return (
      <div className="loading">
        <FlaskConical size={28} />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user) return <Auth demo={demo} onAuthenticated={authenticated} initialError={error} />;
  const pages: { id: Page; label: string; icon: typeof Target }[] = [
    { id: 'profile', label: 'My profile', icon: UserRound },
    { id: 'github', label: 'GitHub analysis', icon: Github },
    { id: 'builder', label: 'Build a resume', icon: FilePlus2 },
    { id: 'preparation', label: 'Preparation plan', icon: ClipboardList },
    { id: 'resume', label: 'Tailor my resume', icon: FilePenLine },
    { id: 'ats', label: 'ATS resume check', icon: FileSearch },
    { id: 'practice', label: 'Interview practice', icon: MessagesSquare },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Project evidence', icon: FolderOpen },
    { id: 'roles', label: 'Target roles', icon: Target },
    { id: 'tasks', label: 'Preparation tasks', icon: CheckCircle2 },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? 'nav-open' : ''}`}>
        <div className="sidebar-header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('profile');
            }}
          >
            <span className="brand-mark">
              <FlaskConical size={23} />
            </span>
            <span>
              JobFit<span className="brand-light"> Lab</span>
              <small>YOUR NEXT CHAPTER</small>
            </span>
          </a>
          <button
            className="icon-button nav-toggle"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            aria-controls="workspace-navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav id="workspace-navigation" aria-label="Workspace navigation">
          {pages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? 'active' : ''} ${p.id === 'overview' ? 'nav-group-start' : ''}`}
              onClick={() => navigate(p.id)}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <p.icon size={19} />
              {p.label}
              {p.id === 'roles' && <span className="nav-count">{data.roles.length}</span>}
            </button>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar">
            {user.name
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')}
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>Personal workspace</small>
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await api('/auth/logout', {});
                setUser(null);
                setData(empty);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <ChevronRight size={14} />
            <span>{pages.find((p) => p.id === page)?.label}</span>
          </div>
          <div className="header-right">
            <span className="private-label">
              <span className="status-dot" />
              Private workspace
            </span>
            <span className="header-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main id="main-content">
          {demo && (
            <div className="demo-banner">
              <FlaskConical size={15} />
              <span>
                Local development · Your saved accounts and profiles stay on this computer.
              </span>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div hidden={!isStudioPage(page)}>
            <InterviewStudio
              key={user.id}
              page={isStudioPage(page) ? page : 'profile'}
              onNavigate={navigate}
              name={user.name}
              userId={user.id}
              onAuthenticated={authenticated}
              onImported={refresh}
            />
          </div>
          {page === 'overview' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE YOUR NEXT MOVE</div>
                  <h1>A clearer path to your next role.</h1>
                  <p>Connect what you've built to where you want to go.</p>
                </div>
                <button className="button primary" onClick={() => setModal({ type: 'role' })}>
                  <Plus size={17} />
                  Add a target role
                </button>
              </div>
              <section className="welcome-panel">
                <div>
                  <span className="pill lavender">
                    <Sparkles size={13} />
                    YOUR CAREER, WITH INTENTION
                  </span>
                  <h2>
                    You have the experience.
                    <br />
                    Let's make it visible.
                  </h2>
                  <p>
                    Bring your projects and job descriptions together.
                    <br className="desktop-break" /> Find the gaps, gather your evidence, and build
                    a focused plan.
                  </p>
                  <button
                    className="button dark"
                    onClick={() => {
                      if (data.roles.length) navigateRole(data.roles[0].id);
                      else setModal({ type: 'role' });
                    }}
                  >
                    Review your next role <ArrowRight size={16} />
                  </button>
                </div>
                <div className="evidence-illustration" aria-hidden="true">
                  <div className="orbit-label">
                    <Code2 size={16} />
                    Your projects
                  </div>
                  <div className="illustration-path" />
                  <div className="orbit-center">
                    <FlaskConical size={33} />
                  </div>
                  <div className="orbit-target">
                    <Target size={19} />
                    Your next role
                  </div>
                  <div className="orbit-check">
                    <Check size={15} />
                    Evidence connected
                  </div>
                </div>
              </section>
              <div className="stats-grid">
                <Stat
                  icon={FolderOpen}
                  label="Projects in your library"
                  value={data.projects.length}
                  note={`${data.evidence.length} evidence ${data.evidence.length === 1 ? 'entry' : 'entries'} recorded`}
                />
                <Stat
                  icon={Target}
                  label="Roles you're exploring"
                  value={data.roles.length}
                  note={`${confirmed.length} requirements confirmed`}
                />
                <Stat
                  icon={CheckCircle2}
                  label="Requirements with evidence"
                  value={`${linked.length}/${confirmed.length}`}
                  note="Across confirmed requirements"
                />
                <Stat
                  icon={ClipboardList}
                  label="Next steps to work on"
                  value={openTasks.length}
                  note={`${data.tasks.filter((t) => t.done).length} preparation tasks completed`}
                />
              </div>
              <div className="overview-columns">
                <section>
                  <SectionHeading
                    title="Your target roles"
                    count={data.roles.length}
                    action="View all roles"
                    onClick={() => setPage('roles')}
                  />
                  {data.roles.length ? (
                    <div className="role-list">
                      {data.roles.slice(0, 3).map((r) => (
                        <RoleCard
                          key={r.id}
                          role={r}
                          evidence={data.evidence}
                          onClick={() => navigateRole(r.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Where do you want to go?"
                      description="Paste a job description to start reviewing its requirements."
                      action="Add your first role"
                      onClick={() => setModal({ type: 'role' })}
                    />
                  )}
                </section>
                <section>
                  <SectionHeading
                    title="Your next steps"
                    action="View plan"
                    onClick={() => setPage('tasks')}
                  />
                  {openTasks.length ? (
                    <div className="task-list">
                      {openTasks.slice(0, 4).map((t) => (
                        <div className="task-row" key={t.id}>
                          <ClipboardList size={18} />
                          <div>
                            <strong>{t.title}</strong>
                            <small>{t.criteria}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="next-steps">
                      <span className="soft-icon">
                        <ClipboardList size={23} />
                      </span>
                      <h3>A little direction goes a long way.</h3>
                      <p>
                        Review a role's requirements, then turn an uncovered skill into a practical
                        next step.
                      </p>
                      <button className="text-button" onClick={() => setPage('roles')}>
                        Find your next step <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <div className="footnote">
                <BookOpen size={15} />
                Your evidence is self-reported. Coverage helps you prepare; it does not predict
                hiring outcomes.
              </div>
            </>
          )}
          {page === 'projects' && (
            <>
              <PageHeading
                eyebrow="SHOW YOUR WORK"
                title="Your project evidence"
                description="Capture what you built, how you built it, and the skills it demonstrates."
                action="Add project"
                onClick={() => setModal({ type: 'project' })}
              />
              {data.projects.length ? (
                <div className="project-grid">
                  {data.projects.map((p) => (
                    <article className="project-card" key={p.id}>
                      <div className="project-title">
                        <span className="soft-icon">
                          <Code2 size={21} />
                        </span>
                        {p.repository && (
                          <a
                            className="icon-button"
                            aria-label={`Open ${p.title} repository`}
                            href={p.repository}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={17} />
                          </a>
                        )}
                      </div>
                      <h2>{p.title}</h2>
                      <p>{p.description}</p>
                      <div className="evidence-list">
                        {data.evidence
                          .filter((e) => e.projectId === p.id)
                          .map((e) => (
                            <div key={e.id}>
                              <span className="pill">{skillName(e.skillId)}</span>
                              <p>{e.statement}</p>
                              {e.url && (
                                <a href={e.url} target="_blank" rel="noreferrer">
                                  Supporting link <ArrowUpRight size={13} />
                                </a>
                              )}
                            </div>
                          ))}
                      </div>
                      <button
                        className="button secondary full"
                        onClick={() => setModal({ type: 'evidence', projectId: p.id })}
                      >
                        <Plus size={15} />
                        Add evidence
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Start with something you've built"
                  description="Add a project, then record individual examples of skills you used."
                  action="Add your first project"
                  onClick={() => setModal({ type: 'project' })}
                />
              )}
            </>
          )}
          {page === 'roles' && (
            <>
              <PageHeading
                eyebrow="PREPARE WITH PURPOSE"
                title="Your target roles"
                description="Review the requirements. Connect the evidence. Decide what comes next."
                action="Add role"
                onClick={() => setModal({ type: 'role' })}
              />
              {data.roles.length ? (
                <>
                  <div className="role-tabs" aria-label="Select target role">
                    {data.roles.map((r) => (
                      <button
                        key={r.id}
                        className={`role-tab ${role?.id === r.id ? 'selected' : ''}`}
                        onClick={() => setSelectedRole(r.id)}
                        aria-pressed={role?.id === r.id}
                      >
                        {r.title}
                        <small>{r.company}</small>
                      </button>
                    ))}
                  </div>
                  {role && (
                    <>
                      <div className="assessment-header">
                        <div>
                          <h2>{role.title}</h2>
                          <p>{role.company}</p>
                        </div>
                        <span className="pill">
                          Description v{role.version} · Rule-based suggestions
                        </span>
                      </div>
                      <p className="review-note">
                        These are keyword proposals, including potentially ambiguous mentions.
                        Confirm each requirement and its importance before linking your evidence.
                        Only recognized skills are listed. Always compare these proposals with the
                        original description.
                      </p>
                      {!role.requirements.length && (
                        <div className="empty-state">
                          <Search size={24} />
                          <h3>No supported skills recognized</h3>
                          <p>
                            The current dictionary contains {skills.length} technical skills. Try a
                            description mentioning React, authentication, or API testing. Manual
                            requirement editing is planned.
                          </p>
                        </div>
                      )}
                      {role.requirements.map((req) => (
                        <RequirementCard
                          key={`${role.id}-${req.id}-${JSON.stringify(req)}`}
                          requirement={req}
                          evidence={data.evidence}
                          projects={data.projects}
                          pending={pending}
                          onSave={(patch) =>
                            mutate(`/roles/${role.id}/requirements/${req.id}`, patch, 'PATCH')
                          }
                          onTask={() => setModal({ type: 'task', role, requirement: req })}
                        />
                      ))}
                      <details className="original-description">
                        <summary>Original job description</summary>
                        <p>{role.description}</p>
                      </details>
                    </>
                  )}
                </>
              ) : (
                <Empty
                  title="Find a role worth preparing for"
                  description="Paste a job description. You'll review every proposed requirement before assessment."
                  action="Add your first role"
                  onClick={() => setModal({ type: 'role' })}
                />
              )}
            </>
          )}
          {page === 'tasks' && (
            <>
              <PageHeading
                eyebrow="SMALL STEPS, REAL PROGRESS"
                title="Your preparation tasks"
                description="Turn uncovered requirements into practical work with clear completion criteria."
              />
              {data.tasks.length ? (
                <div className="plan-list">
                  {data.tasks.map((t) => (
                    <article className={`plan-card ${t.done ? 'completed' : ''}`} key={t.id}>
                      <input
                        type="checkbox"
                        aria-label={`Mark ${t.title} ${t.done ? 'incomplete' : 'complete'}`}
                        checked={t.done}
                        disabled={pending}
                        onChange={() => void mutate(`/tasks/${t.id}`, { done: !t.done }, 'PATCH')}
                      />
                      <div>
                        <span className="eyebrow">
                          {data.roles.find((r) => r.id === t.roleId)?.title}
                        </span>
                        <h2>{t.title}</h2>
                        <p>
                          <strong>Done when:</strong> {t.criteria}
                        </p>
                        <small>
                          {t.done
                            ? 'Task complete. Add project evidence separately to update requirement coverage.'
                            : 'Complete the work, then record the evidence in your project library.'}
                        </small>
                      </div>
                      <span className={`pill ${t.done ? 'green' : ''}`}>
                        {t.done ? 'Complete' : 'To do'}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Make your preparation actionable"
                  description="Open a role, confirm a requirement, and choose Create preparation task."
                  action="Review target roles"
                  onClick={() => setPage('roles')}
                />
              )}
            </>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          state={modal}
          pending={pending}
          error={error}
          close={() => {
            setModal(null);
            setError('');
          }}
          submit={async (path, body) => {
            if (await mutate(path, body)) setModal(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Target;
  label: string;
  value: React.ReactNode;
  note: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function SectionHeading({
  title,
  count,
  action,
  onClick,
}: {
  title: string;
  count?: number;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {count !== undefined && <span>{count}</span>}
      </h2>
      <button className="text-button" onClick={onClick}>
        {action}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="button primary" onClick={onClick}>
          <Plus size={17} />
          {action}
        </button>
      )}
    </div>
  );
}
function Empty({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <FolderOpen size={26} />
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="button secondary" onClick={onClick}>
        {action}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function RoleCard({
  role,
  evidence,
  onClick,
}: {
  role: Role;
  evidence: Workspace['evidence'];
  onClick: () => void;
}) {
  const confirmed = role.requirements.filter((r) => r.confirmed);
  const linked = confirmed.filter((r) => requirementStatus(r, evidence) === 'Evidence linked');
  const percentage = confirmed.length ? (linked.length / confirmed.length) * 100 : 0;
  return (
    <button className="role-card" onClick={onClick}>
      <span className="role-logo">
        <BriefcaseBusiness size={20} />
      </span>
      <div className="role-card-content">
        <strong>{role.title}</strong>
        <small>{role.company}</small>
        <div className="coverage-line">
          <span>
            {linked.length} of {confirmed.length} confirmed requirements with evidence
          </span>
          <ArrowUpRight size={16} />
        </div>
        <div className="coverage-track">
          <div style={{ width: `${percentage}%` }} />
        </div>
        <span className="review-count">
          {role.requirements.filter((r) => !r.confirmed).length} proposed requirements to review
        </span>
      </div>
    </button>
  );
}
function RequirementCard({
  requirement: req,
  evidence,
  projects,
  pending,
  onSave,
  onTask,
}: {
  requirement: Requirement;
  evidence: Workspace['evidence'];
  projects: Workspace['projects'];
  pending: boolean;
  onSave: (patch: unknown) => Promise<boolean>;
  onTask: () => void;
}) {
  const [confirmed, setConfirmed] = useState(req.confirmed);
  const [importance, setImportance] = useState(req.importance);
  const [ids, setIds] = useState(req.evidenceIds);
  const status = requirementStatus(req, evidence);
  const matches = evidence.filter((e) => e.skillId === req.skillId);
  return (
    <article className="requirement-card">
      <div className="requirement-heading">
        <h3>{skillName(req.skillId)}</h3>
        <span className={`pill ${status === 'Evidence linked' ? 'green' : 'lavender'}`}>
          {status}
        </span>
      </div>
      <blockquote>{req.excerpt}</blockquote>
      <div className="requirement-controls">
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this is a requirement
        </label>
        <label>
          Importance{' '}
          <select
            value={importance}
            onChange={(e) => setImportance(e.target.value as Requirement['importance'])}
          >
            <option value="required">Required</option>
            <option value="preferred">Preferred</option>
            <option value="unclear">Unclear</option>
          </select>
        </label>
      </div>
      <fieldset disabled={!confirmed}>
        <legend>Attach your evidence</legend>
        {matches.length ? (
          matches.map((e) => (
            <label className="evidence-option" key={e.id}>
              <input
                type="checkbox"
                checked={ids.includes(e.id)}
                onChange={(event) =>
                  setIds(event.target.checked ? [...ids, e.id] : ids.filter((id) => id !== e.id))
                }
              />
              <span>
                <strong>{projects.find((p) => p.id === e.projectId)?.title}</strong>{' '}
                <span>{e.statement}</span>
              </span>
            </label>
          ))
        ) : (
          <p className="muted">
            No evidence recorded for this skill yet. Add an entry in Project evidence.
          </p>
        )}
      </fieldset>
      <div className="requirement-footer">
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => void onSave({ confirmed, importance, evidenceIds: confirmed ? ids : [] })}
        >
          <Check size={15} />
          Save review
        </button>
        <button className="text-button" disabled={!req.confirmed || pending} onClick={onTask}>
          Create preparation task
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}
function Modal({
  state,
  close,
  submit,
  pending,
  error,
}: {
  state: ModalState;
  close: () => void;
  submit: (path: string, body: unknown) => Promise<void>;
  pending: boolean;
  error: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const titles = {
    project: 'Add a project',
    evidence: 'Record project evidence',
    role: 'Add a target role',
    task: 'Create a preparation task',
  };
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (state.type === 'project') void submit('/projects', values);
    if (state.type === 'evidence')
      void submit('/evidence', { ...values, projectId: state.projectId });
    if (state.type === 'role') void submit('/roles', values);
    if (state.type === 'task')
      void submit('/tasks', {
        ...values,
        roleId: state.role.id,
        requirementId: state.requirement.id,
      });
  }
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else close();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{titles[state.type]}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={pending}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={onSubmit}>
        {state.type === 'project' && (
          <>
            <Field
              label="Project title"
              name="title"
              placeholder="e.g. CollabBoard"
              maxLength={100}
            />
            <Field
              label="What did you build?"
              name="description"
              placeholder="Describe the product and your contribution"
              multiline
            />
            <Field
              label="Repository URL (optional)"
              name="repository"
              type="url"
              required={false}
              placeholder="https://github.com/…"
            />
          </>
        )}
        {state.type === 'evidence' && (
          <>
            <label>
              Skill
              <select name="skillId" required>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="What does this demonstrate?"
              name="statement"
              placeholder="Describe what you implemented and how it works"
              multiline
            />
            <Field
              label="Supporting URL (optional)"
              name="url"
              type="url"
              required={false}
              placeholder="Link to relevant code, documentation, or demo"
            />
            <p className="form-help">
              This records your own explanation. A link alone does not verify proficiency.
            </p>
          </>
        )}
        {state.type === 'role' && (
          <>
            <Field
              label="Role title"
              name="title"
              placeholder="e.g. Full-stack developer"
              maxLength={100}
            />
            <Field
              label="Company"
              name="company"
              placeholder="e.g. Northstar Studio"
              maxLength={100}
            />
            <Field
              label="Job description"
              name="description"
              placeholder="Paste the requirements here. Keep the original wording and line breaks."
              multiline
              minLength={20}
            />
            <p className="form-help">
              You'll review all proposed requirements before they count toward coverage.
            </p>
          </>
        )}
        {state.type === 'task' && (
          <>
            <span className="pill lavender">{skillName(state.requirement.skillId)}</span>
            <Field
              label="Task title"
              name="title"
              defaultValue={`Demonstrate ${skillName(state.requirement.skillId)}`}
              maxLength={200}
            />
            <Field
              label="Done when…"
              name="criteria"
              placeholder="Write a concrete, checkable result"
              multiline
            />
            <p className="form-help">
              Completing this task won't automatically create project evidence.
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={close} disabled={pending}>
            Cancel
          </button>
          <button className="button primary" disabled={pending} type="submit">
            {pending ? 'Saving…' : 'Save and continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
function Field({
  label,
  name,
  multiline,
  required = true,
  ...props
}: {
  label: string;
  name: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea name={name} required={required} rows={5} maxLength={5000} {...props} />
      ) : (
        <input name={name} required={required} {...props} />
      )}
    </label>
  );
}
function Auth({
  demo,
  onAuthenticated,
  initialError,
}: {
  demo: boolean;
  onAuthenticated: (person: Person) => Promise<void>;
  initialError: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function authenticate(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await onAuthenticated(await api<Person>(path, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <FlaskConical size={26} />
          </span>
          JobFit Lab
        </div>
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Less guessing.
            <br />
            More direction.
          </h1>
          <p>
            Connect your project evidence to the roles you want. Turn the gaps into a plan you can
            act on.
          </p>
          <div className="auth-steps">
            <span>
              <FolderOpen size={19} />
              Collect what you've built
            </span>
            <ArrowDown size={15} />
            <span>
              <Target size={19} />
              Understand what a role needs
            </span>
            <ArrowDown size={15} />
            <span>
              <CheckCircle2 size={19} />
              Build your next step
            </span>
          </div>
        </div>
        <small>Made for progress, not predictions.</small>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="pill lavender">YOUR PERSONAL CAREER WORKSPACE</span>
          <h2>
            {mode === 'login' ? 'Welcome to your next step.' : 'Make room for your next chapter.'}
          </h2>
          <p>
            {mode === 'login'
              ? 'Sign in to gather your evidence and prepare with purpose.'
              : 'Create an account to start connecting your experience.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void authenticate(`/auth/${mode}`, Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            {mode === 'register' && <Field label="Your name" name="name" maxLength={80} />}
            <Field label="Email address" name="email" type="email" />
            <Field
              label="Password"
              name="password"
              type="password"
              minLength={mode === 'register' ? 10 : 1}
              maxLength={128}
            />
            {mode === 'register' && <small>Use at least 10 characters.</small>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? 'Opening workspace…' : mode === 'login' ? 'Sign in' : 'Create account'}
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            className="text-button auth-switch"
            disabled={busy}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
          {demo && (
            <div className="demo-entry">
              <div className="auth-divider">
                <span />
                or explore first
                <span />
              </div>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => void authenticate('/auth/demo', {})}
              >
                <FlaskConical size={17} />
                Open demo workspace
                <ArrowUpRight size={16} />
              </button>
              <small>Isolated sample workspace. Data resets on API restart.</small>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
