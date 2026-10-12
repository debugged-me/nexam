# NEXAM — Feature Roadmap and Codebase Comparison Specification

**Document type:** Product requirements / codebase audit reference  
**Version:** 1.0  
**Prepared:** 2026-10-12  
**Scope:** NEXAM assessment preparation, physical exam production, mobile OMR checking, synchronization, and analytics  
**Implementation state:** **UNVERIFIED** — this document is not an inventory of completed features.

> **Read this first:** The items below are proposed capabilities to *compare against the existing codebase*. Do not interpret their inclusion as proof that NEXAM does or does not implement them. Source code, tests, configuration, schema, and a reproducible workflow are required to verify a status. **Do not implement changes while performing the audit.**

## 1. Product definition and non-negotiable scope

NEXAM is an **AI-assisted, paper-based examination preparation and evaluation system**. It helps authorized school personnel prepare assessment materials, create examinations and answer keys, print them, evaluate physically completed answer sheets via a **mobile OMR scanning workflow**, synchronize checked results to the web system, and review results and analytics.

**Actual student examination model:** Students take examinations **on paper**, not in an NEXAM online exam-taking interface. A mobile app performs or assists with answer-sheet scanning; the user believes results may already synchronize to the web system, but that behavior **must be verified in code and a working test**.

**Known technology boundary:** React frontend and Node.js backend. The mobile application's framework, database technology, runtime and exact API contract must be discovered from the repository(s); do not assume React Native, Flutter, Expo or a particular ORM/database. **Do not introduce PHP/CodeIgniter references: NEXAM is separate from SRMS.**

### 1.1 Intended lifecycle

1. Maintain syllabus, reference materials, subjects and learning outcomes.
2. Prepare and validate a Table of Specifications (TOS).
3. Generate, validate, revise and approve questions.
4. Assemble, version, format, export and print the exam and corresponding answer sheets.
5. Students answer the **printed** examination.
6. Authorized users scan completed answer sheets with a mobile device.
7. Correct and synchronize validated scan results to the web platform.
8. Review item analysis, learning outcome performance, reports and improvements.

### 1.2 Excluded unless scope explicitly changes

- Student-facing online exam participation or submission.
- Student answer autosave and online session recovery.
- Online exam timers, live proctoring, browser lockdown or webcam monitoring.
- Adaptive online testing based on live student responses.
- Online-exam cheating detection.

Do not recommend or create these simply because similarly named features exist in other exam platforms.

## 2. Feature status classification

Apply these statuses consistently. Do **not** assign status based only on a matching filename, route, UI label or menu item.

| Status | Meaning | Minimum verification |
|---|---|---|
| `IMPLEMENTED` | End-to-end user workflow is present and functional. | UI/entry point + relevant service/API + persistence/output + test or reproducible flow. |
| `PARTIAL` | Some behavior exists but the complete intended workflow or key safeguards are absent. | Cite working pieces, precisely list gaps and how they affect a user. |
| `MISSING` | Sufficiently inspected, accessible codebase has no matching functionality. | State inspection coverage, searches performed and why evidence supports absence. |
| `NEEDS_IMPROVEMENT` | Functional workflow exists, but quality, reliability, security or usability needs work. | Demonstrate flaw/limitation and identify targeted remedy. |
| `NOT_VERIFIABLE` | Relevant mobile repo, integration, environment, schema or runtime evidence is unavailable. | Identify exactly what is unavailable and what test would resolve it. |
| `OUT_OF_SCOPE` | Feature is intentionally excluded from NEXAM's paper-based mission. | Explain scope mismatch. |

**Default for all features in this file: `NOT_YET_AUDITED`.** The agent replaces this in the results report after inspection; do not edit this specification to force a conclusion.

## 3. Prioritization principles

- **P0 — Integrity-critical:** Prevent incorrect scoring, unsynchronized results, duplicate imports or irreversible mistakes in printed/scanned exams.
- **P1 — Core workflow:** Materially improves preparing, checking or analyzing real examinations.
- **P2 — Operational enhancement:** Adds productivity, review or reporting benefits after core reliability.
- **P3 — Optional/integration:** Advanced or third-party capabilities requiring separate feasibility and cost analysis.

