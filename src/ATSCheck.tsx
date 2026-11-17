import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileSearch, RefreshCw } from 'lucide-react';
import {
  scoreResume,
  formatScoredReport,
  type ResumeScan,
  type ScanSummary,
} from '../shared/resume-score';
import { readResumeFile } from './lib/resume';
import { ResumeChangeReview } from './ResumeChangeReview';

async function scanApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/resume-scans' + path, {
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The scan service is unavailable. Please try again.' }));
  if (!response.ok) throw new Error(data.error ?? 'Unable to save the scan');
  return data;
}

export function ATSCheck({
  resume,
  jobDescription,
  originalResume,
  onApply,
}: {
  resume: string;
  jobDescription: string;
  originalResume?: string;
  onApply?: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(resume);
  const [job, setJob] = useState(jobDescription);
  const [checked, setChecked] = useState({ resume, job: jobDescription });
  const [report, setReport] = useState(() =>
    resume.trim().length >= 20 && jobDescription.trim().length >= 20
      ? scoreResume(resume, jobDescription)
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState<ScanSummary[]>([]);
  const [reviewEpoch, setReviewEpoch] = useState(0);
  useEffect(() => {
    scanApi<ScanSummary[]>('')
      .then(setHistory)
      .catch(() => setError('Saved scan history is unavailable. Your current text is unchanged.'));
  }, []);
  const stale = checked.resume !== text || checked.job !== job;
  const original = originalResume && report ? scoreResume(originalResume, checked.job) : null;
  async function runScan() {
    setScanning(true);
    setError('');
    try {
      const scan = await scanApi<ResumeScan>('', { resume: text, jobDescription: job });
      setReport(scan.report);
      setChecked({ resume: text, job });
      setHistory((items) =>
        [
          {
            id: scan.id,
            createdAt: scan.createdAt,
            score: scan.report.overallScore,
            keywordCoverage: scan.report.keywordCoverage,
            version: scan.report.version,
          },
          ...items,
        ].slice(0, 20),
      );
      setNotice('Scan complete and saved privately to your account.');
      setReviewEpoch((value) => value + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }
  async function loadScan(id: string) {
    setScanning(true);
    setError('');
    try {
      const scan = await scanApi<ResumeScan>('/' + encodeURIComponent(id));
      setText(scan.resume);
      setJob(scan.jobDescription);
      setChecked({ resume: scan.resume, job: scan.jobDescription });
      setReport(scan.report);
      setReviewEpoch((value) => value + 1);
      setNotice('Loaded a saved scan. Your profile and original resume have not changed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      setText(await readResumeFile(file));
      setNotice('Resume text loaded. Review the extraction, then run the check.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }
  function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="ats-checker">
      <section className="studio-panel">
        <div className="studio-section-title">
          <FileSearch size={22} />
          <div>
            <h2>Resume score & improvement studio</h2>
            <p>
              Upload your resume and target job. Get an overall score, see what affects it, and
              preview improvements before applying them.
            </p>
          </div>
        </div>
        <label className="resume-upload">
          Upload resume · PDF, TXT, or Markdown · up to 5 MB
          <input
            type="file"
            accept=".pdf,.txt,.md"
            disabled={scanning}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <div className="form-grid">
          <label>
            Resume text to check
            <textarea
              rows={9}
              maxLength={30000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label>
            Target job description for ATS check
            <textarea
              rows={9}
              maxLength={20000}
              value={job}
              onChange={(e) => setJob(e.target.value)}
            />
          </label>
        </div>
        <div className="studio-actions">
          <button
            className="button primary"
            disabled={scanning || text.trim().length < 20 || job.trim().length < 20}
            onClick={() => void runScan()}
          >
            <RefreshCw size={15} />
            {scanning ? 'Working…' : 'Run ATS check'}
          </button>
          <button
            className="button secondary"
            disabled={!text.trim()}
            onClick={() => download('jobfit-checked-resume.txt', text)}
          >
            <Download size={15} />
            Download checked resume
          </button>
          {onApply && (
            <button
              className="button secondary"
              disabled={saving || text.trim().length < 20}
              onClick={async () => {
                setSaving(true);
                setError('');
                try {
                  await onApply(text);
                  setNotice(
                    'Checked text saved to your tailored draft. The original resume is unchanged.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving…' : 'Save to tailored draft'}
            </button>
          )}
        </div>
        <p className="form-help">
          Edits here are a separate working copy. They do not change your original profile resume.
          Missing words are prompts to review your experience, not instructions to claim skills you
          do not have.
        </p>
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
      </section>
      {report && (
        <>
          <section className="resume-score-hero" aria-label="JobFit overall resume score">
            <div
              className="resume-score-gauge"
              role="img"
              aria-label={
                report.overallScore === null
                  ? 'Overall score unavailable'
                  : `JobFit resume score ${report.overallScore} out of 100`
              }
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="52" className="score-track" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="score-value"
                  pathLength="100"
                  strokeDasharray={`${report.overallScore ?? 0} 100`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div>
                <strong>{report.overallScore ?? '—'}</strong>
                <span>out of 100</span>
              </div>
            </div>
            <div className="score-headline">
              <span className="eyebrow">JOBFIT ATS READINESS ESTIMATE</span>
              <h2>{report.scoreLabel}</h2>
              <p>
                A six-category, rule-based resume score. These are JobFit's disclosed weights—not
                Cake's formula or an employer's screening result.
              </p>
              {original?.overallScore !== null && original?.overallScore !== undefined && (
                <small>
                  Original resume: {original.overallScore}/100 on the same rubric and job
                  description.
                </small>
              )}
              {report.overallScore === null && (
                <small>
                  Add at least 50 resume words and a job description with a recognized skill to
                  calculate an overall score.
                </small>
              )}
            </div>
          </section>
          <section className="studio-panel">
            <div className="score-section-heading">
              <h2>Your score breakdown</h2>
              <span className="pill">Rubric v2 · weights total 100</span>
            </div>
            <div className="score-category-grid">
              {report.categories.map((category) => (
                <div key={category.id} className="score-category">
                  <div>
                    <h3>{category.name}</h3>
                    <strong>
                      {category.earned} / {category.maximum}
                    </strong>
                  </div>
                  <meter
                    min={0}
                    max={category.maximum}
                    value={category.earned}
                    aria-label={`${category.name}: ${category.earned} out of ${category.maximum}`}
                  />
                  <details>
                    <summary>How this is scored</summary>
                    <p>{category.explanation}</p>
                  </details>
                </div>
              ))}
            </div>
          </section>
          {checked.job === job ? (
            <ResumeChangeReview
              key={reviewEpoch}
              snapshot={checked.resume}
              text={text}
              job={checked.job}
              report={report}
              onChange={(next) => {
                setText(next);
                setNotice(
                  'Your reviewed change is in the working copy. Rescan to save the updated score.',
                );
              }}
            />
          ) : (
            <p className="studio-notice" role="status">
              The job description changed. Run a new ATS check before reviewing suggestions.
            </p>
          )}
          <div className="ats-summary" aria-label="Resume check results">
            <div>
              <span className="eyebrow">RECOGNIZED JOB-TERM COVERAGE</span>
              <strong>
                {report.keywordCoverage === null ? 'Not available' : `${report.keywordCoverage}%`}
              </strong>
              <p>
                {report.matched} of {report.total} unique recognized job terms found
              </p>
              {original && (
                <small>
                  Original resume:{' '}
                  {original.keywordCoverage === null
                    ? 'not available'
                    : `${original.keywordCoverage}%`}{' '}
                  against the same job text
                </small>
              )}
            </div>
            <div>
              <span className="eyebrow">TEXT CHECKS</span>
              <strong>
                {report.checks.filter((c) => c.status === 'pass').length}/{report.checks.length}
              </strong>
              <p>Observable text checks passed · {report.wordCount} words</p>
              <small>Document layout has not been inspected.</small>
            </div>
          </div>
          {stale && (
            <p className="studio-notice" role="status">
              Your text changed. Run the check again to update these results.
            </p>
          )}
          <section className="studio-panel">
            <h2>Matched and missing job terms</h2>
            {!report.total && (
              <p>
                No supported job terms were recognized. A zero or perfect match score would be
                misleading; review the job description manually.
              </p>
            )}
            <div className="ats-keywords">
              {report.keywords.map((k) => (
                <details key={k.id}>
                  <summary>
                    <span className={`pill ${k.matched ? 'green' : 'lavender'}`}>
                      {k.matched ? 'Found' : 'Not found'}
                    </span>
                    <strong>{k.name}</strong>
                    <span>{k.importance}</span>
                  </summary>
                  <p>
                    <strong>Job excerpt:</strong> {k.jobExcerpt}
                  </p>
                  <p>
                    <strong>Resume excerpt:</strong>{' '}
                    {k.resumeExcerpt ??
                      'No matching wording found. Add a truthful example if you have one; otherwise put this topic in your preparation plan.'}
                  </p>
                </details>
              ))}
            </div>
          </section>
          <section className="studio-panel">
            <h2>Text structure and readability</h2>
            {report.checks.map((c) => (
              <div className="ats-finding" key={c.id}>
                <span className={`pill ${c.status === 'pass' ? 'green' : 'lavender'}`}>
                  {c.status === 'pass' ? 'Pass' : 'Review'}
                </span>
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.detail}</p>
                </div>
              </div>
            ))}
          </section>
          <section className="studio-panel">
            <h2>How to use this report</h2>
            <ul className="ats-limitations">
              {report.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p>
              For the exported file, manually check clear sections, single-column reading order, and
              contact details in the main body.{' '}
              <a
                href="https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse"
                target="_blank"
                rel="noreferrer"
              >
                Greenhouse documents these parsing risks.
              </a>
            </p>
            <button
              className="button secondary"
              onClick={() => download('jobfit-ats-report.txt', formatScoredReport(report))}
            >
              <Download size={15} />
              Download ATS check report
            </button>
          </section>
        </>
      )}
      {history.length > 0 && (
        <section className="studio-panel">
          <h2>Recent scans</h2>
          <p>
            Saved report snapshots from your account. Loading a scan changes this working copy only.
          </p>
          <div className="scan-history">
            {history.map((item) => (
              <button
                className="scan-history-item"
                key={item.id}
                disabled={scanning}
                onClick={() => void loadScan(item.id)}
              >
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>{item.score === null ? 'Not scored' : `${item.score}/100`}</strong>
                <small>
                  {item.keywordCoverage ?? '—'}% keyword coverage · {item.version}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
