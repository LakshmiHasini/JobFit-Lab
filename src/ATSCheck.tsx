import { useState } from 'react';
import { CheckCircle2, Download, FileSearch, RefreshCw } from 'lucide-react';
import { checkResume, formatAtsReport } from '../shared/ats';

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
      ? checkResume(resume, jobDescription)
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const stale = checked.resume !== text || checked.job !== job;
  const original = originalResume && report ? checkResume(originalResume, checked.job) : null;
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
            <h2>ATS resume check</h2>
            <p>
              Compare your resume text with the target job. Each finding includes the reason behind
              it.
            </p>
          </div>
        </div>
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
            disabled={text.trim().length < 20 || job.trim().length < 20}
            onClick={() => {
              setReport(checkResume(text, job));
              setChecked({ resume: text, job });
              setNotice('Check complete. Review the findings below.');
              setError('');
            }}
          >
            <RefreshCw size={15} />
            Run ATS check
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
              onClick={() => download('jobfit-ats-report.txt', formatAtsReport(report))}
            >
              <Download size={15} />
              Download ATS check report
            </button>
          </section>
        </>
      )}
    </section>
  );
}