Priority describes **importance if a gap is found**, not proof that the feature is missing. Priorities should be reconsidered against real code, users and operational constraints.

## 4. Master feature inventory (33 comparison targets)

Use feature IDs (`F01`–`F33`) as stable references throughout codebase search, findings and future implementation tickets. All status values start **NOT_YET_AUDITED**.

| ID | Phase | Feature | Gap priority | Status |
|---|---|---|---|---|
| F01 | 1 — Preparation & AI | Learning Material Management | P1 | NOT_YET_AUDITED |
| F02 | 1 — Preparation & AI | Smart TOS Generator and Validator | P1 | NOT_YET_AUDITED |
| F03 | 1 — Preparation & AI | AI Question Generator | P1 | NOT_YET_AUDITED |
| F04 | 1 — Preparation & AI | AI Question Quality Checker | P1 | NOT_YET_AUDITED |
| F05 | 1 — Preparation & AI | Question Similarity Detector | P2 | NOT_YET_AUDITED |
| F06 | 1 — Preparation & AI | Difficulty & Bloom's Level Analyzer | P1 | NOT_YET_AUDITED |
| F07 | 1 — Preparation & AI | Smart Question Bank | P1 | NOT_YET_AUDITED |
| F08 | 1 — Preparation & AI | AI Question Regenerator | P2 | NOT_YET_AUDITED |
| F09 | 2 — Production | Examination Versioning | P1 | NOT_YET_AUDITED |
| F10 | 2 — Production | Examination Approval Workflow | P2 | NOT_YET_AUDITED |
| F11 | 2 — Production | Smart Exam Formatting and Printing | P1 | NOT_YET_AUDITED |
| F12 | 2 — Production | Exam Set Generator (A/B/C) | P2 | NOT_YET_AUDITED |
| F13 | 2 — Production | Printable OMR Answer Sheet Generator | P0 | NOT_YET_AUDITED |
| F14 | 2 — Production | Bulk Examination Export | P2 | NOT_YET_AUDITED |
| F15 | 3 — Mobile OMR | Mobile Answer-Sheet Scanner | P0 | NOT_YET_AUDITED |
| F16 | 3 — Mobile OMR | Result Synchronization to Web | P0 | NOT_YET_AUDITED |
| F17 | 3 — Mobile OMR | OMR Confidence / Ambiguity Detection | P1 | NOT_YET_AUDITED |
| F18 | 3 — Mobile OMR | Manual Scan Verification and Correction | P0 | NOT_YET_AUDITED |
| F19 | 3 — Mobile OMR | Batch Scan Summary | P2 | NOT_YET_AUDITED |
| F20 | 3 — Mobile OMR | Scan and Correction Audit Trail | P1 | NOT_YET_AUDITED |
| F21 | 4 — Analytics | Automated Item Analysis | P1 | NOT_YET_AUDITED |
| F22 | 4 — Analytics | Learning Outcome Analysis | P1 | NOT_YET_AUDITED |
| F23 | 4 — Analytics | AI Performance Insights | P2 | NOT_YET_AUDITED |
| F24 | 4 — Analytics | Comparative Examination Analytics | P2 | NOT_YET_AUDITED |
| F25 | 4 — Analytics | Student Performance Reports | P1 | NOT_YET_AUDITED |
| F26 | 4 — Analytics | Advanced Report Export | P1 | NOT_YET_AUDITED |
| F27 | 5 — Productivity | Help-Activated Interactive System Guide | P2 | NOT_YET_AUDITED |
| F28 | 5 — Productivity | Global Smart Search | P2 | NOT_YET_AUDITED |
| F29 | 5 — Productivity | Notification Center | P2 | NOT_YET_AUDITED |
| F30 | 5 — Productivity | Bulk Question Import | P2 | NOT_YET_AUDITED |
| F31 | 5 — Productivity | Collaborative Exam Preparation | P3 | NOT_YET_AUDITED |
| F32 | 5 — Productivity | System-Wide Audit Trail | P1 | NOT_YET_AUDITED |
| F33 | 5 — Productivity | LMS/Moodle Interoperability | P3 | NOT_YET_AUDITED |

