# Resume scoring v2

Product reference: https://www.cake.me/ai-resume-checker. JobFit implements its own deterministic checking rubric and improvement flow. It does not use Cake's model, an employer integration, or an AI writing service. No resume is uploaded to Cake.

## Score definition

The overall score is the rounded sum of category contributions. Every rule and weight is shown in the report. Scoring requires at least 50 resume words and a recognized job term; otherwise it is unavailable. These weights and cutoffs are product heuristics, not validated predictors of ATS acceptance or interview outcomes.

- **Job alignment: 30 points.** Weighted recognized-term coverage: required terms weigh 3, mentioned 2, preferred 1. Repetition adds no credit. Ambiguous language and alternatives need review.
- **Section structure: 20 points.** Five each for Skills, Education, Experience/Projects, and a year-shaped string. Presence does not prove accuracy.
- **Bullet quality: 20 points.** Five for bullets, up to ten for action-led bullets, up to five for number-plus-scope expressions. Dates/phones are not scope metrics. Numbers are not verified; never invent them.
- **Text readability: 15 points.** Five for the broad 150–1,200 word review range, up to four for bullets of 35 words or fewer, three for basic text quality, three for avoiding lines over 80 words. These are style preferences.
- **Contact completeness: 10 points.** Four for an email-shaped string, three for a phone-shaped string, three for a web/profile link. This does not verify reachability or correctness.
- **Professional summary: 5 points.** Three for a summary heading, two for a 20–100 word summary. A summary is not universally required by ATS tools.

Keyword coverage remains the separate unweighted unique-term ratio. A broader score replacing a keyword-only percentage does not mean the resume improved; it changes what is being measured.

## Fixes and limitations

Suggestions identify gaps and improvements. Previewable one-click fixes only normalize existing headings, bullet markers, and whitespace. They never add skills, employers, qualifications, or achievements. Applying affects the working copy; undo restores it. Editing makes the report stale until rescanned. Saving a tailored draft is explicit and preserves the original preparation resume.

Semantic rewriting, grammar/spelling evaluation, original PDF/DOCX layout analysis, cover letters, and template preservation are not implemented here. PDF import extracts text for review; it cannot certify actual ATS parsing compatibility.

## Private scan storage

`POST /api/resume-scans` accepts bounded resume/JD text and calculates the score server-side; client-supplied scores are ignored. `GET /api/resume-scans` returns the latest 20 owner-scoped metadata records; `GET /api/resume-scans/:id` retrieves an owned snapshot. Each snapshot stores normalized input and the versioned report. Loading history changes the editor only.

Development storage is private under the git-ignored, Vite-denied `.data/` directory. MongoDB mode uses the `resumeScans` collection. Production database verification and account data deletion remain tracked release work.

## Verification

26 automated tests pass, including score sums/bounds, sparse input handling, dates/phones versus quantified accomplishments, safe fixes, server-side scoring, snapshot preservation, and cross-account isolation. Browser verification covered scan save/load, six category displays, preview/apply/undo, and history after reload. The shared PDF reader still needs a dedicated file/print walkthrough.

## Per-suggestion review

The ATS report now includes a Review suggested changes step. Each suggestion has its priority, reason, exact before/after passage, and a recalculated score/category preview under the same JobFit rubric. Safe normalization previews show only changed lines. A zero delta is labeled as no predicted increase; unavailable scores remain unavailable. These previews are not employer outcomes and are not summed to promise a final increase.

Accept applies only the reviewed change to the working copy; Reject keeps the text intact and allows reconsideration. Content changes require user-written text and explicit factual confirmation, including missing skills, summary/contact additions, and stronger accomplishment wording. Nothing is invented automatically. Additions append a paragraph with a clear location note; the user supplies a heading and may reposition it in the editor. Replacement proposals target a specific scanned passage and are blocked after other edits until rescanned to avoid rewriting the wrong text.

An in-session accepted-change log records exact removed/added passages and score impact. Undo restores the preceding working copy only if no later manual edit would be lost. A new scan resets review decisions; scan snapshots preserve the resulting resume text, not an approval audit trail. Saving to the tailored draft remains a separate explicit action. No profile resume is silently overwritten.

Verification added six regression tests for exact patches, line-only diffs, user-input requirements, stale/repeated text, zero-point changes, and unavailable score previews. Browser verification covered rejection without modification, acceptance and change logging, safe undo, and factual-confirmation gating. All 38 automated tests pass.

## Positive-impact suggestion ranking

The review flow now separates three groups: verified positive score previews ranked by measured gain, opportunities requiring the user's factual input, and optional cleanup without verified gain. Safe, conservative action-opening rewordings are proposed from existing resume sentences, then rescored before promotion. They still require factual confirmation. No keywords, skills, metrics, or outcomes are added by those rewordings.

Only edits with a positive recalculated overall-score delta can be accepted in the first two groups. User wording is rescored live, so zero/negative/unavailable effects are blocked. Cleanup remains optional and is not presented as increasing the score. Every acceptance checks the current working copy; effects are never summed or promised against stale text. A live working-copy estimate shows the improvement immediately, while the last saved scan stays labeled separately until rescanned. If no supported improvement exists, the app says so rather than fabricating one. This is the same JobFit heuristic rubric, not an employer prediction.

Four additional tests verify positive-only ranking, factual rewordings, unavailable/zero-impact exclusion, and rescored user additions (42 total passing tests). Browser verification demonstrated 74→75 on the sample user's existing action sentence, blocked a zero-point content edit, and restored the original after testing. No profile or tailored resume was overwritten.

Integration verification: merged the newer session persistence, bullet detection, empty-action, and punctuation fixes from GitHub main without overwriting them. The combined production build passes and all 49 tests pass.
