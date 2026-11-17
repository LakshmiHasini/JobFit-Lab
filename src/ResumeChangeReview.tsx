import { useState } from 'react';
import {
  changedPassages,
  proposeResumeChanges,
  previewResumeChange,
  type ResumeChange,
} from '../shared/resume-changes';
import type { ScoredReport } from '../shared/resume-score';

type Decision = 'accepted' | 'rejected';
type Accepted = {
  id: string;
  title: string;
  before: string;
  after: string;
  passageBefore: string;
  passageAfter: string;
  delta: number | null;
  undone: boolean;
};

export function ResumeChangeReview({
  snapshot,
  text,
  job,
  report,
  onChange,
}: {
  snapshot: string;
  text: string;
  job: string;
  report: ScoredReport;
  onChange: (text: string) => void;
}) {
  const [changes] = useState(() => proposeResumeChanges(snapshot, report));
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [log, setLog] = useState<Accepted[]>([]);
  const [notice, setNotice] = useState('');
  const last = log.reduce((found, item, index) => (item.undone ? found : index), -1);
  return (
    <section className="studio-panel resume-change-review">
      <h2>Review suggested changes</h2>
      <p>
        See the exact text, reason, and estimated score effect before deciding. Accept applies only
        that change to this working copy. Reject keeps your text unchanged. Save to your tailored
        draft separately when you are ready.
      </p>
      <p className="form-help">
        Score effects use the current JobFit rubric, not employer results. Zero-point improvements
        are labeled honestly. Formatting replacements need a new scan after another edit to avoid
        changing the wrong passage. Review decisions reset on a new scan; saved scans retain their
        resume text.
      </p>
      {notice && (
        <p className="studio-notice" role="status">
          {notice}
        </p>
      )}
      {!changes.length && (
        <p>No changes are proposed by this report. You can edit the resume and scan again.</p>
      )}
      {changes.map((change) => (
        <ChangeCard
          key={change.id}
          change={change}
          snapshot={snapshot}
          text={text}
          job={job}
          decision={decisions[change.id]}
          onReject={() => {
            setDecisions((d) => ({ ...d, [change.id]: 'rejected' }));
            setNotice(`Rejected: ${change.title}. Your resume was not changed.`);
          }}
          onReopen={() =>
            setDecisions((d) => {
              const next = { ...d };
              delete next[change.id];
              return next;
            })
          }
          onAccept={(replacement, preview) => {
            onChange(preview.after);
            setDecisions((d) => ({ ...d, [change.id]: 'accepted' }));
            setLog((items) => [
              ...items,
              {
                id: change.id,
                title: change.title,
                before: text,
                after: preview.after,
                passageBefore: change.before,
                passageAfter: replacement,
                delta: preview.delta,
                undone: false,
              },
            ]);
            setNotice(
              `Accepted: ${change.title}. Only your working copy changed. Rescan to save an updated score.`,
            );
          }}
        />
      ))}
      {log.length > 0 && (
        <section className="review-change-log">
          <h3>Changes you accepted in this review</h3>
          {log.map((entry, i) => (
            <details key={i}>
              <summary>
                {entry.title} · {entry.undone ? 'Undone' : 'Accepted'} ·{' '}
                {entry.delta === null
                  ? 'Score effect unavailable'
                  : `${entry.delta > 0 ? '+' : ''}${entry.delta} estimated points`}
              </summary>
              <div className="form-grid">
                <div>
                  <h3>Removed text</h3>
                  <pre>{entry.passageBefore || '(No text removed)'}</pre>
                </div>
                <div>
                  <h3>Added text</h3>
                  <pre>{entry.passageAfter || '(Text removed; nothing added)'}</pre>
                </div>
              </div>
            </details>
          ))}
          <button
            className="button secondary"
            disabled={last < 0 || text !== log[last]?.after}
            onClick={() => {
              const entry = log[last];
              onChange(entry.before);
              setLog((items) =>
                items.map((item, i) => (i === last ? { ...item, undone: true } : item)),
              );
              setDecisions((d) => {
                const next = { ...d };
                delete next[entry.id];
                return next;
              });
              setNotice(`Undone: ${entry.title}. The preceding working copy is restored.`);
            }}
          >
            Undo last accepted change
          </button>
          <p className="form-help">
            Undo is available only when the working copy still matches the accepted result. This
            prevents losing subsequent manual edits.
          </p>
        </section>
      )}
    </section>
  );
}