## 5. Acceptance criteria and verification targets

The following are **target behaviors to check**, not assertions that any component exists.

### Phase 1 — Examination preparation and AI

**F01 — Learning Material Management** (`P1`)
- Authorized instructor can manage the materials, syllabi, subjects/topics and learning outcomes actually supported by the system.
- Uploaded materials are validated, scoped to authorized users and traceable when used for generation.
- **Inspect:** material upload forms, storage handlers, extraction services, data models, authorization and reference associations.

**F02 — Smart TOS Generator and Validator** (`P1`)
- Can create/edit a TOS from approved learning outcomes and coverage settings.
- Distribution totals, item counts, cognitive levels and resulting blueprint are internally consistent; warns about mismatches.
- **Inspect:** TOS screens and calculation methods, stored distributions, tests, export/printing linkage.

**F03 — AI Question Generator** (`P1`)
- Generates questions only from clearly defined scope/materials and preserves the relationship to topics/outcomes when supported.
- Shows editable drafts and requires instructor confirmation before use; errors can be recovered.
- **Inspect:** AI invocation, prompts, source retrieval, output validation, draft workflow and cost/failure handling.

**F04 — AI Question Quality Checker** (`P1`)
- Flags ambiguity, unclear stems, weak distractors, contradictory or duplicate choices, and possible answer-key problems.
- Provides instructor-reviewable suggestions, not unreviewed automatic changes to approved questions.
- **Inspect:** validation services, AI review endpoints, moderation/review UI and revision persistence.

**F05 — Question Similarity Detector** (`P2`)
- Detects exact and near-duplicate question wording; differentiates useful coverage overlap from duplicates.
- Explains similarity findings and permits instructor review without silently deleting questions.
- **Inspect:** question repository search, normalization, embeddings or similarity logic, duplicate warnings.

**F06 — Difficulty & Bloom's Level Analyzer** (`P1`)
- Classifies suggested Bloom's level and **estimated** complexity for instructor review.
- Does not present AI-estimated difficulty as empirical student-response difficulty (see F21).
- **Inspect:** classification prompts/rules, TOS mapping, UI labels and override logic.

**F07 — Smart Question Bank** (`P1`)
- Supports search, filtering, tagging and reuse by subject, topic, exam, outcome and difficulty where metadata exists.
- Enforces ownership/authorization and prevents unintended edits to finalized examination versions.
- **Inspect:** question CRUD, filters, database relations, reuse/version semantics and permission checks.

**F08 — AI Question Regenerator** (`P2`)
- Produces alternatives for a selected question while preserving specified learning outcome and cognitive demand.
- Allows comparison and instructor selection; original and approved versions are preserved.
- **Inspect:** regenerate actions, generation prompts, diff/review screen and version history.

### Phase 2 — Examination production and printing

**F09 — Examination Versioning** (`P1`)
- Keeps a stable, identifiable revision of examination content and answer keys at the time of printing/scanning.
- Tracks material edits after finalization and prevents silent score changes due to revised answer keys.
- **Inspect:** version identifiers, immutable snapshots, exam lifecycle, key linkage and migrations.

**F10 — Examination Approval Workflow** (`P2`)
- Supports explicit draft/review/approval/finalization states if required by the institution.
- Applies authorization checks to transitions and records approver identity and timestamp.
- **Inspect:** statuses, permissions, review UI, APIs and audit entries.

**F11 — Smart Exam Formatting and Printing** (`P1`)
- Produces readable, consistently paginated print output with headers, instructions, numbering and answer-key alignment.
- Print/PDF output is checked for clipping, page breaks, paper size, images, and different-length questions.
- **Inspect:** rendering templates, CSS print styles, PDF/export code and sample outputs.

**F12 — Exam Set Generator (A/B/C)** (`P2`)
- Generates distinct approved versions with a verifiable question/choice mapping and matching answer keys.
- For each set, printed exam, answer sheet and scanner metadata stay synchronized; does not mix scores between sets.
- **Inspect:** shuffling logic, deterministic IDs, key-generation and OMR set detection.

