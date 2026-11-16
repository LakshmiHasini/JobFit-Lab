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
