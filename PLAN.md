# JobFit Lab implementation plan

## Goal

Build a profile-first interview preparation workspace: professional/coding profiles, current resume, GitHub project signals, a target job, a budgeted preparation plan, resume tailoring, quizzes, and interview guidance. Coverage is not a hiring prediction or an ATS score.

## Scope revision — interview studio

The user expanded the original evidence tracker into an end-to-end interview preparation product. The sections below retain the original delivery history; the new primary workflow is:

1. **Complete profile — implemented:** GitHub, LinkedIn, LeetCode, GFG, resume PDF/text input, background, experience, role/JD, and preparation time.
2. **Analyze GitHub — implemented baseline:** latest five eligible public repositories, linked manifest/tree/language signals, repeat-import deduplication, and warnings. Deep code understanding, contribution attribution, private repos, and exhaustive repository analysis remain.
3. **Generate preparation — implemented baseline:** saved input snapshots, role-topic mapping, gap-first daily activities, strict daily time budgets, and downloadable plans. The current mapping is a curated set of 12 skills, not semantic full-JD understanding.
4. **Tailor resume — implemented baseline:** ATS-oriented local text checking now adds explainable keyword coverage, source excerpts, text structure checks, original/draft comparison, and TXT report export. Actual document-layout parsing and employer-specific ATS evaluation remain outside this check. original preserved, relevant contiguous bullets reprioritized, editable/saved draft, TXT export, and browser print/PDF. Semantic AI rewriting, template-preserving document export, and OCR remain.
5. **Practice interviews — implemented baseline:** curated role-topic quizzes, private answer keys, graded explanations, attempt history, coding exercises, behavioral prompts, project deep dives, and downloadable notes. Live coding execution, AI answer feedback, and voice mocks remain.
6. **Production and advanced integrations — pending:** MongoDB integration verification, full browser/PDF/export QA, account recovery, durable production hosting, explicitly authorized AI-provider configuration, and supported LinkedIn/coding-platform integrations.

LinkedIn, LeetCode, and GFG links and statistics are not scraped. Coding context is explicitly self-reported. No AI provider is connected; resumes are not sent to an external AI service. Current development uses private, git-ignored local file storage for accounts, sessions, profiles, and preparation data. MongoDB remains required for production.

## Phase 1 — Foundation and local preview

- React + TypeScript + Vite, Express API, shared domain types, environment validation, error handling.
- Explicit local demo adapter; real MongoDB adapter when configured.
- Done when installation, build, tests, and local preview work.

## Phase 2 — Accounts and evidence library

- Email/password accounts, password hashing, cookie sessions, ownership checks.
- Create projects and evidence with skill tags and supporting links.
- Done when two accounts cannot access each other's records and the evidence flow works.

## Phase 3 — Role requirements and assessment

- Paste job descriptions; propose requirements using a curated alias dictionary.
- Review exact excerpts, edit importance, explicitly confirm requirements, explicitly attach evidence.
- Basic first slice ships with phases 1–2 to exercise the full workflow.
- Remaining: manually add/edit/remove requirements, job-description revisions, immutable assessment snapshots and rule versions, handling conflicting requirements, and broader vocabulary.
- Done when earlier assessments survive later edits and ambiguous input remains reviewable.

## Phase 4 — Preparation planning

- First slice: create a task for a requirement, acceptance criteria, mark done/reopen.
- Remaining: priorities, effort estimates, due dates, edit/delete operations, cross-role gap grouping.
- Done when users can prioritize a feasible plan; task completion must never invent evidence.

## Phase 5 — Release quality

- API tests for ownership and invalid associations; domain tests for ambiguous matches.
- MongoDB integration verification, real-browser QA, production session checks, accessibility, export/delete account data, responsive layout, deployment, sample data, README and walkthrough.
- Done when the complete journey works against MongoDB and documented release checks pass.

## Phase 6 — Optional enhancements

- GitHub public imports and text-based PDF input moved into the core studio scope above.
- Optional AI proposals/rewriting, supported additional platform integrations, and email reminders remain future work. Never infer proficiency merely from a repository URL.

## Planning estimates

One developer, AI assistance, 15 focused hours/week, basic React/JavaScript familiarity. MVP: 45–70 hours (3–5 weeks). Portfolio-ready total: 95–145 hours (7–10 weeks), including MVP, excluding optional features. These are estimates, not measured benchmarks.

## GitHub delivery

Public repository: https://github.com/LakshmiHasini/JobFit-Lab. Component branches are merged into main. CI remains a template in `docs/github-actions-template.yml` because the current GitHub login lacks workflow-upload permission. Enabling hosted CI is pending authorized workflow access.

## Scope and verification tracking

Update README after implementation with checks actually run, phase status, and remaining limitations. Development data and sessions survive restarts in private local storage; MongoDB mode is required for production multiuser use. Do not deploy demo mode publicly.

## Resume score v2 delivery

Implemented a Cake-inspired workflow with an independent six-category JobFit score, prioritized feedback, safe fix preview/apply/undo, direct file input, and owner-scoped saved scan snapshots. Keyword coverage stays separate from the overall score. See docs/RESUME_SCORING.md. AI rewriting and visual layout evaluation remain pending. All 26 tests and the browser score/history/fix workflow passed.

## No-resume creation delivery

Implemented a project-based resume builder with user-selected flagship projects, optional STAR context/outcomes, required personal action descriptions, profile/JD-based ordering, factual confirmation, separate saved drafts, editing, ATS integration, and TXT/print-PDF export. Empty profile resume/GitHub fields are now accepted; manual projects can feed preparation without GitHub import. Explicit profile adoption preserves prior resume text and updates the target role/JD. See docs/RESUME_BUILDER.md. All 32 tests passed; the browser generated and reloaded a separate draft while preserving the existing profile resume.

## ATS suggestion approval flow

Implemented individual accept/reject controls, exact changed-line previews, reasons, rubric score/category effects, editable truthful content suggestions, factual confirmation, change logging, undo, and stale-replacement protection. Existing resumes are preserved until an explicit draft save. All 38 tests and the browser accept/reject/undo/confirmation checks passed. Approval decisions remain in-session; saved scans retain resume snapshots. No external AI rewriting was introduced.