**F13 — Printable OMR Answer Sheet Generator** (`P0`)
- Produces answer sheets physically compatible with the mobile scanner, correct item count, answer format and exam/version ID.
- Provides reliable linking to the right student/exam/set where such identifiers exist.
- **Inspect:** OMR templates, QR/barcode/marker generation (if any), scanner template assumptions and printed samples.

**F14 — Bulk Examination Export** (`P2`)
- Exports requested print materials (exam variants, answer keys, answer sheets) in a traceable package.
- Applies authorization and excludes unauthorized/private content from shared exports.
- **Inspect:** multi-file exports, bundling, naming, permissions and print options.

### Phase 3 — Mobile OMR checking and web synchronization

> **Critical uncertainty:** The user believes mobile scanning and result reflection in the web system may already work. **Verify, do not rebuild by default.** If the mobile code is outside the inspected repository, record `NOT_VERIFIABLE` for that side and inspect existing web endpoints/persistence separately.

**F15 — Mobile Answer-Sheet Scanner** (`P0`)
- Correctly identifies the intended sheet/exam/set and extracts candidate markings from **physical** answer sheets.
- Handles camera quality and invalid/unreadable scans without silently assigning incorrect marks or scores.
- **Inspect:** mobile camera/OMR pipeline, local processing, answer mapping, fixtures and real-sheet test records.

**F16 — Result Synchronization to Web** (`P0`)
- Syncs scan results with the correct exam, version, student and institution/class context, as applicable.
- Handles failed requests, offline/online retries, duplicates and idempotency; reports whether a scan is pending, failed or confirmed.
- **Inspect:** mobile API client and queue, auth/session, Node API controllers/services, persistence/schema, dedup keys and web reports.

**F17 — OMR Confidence / Ambiguity Detection** (`P1`)
- Identifies uncertain marks (e.g., faint, multiple, erased, obscured) for review instead of confidently scoring everything.
- Makes the scan image/region and uncertainty reason accessible to authorized reviewers when feasible.
- **Inspect:** score/confidence algorithm, thresholds, image retention policy and validation UI.

**F18 — Manual Scan Verification and Correction** (`P0`)
- Allows an authorized person to review and correct ambiguous results with an explicit save/confirm action.
- Prevents duplicate overwrites, logs the original vs corrected response and recomputes affected scores safely.
- **Inspect:** correction UI and endpoint, validation, audit event, score recomputation and concurrency safeguards.

**F19 — Batch Scan Summary** (`P2`)
- Shows counts and actionable lists for scanned, synced, pending, invalid and rejected sheets.
- Supports investigating individual failures without exposing unrelated student records.
- **Inspect:** mobile scan queues, batch state, API counts, dashboard and reports.

**F20 — Scan and Correction Audit Trail** (`P1`)
- Tracks scan time, scanner user/device identifiers **when justified**, sync attempts and authorized corrections.
- Stores only necessary data and supports historical review without accidental exposure of student data.
- **Inspect:** audit models/events, data minimization, role permissions and retention rules.

### Phase 4 — Performance analytics and reporting

**F21 — Automated Item Analysis** (`P1`)
- Calculates per-item statistics **from actual scanned response data**, with clearly defined scoring assumptions.
- Difficulty index (proportion correct), discrimination indices and distractor statistics handle missing responses and small sample sizes responsibly.
- **Inspect:** formula implementation, key mapping, sample filters, aggregate tables and tests with known expected results.

**F22 — Learning Outcome Analysis** (`P1`)
- Correctly maps examined questions to the intended outcomes/TOS categories and aggregates achieved results.
- Distinguishes outcomes that have insufficient evidence/too few assessed items.
- **Inspect:** question-outcome linking, joins, chart calculations and report explanations.

**F23 — AI Performance Insights** (`P2`)
- Converts verified metrics into readable suggestions; differentiates measured patterns from AI interpretations.
- Uses only authorized, appropriately minimized student information; instructor can inspect source statistics.
- **Inspect:** analysis prompts and payloads, controls on PII, UI provenance and generated report handling.