function ChangeCard({
  change,
  snapshot,
  text,
  job,
  decision,
  onAccept,
  onReject,
  onReopen,
}: {
  change: ResumeChange;
  snapshot: string;
  text: string;
  job: string;
  decision?: Decision;
  onAccept: (replacement: string, preview: ReturnType<typeof previewResumeChange>) => void;
  onReject: () => void;
  onReopen: () => void;
}) {
  const [replacement, setReplacement] = useState(change.proposed);
  const [confirmed, setConfirmed] = useState(false);
  let preview: ReturnType<typeof previewResumeChange> | null = null,
    problem = '';
  try {
    preview = previewResumeChange(text, snapshot, job, change, replacement);
  } catch (e) {
    problem = (e as Error).message;
  }
  const changed = preview?.after !== text;
  return (
    <article className="review-proposal" aria-label={change.title}>
      <div className="score-section-heading">
        <h3>{change.title}</h3>
        <span className="pill">{decision ?? `${change.priority} priority`}</span>
      </div>
      <p>
        <strong>Why:</strong> {change.reason}
      </p>
      {change.kind === 'append' && (
        <p className="form-help">
          Location: append a new paragraph at the end. Include the appropriate section heading in
          your text; you can move it later in the editor.
        </p>
      )}
      {change.requiresInput ? (
        <div className="form-grid">
          <div>
            <h3>Before · exact passage</h3>
            <pre>{change.before || '(Nothing here yet — no existing text will be removed)'}</pre>
          </div>
          <div>
            <h3>Proposed change</h3>
            {change.requiresInput ? (
              <label>
                Your truthful replacement or addition
                <textarea
                  aria-label={`Proposed text: ${change.title}`}
                  rows={5}
                  maxLength={5000}
                  value={replacement}
                  disabled={Boolean(decision)}
                  onChange={(e) => {
                    setReplacement(e.target.value);
                    setConfirmed(false);
                  }}
                  placeholder="Write only facts and experience you can support. No text will be added until you accept."
                />
              </label>
            ) : (
              <pre>{replacement || '(Remove this text)'}</pre>
            )}
          </div>
        </div>
      ) : (
        <div className="review-line-diff">
          <p className="form-help">
            Only changed lines are shown below; other lines remain unchanged. Trailing spaces are
            displayed as ·.
          </p>
          {changedPassages(change.before, replacement).map((passage, index) => (
            <div className="form-grid" key={index}>
              <div>
                <h3>Before · exact text</h3>
                <pre>
                  {passage.before
                    ? passage.before.replace(/ +$/g, (spaces) => '·'.repeat(spaces.length))
                    : '(Blank or absent)'}
                </pre>
              </div>
              <div>
                <h3>After · proposed text</h3>
                <pre>
                  {passage.after
                    ? passage.after.replace(/ +$/g, (spaces) => '·'.repeat(spaces.length))
                    : '(Remove this text)'}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
      {!decision && (
        <>
          <div className="change-score-impact">
            <strong>Estimated score effect</strong>
            {problem ? (
              <p>{problem}</p>
            ) : (
              preview && (
                <>
                  <p>
                    {preview.beforeScore ?? 'Unavailable'} → {preview.afterScore ?? 'Unavailable'} /
                    100 ·{' '}
                    {preview.delta === null
                      ? 'Unavailable'
                      : preview.delta === 0
                        ? 'No predicted score increase'
                        : `${preview.delta > 0 ? '+' : ''}${preview.delta} points`}
                  </p>
                  {preview.categories.length > 0 && (
                    <ul>
                      {preview.categories.map((c) => (
                        <li key={c.name}>
                          {c.name}: {c.before} → {c.after} / {c.maximum}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )
            )}
          </div>
          {change.requiresInput && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm this wording accurately describes my experience.
            </label>
          )}
          <div className="studio-actions">
            <button
              className="button primary"
              disabled={
                !preview ||
                !changed ||
                text.length > 30000 ||
                (preview?.after.length ?? 0) > 30000 ||
                (change.requiresInput && !confirmed)
              }
              onClick={() => {
                if (preview) onAccept(replacement, preview);
              }}
            >
              Accept this change
            </button>
            <button className="button secondary" onClick={onReject}>
              Reject · keep original
            </button>
          </div>
        </>
      )}
      {decision === 'rejected' && (
        <>
          <p>Your original text was kept.</p>
          <button className="text-button" onClick={onReopen}>
            Reconsider this suggestion
          </button>
        </>
      )}
      {decision === 'accepted' && (
        <p>Applied to your working copy. The accepted text is recorded below.</p>
      )}
    </article>
  );
}
