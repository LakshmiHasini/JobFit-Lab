# Project-based resume builder

An existing resume and GitHub import are optional. Users can start from their profile and target job, choose 1–6 flagship projects, or enter projects manually. A saved library project only supplies its title/link; it never supplies invented personal contributions.

## Inputs and generation

The form accepts contact details, profile links, a professional summary, skills actually used, education, work/leadership experience, certifications, the target role/JD, and project narratives. Situation, Task, and Result fields are optional; the user's own Action description is required. Outcomes can be qualitative or omitted. Users explicitly confirm the supplied claims.

Generation is deterministic composition, not AI rewriting. It prioritizes user-featured projects, then recognized job-topic overlap, and reorders only supplied skills. It never imports missing job requirements as qualifications or fabricates experience/metrics. Empty sections are omitted. User wording, institutions, dates, and outcomes are preserved; a review/editor step allows polishing before export.

## Saved versions and preparation

- `POST /api/resume-drafts`: validate facts and owner-scoped project references, generate and save a separate draft.
- `GET /api/resume-drafts`: list private saved drafts.
- `PATCH /api/resume-drafts/:id`: save edited text; keep the initial generated version.
- `POST /api/resume-drafts/:id/use`: explicitly adopt saved text and its target role/JD for preparation. Replacing a different, nonempty profile resume requires confirmation. Its previous text is retained on the draft before the profile changes.

The builder supports TXT download, a simple browser print/PDF layout, and the existing ATS score/check flow. Export is the current visible working copy. Save edits to retain them server-side. Unsaved builder inputs are retained in tab-scoped session storage keyed by account; generated drafts use the existing private local/MongoDB storage adapters. Layout-perfect document templating and semantic AI writing remain separate future enhancements.

Profile saves allow empty resume/GitHub fields. Preparation generation requires a built or uploaded resume, but does not require imported repositories. A missing profile can be initialized when a draft is explicitly adopted, after which the user can adjust the default preparation timeline and profile details.

## Verification

32 tests pass, including six new tests for factual ordering, featured-project preference, omitted sections, absence of invented job skills/metrics, a complete no-resume/no-GitHub journey, explicit replacement/history retention, and cross-account project/draft protection. Browser verification generated a separate draft from supplied project descriptions, checked ATS availability, reopened the saved draft after reload, and verified that replacing the current profile resume remained disabled without confirmation. Existing profile data was not replaced during that walkthrough.