**F24 — Comparative Examination Analytics** (`P2`)
- Compares appropriately matched exams, sections or periods and labels comparisons accurately.
- Warns when comparisons are invalid due to different exams, scoring rubrics or small samples.
- **Inspect:** report filters, cohort selection, metrics definitions and chart logic.

**F25 — Student Performance Reports** (`P1`)
- Produces accurate individual reports based on verified scan results, with appropriate student identity and assessment context.
- Prevents unauthorized access to another student's results and supports correction/recalculation.
- **Inspect:** student report handlers, record-level authorization, report templates and audit linkage.

**F26 — Advanced Report Export** (`P1`)
- Exports accurate exam scores, item analysis, outcomes and printable summaries using formats the current system supports.
- Ensures filters, totals, access rights and personally identifiable information carry over correctly to export.
- **Inspect:** PDF/Excel/CSV modules, printing, permissions, sample report parity.

### Phase 5 — System-wide productivity and operations

**F27 — Help-Activated Interactive System Guide** (`P2`)
- Authorized user starts a guide deliberately using **Help**; it should not force a first-login tour.
- Highlights actual React controls/screens and explains real workflows; steps are role-aware, keyboard accessible, skippable and resilient to layout changes.
- **Inspect:** help menu, tour library/dependencies, role-specific screen definitions and accessibility.

**F28 — Global Smart Search** (`P2`)
- Searches permitted subjects, materials, questions, examinations and relevant records from a consistent UI.
- Respects server-side authorization; search results cannot reveal records outside access scope.
- **Inspect:** indexing/search APIs, query scopes, React navigation and result authorization.

**F29 — Notification Center** (`P2`)
- Shows actionable events (e.g., reviews, scan-sync failures, completed checking) only where real workflows require them.
- Avoids duplicated messages and implements read/unread or resolution state if supported.
- **Inspect:** notification events, persistence, UI and user scoping.

**F30 — Bulk Question Import** (`P2`)
- Imports supported files with preview, validation, clear error messages and duplicate checks.
- Preserves correct answers, options, topics and special characters; does not silently drop invalid rows.
- **Inspect:** import parsers, upload endpoints, mapping previews and validation tests.

**F31 — Collaborative Exam Preparation** (`P3`)
- Supports authorized users drafting/reviewing shared exam materials with ownership and conflict handling.
- Prevents one user's changes from silently replacing another user's approved work.
- **Inspect:** shared access models, locks/revisions, workflow screens and permission checks.

**F32 — System-Wide Audit Trail** (`P1`)
- Records consequential edits, approvals, examination finalization, exports and result corrections with actor and timestamp.
- Restricts access and avoids logging secrets or unnecessary sensitive student information.
- **Inspect:** middleware/hooks, audit models, admin views, retention and integrity measures.

**F33 — LMS/Moodle Interoperability** (`P3`)
- **Optional:** imports/exports relevant exam metadata or results only when there is a concrete institution integration requirement.
- Verify supported standards/API contracts and access controls before selecting an integration approach.
- **Inspect:** existing connectors, import/export adapters, credentials handling and compatibility tests.

## 6. Required codebase inspection procedure

1. **Inventory repository layout:** Inspect package files, build scripts, workspace boundaries, README and deployment configuration. Identify the React app, Node services, database/schema/migrations, mobile code (if present), tests, queues, exports and AI providers **without guessing**.
2. **Build actual workflow map:** Trace an instructor creating an exam, linking an answer key, printing the exam/answer sheet, scanning a physical sheet in mobile, syncing its result, and viewing the report. Note actual UI routes and APIs.
3. **Trace data identity end to end:** Confirm how exam ID, exam version/set, question order, answer key, subject/class, student identifier, sheet ID and scan result map to one another. Use only verified fields; report missing links explicitly.
4. **Audit each F01–F33:** Search all plausible names/synonyms; inspect frontend components, API, services, data persistence, mobile client, tests and real user flow. A screen by itself is insufficient proof of end-to-end implementation.
5. **Classify with evidence:** Assign status, confidence (`HIGH`/`MEDIUM`/`LOW`), file paths and meaningful functions/routes (with line numbers if available), relevant schema, tests and gaps.
6. **Validate OMR synchronization first:** Distinguish scanning, local result storage, network upload, backend confirmation and web display. Test retry/duplicate behavior where safe and a test environment exists.
7. **Rank only real gaps:** Give P0 integrity issues precedence, then user-impacting improvements. Identify dependencies, risk and estimated complexity (`S`/`M`/`L`) qualitatively.
8. **Report findings without implementation:** Create `docs/NEXAM_FEATURE_AUDIT_RESULTS.md` following the accompanying template. Do not edit application code, schema, configuration or migrations until the user separately requests implementation.

### Safe inspection and privacy rules

- Never use real student records in screenshots, generated examples, prompts, exported fixtures or public logs unless properly authorized and minimized.
- Do not upload entire source repositories or student data to an AI service when local inspection will suffice.
- Review role/record-level authorization, upload handling, idempotent sync, auditability, secure storage and correct key/version mapping.
- For database modifications, first demonstrate the need with evidence, explain migration/backward compatibility and obtain implementation authorization.
- Preserve functioning workflows; recommend additive, test-backed changes.
- If code is inaccessible, use `NOT_VERIFIABLE`, not `MISSING`.

## 7. Minimum end-to-end test cases to request or inspect

| Test ID | Scenario | Expected evidence |
|---|---|---|
| T01 | Generate exam from material + TOS | Questions align with saved blueprint and can be instructor-reviewed. |
| T02 | Edit final exam after answer-sheet creation | Version/answer-key consistency is protected or a clear limitation documented. |
| T03 | Print exam/OMR sheet with differing question counts | Scan template and exam ID/item count remain compatible. |
| T04 | Scan clear, correctly marked answer sheet | Correct extracted answers and score against the intended answer key. |
| T05 | Scan faint/multiple/erased response | Flag for review or clearly document actual existing error handling. |
| T06 | Lose connectivity before/during sync | No data loss; visible retry/pending state if offline capability exists. |
| T07 | Upload same scan twice / retry after timeout | No duplicate or silently overwritten results; idempotency verified. |
| T08 | Scan exam Set B using Set A key | System prevents wrong-key scoring or warns/requires explicit resolution. |
| T09 | Correct one ambiguous answer | Authorized correction updates result and creates audit evidence. |
| T10 | Recompute item analysis from known fixture | Verified expected item metrics and correct handling of blanks. |
| T11 | Access another user's/student's records | Unauthorized access is blocked server-side. |
| T12 | Export filtered report | Export matches displayed filters, scoring and authorization. |

These are requested audit scenarios; **do not state that they pass unless tests have run**.

## 8. Deliverables expected from the IDE agent

Create a separate report at `docs/NEXAM_FEATURE_AUDIT_RESULTS.md` with:

1. Actual architecture discovered, repositories inspected and inspection limitations.
2. Reconstructed workflow diagram from real code (not this specification alone).
3. A **33-feature evidence matrix** keyed by F01–F33, with status and supporting code references.
4. A dedicated **mobile OMR ↔ Node API ↔ web report** trace including authentication, answer keys, sync status, retry and duplicate handling.
5. Existing strengths that should be preserved.
6. Confirmed gaps/defects with minimal, testable remedies and dependencies.
7. A recommended ordered implementation backlog **excluding features already working satisfactorily**.
8. Open questions requiring a runtime test or access to a missing repo, clearly distinguished from confirmed defects.

## 9. Source-of-truth precedence

1. Reproducible behavior in a safe test environment + test assertions.
2. Current application source code and runtime configuration.
3. Current schema, migrations and API contracts.
4. Existing project documentation and feature flags.
5. This file as an **intent/acceptance-criteria reference only**.

When findings conflict, note the discrepancy with evidence. **Never manufacture file paths, table names, endpoints, implemented features, scan algorithms or technology choices.**
