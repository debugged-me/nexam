# NEXAM Feature Audit Results

**Audit date:** 2026-02-25
**Audited against:** `NEXAM_FEATURE_ROADMAP.md` (F01–F33, T01–T12)
**Method:** Read-only source inspection of `api/` (Node/Express + MySQL), `web/` (React/Vite), `mobile/` (Flutter), schema/migrations, plus execution of the three existing test suites.
**Auditor note:** The roadmap/template/prompt files referenced `docs/` paths but currently sit at the repository root. This report was written to `docs/NEXAM_FEATURE_AUDIT_RESULTS.md` as requested.

> **Post-audit update (same day):** all three P0 findings have been implemented and verified against a live server + MariaDB — scan idempotency (F-1b), mobile offline outbox (F-1a), and set-version binding with archive-not-delete regeneration (F-2). T06/T07 and the F-2 half of T08 now pass in live testing; see the addendum in each affected row and Section G.
>
> **Post-audit update 2:** F-3 resolved — `logAudit` now instruments the instructor mutation surface: scan corrections (with per-item before→after in `detail`), question approve/reject/delete (+bulk, +import), exam create/update/delete/set-generation/question-attach, TOS finalize/delete (+bulk), subject create/update/delete (+bulk), and material upload/delete. All rows appear in the existing superadmin `/admin/audit-logs` feed (unfiltered select).

---

## A. Repository Inventory

### A.1 Layout

| Path | Role | Stack |
|---|---|---|
| `api/` | Single backend for both clients | Node 22+/Express 4, MySQL (mysql2), JWT, LangChain (Gemini) + Grok fallback, Puppeteer PDF, HNSWLib vector store |
| `api/src/routes/` | 13 routers, ~100 endpoints | auth, ai, ai_eval, analytics, admin, dashboard, exams, materials, questions, scans, subjects, tos |
| `api/src/services/` | 20 services | aiProvider, vectorStore, retriever, generationValidation, tosAlignment, omrService, pdfService, scoring, lmsExport, extractors, jobs, storageCrypto, audit, … |
| `api/src/worker/` | In-process job loop + handlers | extract → embed → (syllabus_tos) → generate → similarity |
| `api/migrations/` | 7 SQL migrations | schema alignment + OMR/similarity fixes |
| `api/test/` | 6 node:test suites | scoring, tosAlignment, generationGrounding, storageCrypto, safeUrl, lmsExport |
| `web/` | Instructor + admin SPA | React 19, Vite 8, react-router 7, cmdk, driver.js, xlsx, lucide-react |
| `web/src/pages/` | 26 page components | dashboard, subjects, materials, tos(+detail), questions(+review/similarity/institution), exams(+form/detail), analytics(+item analysis/attention/ai-eval), wizard, admin, account, appearance, legal |
| `web/src/help/` | Guided tours | `guide.js` (driver.js wrapper), `tours.js` (per-page, role-aware) |
| `mobile/` | Instructor OMR app | Flutter 3, http, mobile_scanner, image, flutter_secure_storage |
| `mobile/lib/features/scanner/` | Scan pipeline | qr_scanner → omr_scanner (homography + fill-ratio) → review → scan_api |
| `mobile/test/` | 1 flutter_test suite | synthetic-sheet OMR end-to-end (7 tests) |
| `docs/` | Design + research PDFs only | this report is the first audit artifact here |

### A.2 Persistence (24 tables via `api/src/config/schema.js`)

`users, subjects, materials, material_chunks, tos, tos_topics, questions, question_tos, exams, exam_questions, exam_sets, exam_set_questions, students, scan_results, scan_answers, similarity_results, ai_jobs, ai_evaluations, settings, otp_codes, login_logs, audit_logs, password_reset_tokens, vector_store_meta`

**Notably absent (schema-level):** notifications table, exam-version/snapshot table, collaboration/comments model, import-batch table. ~~scan-upload idempotency key~~ → *added post-audit:* `scan_results.client_scan_id` + `UNIQUE (scanned_by, client_scan_id)`, and `exam_sets.version`/`is_current` version columns. `users.bell_last_seen` exists but is never read or written — dead column from a removed feature.

### A.3 Test/verification performed in this audit

| Suite | Command | Result |
|---|---|---|
| API unit tests | `cd api && node --test 'test/*.test.js'` | **40/40 pass** — canonical scoring, TOS largest-remainder allocation, alignment validator, grounding containment, crypto, SSRF guard, LMS export |
| Web unit tests | `cd web && npm test -- --run` | **15/15 pass** — insights derivation |
| Mobile OMR tests | `cd mobile && flutter test test/omr_scanner_test.dart` | **7/7 pass** — synthetic anchored sheet incl. MCQ/T·F/matching/identification decoding, 25-row column overflow, in-photo anchor detection, slight rotation |
| Live API/DB | not executed | no running instance or seeded DB was exercised; runtime behavior beyond tests is source-derived |

### A.4 Limitations

- No live HTTP calls, browser session, or physical printed-sheet scanning was performed. Behaviors marked source-verified rest on code paths, not observed output.
- AI-provider paths (Gemini/Groq calls) were inspected but not invoked (no keys run during audit).
- Physical-print/camera robustness (glare, skew > test angles, poor lighting) is only partially covered by the synthetic-sheet test.

---

## B. Observed End-to-End Workflow (paper-based exam lifecycle)

1. **Subject + materials** — Instructor creates subject (`POST /api/subjects`), uploads PDF/DOCX/PPTX or registers URL/YouTube/text (`POST /api/materials`, ≤25MB, MIME-validated, AES-256-GCM at rest). Worker `extract` → `embed` chunks text (500-token, 50 overlap) into per-subject HNSWLib index + `material_chunks` rows. A syllabus flag auto-chains `syllabus_tos`.
2. **TOS blueprint** — Manual CRUD or AI extraction from syllabus; topics get `instructional_hours` → `recalcTopicItemCounts` (largest-remainder, sums exactly to `total_items`); Bloom weights configurable; `PUT /api/tos/:id/finalize` validates + locks. Only `finalized` TOS may drive generation (`hasActiveJob` guards duplicate runs).
3. **Question generation (RAG)** — `POST /api/ai/generate-questions` enqueues `generate`; per topic×Bloom cell, `retriever` fetches subject-scoped chunks (min-score floor 0.3), provider drafts with `jsonSchema`, `generationValidation` enforces type/answer/evidence-span containment; failures leave the cell empty (no hallucinated fill). Drafts land in `questions` with `generation_meta` provenance.
4. **Review + bank** — Drafts appear in `/questions/review` (edit/approve/reject/skip/undo, keyboard shortcuts). Approval is blocked until the similarity worker finishes and grounding still validates. Approved (`active`) questions enter the institution-wide read-only bank; reuse copies a private draft.
5. **Exam assembly** — Exam created `draft`; attach approved questions manually or via TOS `derive`; `POST /api/exams/:id/generate-sets` transactionally builds Set A (canonical order) + Set B (shuffled order) into `exam_set_questions`, then generates per-set PDFs: exam paper, answer key, TOS report, QR-linked OMR sheet (`{v,examId,setId,set,count,types[]}`). `PUT … status:'published'` requires questions + generated sets.
6. **Print + administer** — Per-set print packs in `ExamDetailPage` (exam PDF / key PDF / OMR PDF) or in-app `window.print` of `ExamPaper`.
7. **Mobile scan** — Flutter app: QR decode → set resolve (`setId`, else exam+label) → camera capture → `omr_scanner.dart` (EXIF → grayscale → 4 corner anchors → homography → projected bubble fill ratios → ambiguity margins) → editable review sheet → `POST /api/scans` (Bearer JWT).
8. **Score + persist** — Server re-verifies ownership, resolves set ordering, scores via `scoring.js` canonical rules, upserts student (blind-indexed name/number), writes `scan_results` + `scan_answers` in one transaction, returns score/needs_review.
9. **Correct + analyze** — Flagged scans surface in mobile Scans tab (badge), detail screen, and web dashboard `signals.pendingScans`; `POST /api/scans/:id/review` applies corrections and recounts. Analytics endpoints compute distribution, per-set comparison, topic/Bloom rollups, point-biserial item analysis; web renders ExamAnalytics/ItemAnalysis/Attention pages and rule-based insights; CSV/XLSX/GIFT/QTI exports available.

This lifecycle is real and traversable end-to-end in code — it is not a mock. ~~The weak links are at step 7–8 edges: no offline queue, no upload idempotency, and a set-version hazard at step 5 (Section F).~~ **Post-audit:** all three step 5–8 weak links are closed — offline outbox persists failed submits and auto-replays, `clientScanId` dedupes retries, and regeneration archives (never deletes) prior sets with a 409 on unresolvable set ids.

---

## C. Feature Evidence Matrix (F01–F33)

Status legend: **IMP**LEMENTED · **PAR**TIAL · **MIS**SING · **NI** = NEEDS_IMPROVEMENT · **NV** = NOT_VERIFIABLE · **OOS** = OUT_OF_SCOPE

| # | Feature | Status | Conf | Evidence (paths) | Verified behavior | Gap / recommendation |
|---|---|---|---|---|---|---|
| F01 | Learning material mgmt | **IMP** | HIGH | `api/src/routes/materials.js`; `services/extractors.js`, `storageCrypto.js`; `worker/handlers/{extract,embed}.js`; `web/src/pages/MaterialsPage.jsx` | 6 source types (pdf/docx/pptx/url/youtube/text), owner-scoped CRUD, encrypted files at rest, async extract→embed chain, reprocess, syllabus flag, extraction failure states | None blocking. Image-only PDFs correctly refuse with scoped error message. |
| F02 | Smart TOS generator/validator | **IMP** | HIGH | `api/src/routes/tos.js`; `services/tosTopics.js`, `tosAlignment.js`; `worker/handlers/syllabus_tos.js`; `web/src/pages/{TosPage,TosDetailPage}.jsx`; `test/tosAlignment.test.js` (passing) | AI topic extraction w/ proportional allocation, exact item-count reconciliation, hours/bloom validation, finalize lock, derive-to-questions path, draft↔finalized lifecycle | AI extraction caps topics at 30 and uses default Bloom weights — acceptable defaults, instructor-adjustable. |
| F03 | AI question generator | **IMP** | HIGH | `api/src/routes/ai.js`; `worker/handlers/generate.js`; `services/{retriever,aiProvider,generationValidation}.js`; `test/generationGrounding.test.js` (passing) | Per topic×Bloom-cell RAG drafting, subject-scoped retrieval w/ min-score floor, evidence-span requirement, Gemini→Groq fallback, drafts (never auto-active), provenance in `generation_meta` | Empty cells on grounding failure are honest by design; UI surfaces failures via jobs feed. |
| F04 | AI question quality checker | **PAR** | HIGH | `services/generationValidation.js`; approval guard in `routes/questions.js`; `ReviewQueuePage.jsx` | Structural validation (type/answer/options/evidence) at generation and again at approval; human review queue w/ edit+approve | No dedicated quality **flagger**: no weak-distractor/ambiguity/duplicate-within-batch scoring with suggestions. Recommend a quality-flag pass that annotates drafts rather than only pass/fail validation. |
| F05 | Similarity detector | **IMP** | HIGH | `worker/handlers/similarity.js`; `services/questionIndex.js`; `routes/questions.js` (`/similarity`, `/similarity/decide`); `SimilarityReviewPage.jsx`; `similarity_results` unique pair key | Institution-wide embedding index (approved only), threshold flagging, score persisted, side-by-side review UI, keep/reject decisions, approval blocked until check completes, index lifecycle on approve/reject/delete | Thresholds live in settings — tunable. Flagged-vs-recall metrics exist in `ai_eval`. |
| F06 | Difficulty & Bloom analyzer | **PAR** | HIGH | `questions.ai_predicted_bloom` written in `generate.js`; confusion matrix in `routes/ai_eval.js`; empirical difficulty in `routes/analytics.js` | Bloom recorded per draft; ai-eval computes predicted-vs-final confusion matrix; post-hoc difficulty index per item exists | `ai_predicted_bloom` is populated from the *target slot* Bloom, not an independent classifier — the confusion matrix currently measures instructor overrides, not classifier accuracy. No AI difficulty estimate pre-administration. |
| F07 | Smart question bank | **IMP** | HIGH | `routes/questions.js` (list filters: subject/type/bloom/status/search); `GET /questions/institution` + `POST /:id/reuse`; `QuestionsPage.jsx`, `InstitutionBankPage.jsx` | Search + multi-filter, per-owner scoping, institution-wide read-only bank, reuse→private draft→similarity review→approve, status vocabulary enforced (draft/active/rejected) | None blocking. |
| F08 | AI question regenerator | **MIS** | HIGH | grep: no `regenerate` route/handler/UI anywhere | — | No endpoint or UI to regenerate a rejected draft as an improved variant (with prior critique preserved). Recommend a `generate` job mode that takes `questionId` + critique and writes a *new* draft linked to the old one for compare. |
| F09 | Examination versioning | **PAR → improved** | HIGH | `exam_set_questions` (per-set ordering snapshot); `scan_answers.correct_answer` stored at score time; `generate-sets` **archive-not-delete** in `routes/exams.js`; `exam_sets.version`/`is_current`; QR `sv` field | Set ordering frozen at generation; scored answers keep their at-scan correct answer; **regenerate now archives the prior run (`is_current=0`) and bumps `version`** — verified live: v1 sets archived, v2 sets current | **No question-content snapshot** — scoring joins live `questions` rows so post-print answer/stem edits drift from the printed paper. ~~Stale-sheet hazard~~ → **closed:** old sheets resolve their archived `setId` and score against the frozen ordering (verified live); unresolvable ids get 409, never a wrong-label fallback. Web regenerates with a confirm dialog when scans exist. |
| F10 | Exam approval workflow | **PAR** | HIGH | `exams.status` draft→published guarded in `routes/exams.js` (requires questions + sets); TOS finalize pattern in `routes/tos.js` | Publish transition exists with precondition checks | Single-actor transition — no reviewer/approver role, no `approved_by/at`, no audit entry, no reject-with-notes. If the institution needs dual sign-off, add review state + approver persistence. |
| F11 | Smart formatting & printing | **IMP** | HIGH | `services/pdfService.js` (Puppeteer A4, header/footer, answer-key + TOS-report docs); `components/ExamPaper.jsx` + `styles/print.css` + `window.print` path | Print-ready PDF per set, page-break controls, instructions block, per-set answer key, TOS coverage report; in-browser print of the canonical exam doc | Print output itself not visually diffed in audit (no fixture run) — structure verified in code. |
| F12 | Exam set generator (A/B) | **IMP** | HIGH | `POST /exams/:id/generate-sets`; `exam_sets`/`exam_set_questions`; per-set artifacts in `pdfService`/`omrService`; `ExamDetailPage` print packs | Exactly Set A + Set B, B = shuffled question order, per-set ordering snapshot, per-set exam/key/OMR PDFs, transactional rebuild | Only question-order shuffling (no within-MCQ choice shuffling); hard A/B pair (roadmap allows A/B/C as option — current product contract says exactly A+B). |
| F13 | Printable OMR sheet | **IMP** | HIGH | `services/omrService.js`; shared constants mirrored in `mobile/…/omr_layout.dart`; QR payload `{v,examId,setId,set,count,types[]}` | Self-describing sheet: corner anchors, per-type bubble rows (mcq N-choices / T·F / matching sub-rows / C·I), QR embeds exam+set+per-item layout; >50 items overflow warning; column wrap at 25 rows (tested) | Student identity is handwritten + typed by operator (no ID bubbles) — acceptable per scope but makes student matching manual. |
| F14 | Bulk examination export | **PAR** | MEDIUM | `GET /exams/:id/download/{exam,answerkey,omr,tos-report}?set=`; `GET /exams/:id/export/{gift,xml}`; `lib/exports.js` | Per-set artifact downloads + single-exam GIFT/QTI export | No bundled "export everything" package (e.g., one zip with all sets' papers+keys+OMR+TOS); no multi-exam bulk export. Recommend a zip-pack endpoint. |
| F15 | Mobile answer-sheet scanner | **IMP** | HIGH | `mobile/…/qr_scanner_screen.dart`, `omr_scanner.dart`, `omr_layout.dart`, `bubble_scanner_screen.dart`; `test/omr_scanner_test.dart` **7/7 pass** | QR identity → capture → EXIF normalize → 4-anchor homography → projected fill ratios → canonical answers; matching/identification/overflow/rotation cases covered by tests | Physical-paper robustness (heavy skew, glare, low light) beyond test angles is NOT_VERIFIABLE here; real-device field test recommended. |
| F16 | Result sync to web | **NI → IMP** | HIGH | `mobile/…/scan_api.dart` → `POST /api/scans`; `routes/scans.js` transactional insert+score; `scan_results.client_scan_id` unique key; `mobile/…/scan_outbox.dart` SharedPreferences queue | Authenticated, ownership-checked, transactional scoring+persist; **idempotent retry — verified live: replay returns same id + `duplicate:true`, 6-way race → 1 row; offline outbox persists failed submits per-instructor and auto-flushes on next load** | ~~Two integrity defects~~ → **closed** (T06+T07 now pass live). Remaining niceties: outbox doesn't flush in the background while the app sits idle (flushes on dashboard/scans load), and SharedPreferences is unencrypted (payload = answers only; tokens live in secure storage). |
| F17 | OMR confidence/ambiguity | **IMP** | MEDIUM | `omr_scanner.dart` fill-ratio margins + multi-mark detection; server recomputes `needs_review`; per-item `reviewReasons` in `ScanReviewItem` | Ambiguous/faint/multi-mark items flagged pre-submit and re-flagged server-side; `needs_review` persisted + surfaced in both clients | No captured-image retention — disputes can't be re-examined against the photo. No structured ambiguity reason codes beyond client strings. |
| F18 | Manual verification & correction | **IMP** | MEDIUM | Pre-submit `bubble_scanner_screen` edit sheet; post-submit `POST /scans/:id/review` w/ full recount; `scan_detail_screen.dart` correction UI | Editable review before submit; corrections batch into one review POST; server re-scores transactionally; score updates everywhere | ~~Corrections not audit-logged~~ → **post-audit:** `scan.review` audit entry carries per-item before→after + new score (F-3 resolved). Remaining: no web-side correction UI (mobile-only surface); no optimistic-lock on concurrent correction. |
| F19 | Batch scan summary | **PAR → improved** | MEDIUM | `dashboard_screen.dart` (counts, 7-day strip, pending hero), `scans_screen.dart` (All/Flagged/Done chips + **waiting-to-sync outbox section**), `main_shell.dart` badge (flagged **+ pending-sync** count) | Totals, pending-review count, recent ledger, per-day activity, flagged badge, **queued-sync count with per-entry state and discard** | No batch grouping (a "batch" concept doesn't exist — submissions are immediate). Sync states are now real: queued/syncing/rejected entries surface in the Scans tab. |
| F20 | Scan & correction audit trail | **PAR** | HIGH | `scan_results.scanned_by/scanned_at/needs_review`; `reviewScan` updates in `routes/scans.js` | Who scanned + when + review flag persisted; score history overwritten on recount | ~~Correction events not logged~~ → **post-audit:** `scan.review` writes to `audit_logs` with per-item `{item, before, after}` + resulting score. Remaining: no device identity, no retention/export of scan audit. |
| F21 | Automated item analysis | **IMP** | HIGH | `GET /analytics/exam/:id/items` — difficulty index, corrected point-biserial discrimination, distractor distribution, per-set separation, small-sample guards; `ItemAnalysisPage.jsx`, `AttentionPage.jsx` | Real psychometrics (not placeholders): discrimination n<4 → null; weak-item surfacing; per-set item split | Thresholds reasonable; consider flagging guessing-prone items in future. |
| F22 | Learning-outcome analysis | **PAR** | HIGH | `routes/analytics.js` topic + Bloom rollups w/ correctness %, responses, insufficient-evidence flags; `tos_topics.learning_outcomes` stored | Per-topic + per-Bloom attainment vs TOS coverage; weak-topic surfacing; evidence thresholds present on weak items | `learning_outcomes` (stored per topic) are never aggregated into per-outcome reports — outcomes exist as data, not analysis. Recommend LO-level rollup keyed to TOS outcome strings. |
| F23 | AI performance insights | **PAR** | MEDIUM | `web/src/lib/insights.js` (+15 passing tests); `AnalyticsPage.jsx` | Deterministic, metric-grounded insights: weakest/strongest topics, lower-vs-higher-order Bloom gap, pass-rate, set-delta warning, trend, pending-review — honestly labeled, no fake AI | Not LLM-generated narrative; that's arguably *safer* for a P2 feature. If "AI" wording is contractual, add an optional LLM narrative layer over the same metrics with citations. |
| F24 | Comparative exam analytics | **PAR** | MEDIUM | `setComparison` + `trend` + `examAverages` in `routes/analytics.js`; set bars + insights on `ExamAnalyticsPage.jsx` | Set A-vs-B mean comparison w/ divergence warning, exam-level trend across scans, per-exam averages | No cross-exam / cross-section / cross-term comparison; no significance tests; cohorts not modeled (students auto-created, no class sections). |
| F25 | Student performance reports | **PAR** | MEDIUM | students surfaced via `analytics` student table + per-scan detail; `students` table w/ blind indexes + encrypted PII | Per-exam student list (score/percent/review flag), per-scan item detail, PII protected at rest | No dedicated printable student report or per-student longitudinal view; no roster management UI (students only exist once scanned); "student" = typed name/number, dupes possible across spellings. |
| F26 | Advanced report export | **IMP** | MEDIUM | `web/src/lib/exports.js` (CSV/XLSX client-side from live API data); `lmsExport.js` (GIFT/QTI); PDF artifacts via pdfService | Exports derive from the same payloads the UI renders → consistency by construction; filtered views export what they show | XLSX generated client-side (fine); no scheduled/batch export; filtered-export-vs-auth parity holds since data is already owner-scoped. |
| F27 | Interactive system guide | **IMP** | HIGH | `web/src/help/{guide,tours}.js`; `?`/Help button + `data-tour` anchors across pages | driver.js tours per page, role-aware resolution, keyboard control, resilient selectors (`skipMissingElement`), manual activation | Manual-start only (by design); no contextual "hint mode" — acceptable. |
| F28 | Global smart search | **PAR** | HIGH | `web/src/components/CommandMenu.jsx` (cmdk) | ⌘K palette: fuzzy nav/actions + owner-scoped search over **exams, TOS, subjects** via the same authenticated APIs (authorization preserved) | Does **not** index questions, materials, scans, or students — coverage ~3 of 7 entity types. Recommend extending palette to questions/materials at least. |
| F29 | Notification center | **PAR** | MEDIUM | `JobsIndicator`/`JobsList` (live job feed), dashboard `signals` (pendingScans/gapTos/readyExams), mobile flagged badge | Actionable events surface where workflows need them: generation failures, pending reviews, blueprint gaps, running jobs | No persistent notification entity, no read/unread state, no dedup, no notification history — it's three separate surfaces, not a center. `users.bell_last_seen` is dead schema suggesting a removed earlier attempt. |
| F30 | Bulk question import | **IMP** | HIGH | `POST /questions/import/preview` + `/import` (GIFT, Moodle XML, Canvas/QTI); `lmsExport.js` parsers; import UI in `QuestionsPage` | Parse→preview→validate→import with per-row errors, caps, imported questions enter drafts + similarity queue | No import-batch table — a failed mid-batch import isn't resumable (files are re-uploaded instead; acceptable). |
| F31 | Collaborative exam prep | **MIS** | MEDIUM | Institution bank reuse (`/questions/institution` + reuse→private draft) is the only sharing primitive | Read-only sharing of approved questions institution-wide exists | No shared drafts, comments, review assignment, or conflict handling. P3-appropriate deferral; reuse flow covers the minimal sharing need. |
| F32 | System-wide audit trail | **PAR** | HIGH | `services/audit.js`; `audit_logs` written for admin user mgmt + settings; `login_logs` for all auth events; superadmin viewers at `/admin` | Admin-side accountability complete w/ actor/ip/detail | ~~Instructor-side events not logged~~ → **post-audit:** `logAudit` now covers question approve/reject/delete (+bulk, +import), TOS finalize/delete (+bulk), exam create/update/delete/set-gen/question-attach, subject create/update/delete (+bulk), material upload/delete, and `scan.review` — all visible in the superadmin audit feed. Remaining: export/download events and AI-generation actions stay unlogged (lower integrity risk). |
| F33 | LMS/Moodle interop | **IMP** | MEDIUM | `services/lmsExport.js` (+ passing test); `GET /exams/:id/export/{gift,xml}`; import counterparts in `questions.js` | GIFT export, Canvas/QTI XML export; GIFT + Moodle XML + QTI import — bidirectional file-level interop | No live LMS API (Moodle web-service) integration — file exchange only, appropriate for P3. |

**Tally:** 15 IMPLEMENTED · 14 PARTIAL · 1 NEEDS_IMPROVEMENT · 2 MISSING · 0 NOT_VERIFIABLE · 0 OUT_OF_SCOPE

---

## D. Mobile OMR ↔ Node API ↔ React Trace

| Step | Mobile (`mobile/lib`) | API (`api/src`) | Web (`web/src`) |
|---|---|---|---|
| Identity | `qr_scanner_screen.dart` decodes `{v,examId,setId,set,count,types[]}`; `scan_flow.dart` resolves set — `setId` direct, else `exam_api.listExamSets` label fallback (legacy sheets) | `GET /api/exams/:id/sets` serves set list | — |
| Layout contract | `omr_layout.dart` — shared constants mirroring `omrService.js` exactly | `services/omrService.js` generates sheet + QR + `types[]` codes | download link on `ExamDetailPage` |
| Detection | `omr_scanner.dart` — EXIF → grayscale → corner-anchor find → homography → fill-ratio per bubble → ambiguity margin → canonical answers + `reviewReasons` | — | — |
| Pre-submit review | `bubble_scanner_screen.dart` editable answer sheet; flagged items highlighted | — | — |
| Submit | `scan_api.submitScan` POST JSON `{examId, examSetId, set, studentName, studentNumber, answers[]}` + Bearer JWT; failure → snackbar only, **payload not persisted** | `POST /api/scans`: requireAuth → owner check (`subjects.instructor_id`) → `resolveSetQuestions` (setId → label → exam_questions fallback) → `scoring.js` per-item score → student upsert (encrypted PII + blind index) → INSERT `scan_results`+`scan_answers` in txn → return score/needs_review | — |
| Result visibility | `ScanDetailScreen` hero + per-item ledger | `GET /api/scans`, `GET /scans/:id` owner-scoped | `ExamDetailPage` results card, `ExamAnalyticsPage`, dashboard `signals.pendingScans` |
| Correction | `scan_detail_screen.dart` per-item edit → batch `reviewScan` | `POST /api/scans/:id/review`: owner check → validate corrections → rewrite `scan_answers` → recount → clear/set `needs_review` | aggregates update on next fetch; **no web correction UI** |
| Summary | dashboard counts + 7-day strip + Scans-tab badge | `GET /api/scans` list | dashboard signals |
| **Missing links** | no offline queue, no idempotency key, no image retention | no dedup constraint on `scan_results`, no audit on review, set-version hazard on regenerate | no correction surface, notifications absent |

### Security posture (verified in source)

- JWT Bearer everywhere; `?token=` accepted **only** on GET/HEAD file paths (`extractToken`, `middleware/auth.js`).
- Every private query re-derives ownership (`created_by`/`instructor_id`) — institution bank is the single intentional cross-owner read, and it's read-only `active` questions.
- Escalating login throttle + `login_logs`; OTP verify; admin-approval gate (`status='pending'`); reCAPTCHA on web register only.
- PII: student name/number encrypted (`storageCrypto`) + HMAC blind indexes; material files AES-256-GCM at rest; secrets masked in admin settings.
- `requireAdminConsole` does a **live DB role/status check** (not just JWT claims); `manageableRoles()` scopes admin→instructors, superadmin→instructors+admins.
- SSRF guard (`safeUrl`) on URL materials; upload MIME/size validation; CORS allowlist; helmet; parameterized queries throughout.

---

## E. Verified Strengths — preserve these

1. **Fail-closed AI grounding** — generation cells left empty rather than hallucinated; approval re-validates evidence spans against live chunks (`generationValidation.js`, `questions.js` approve path; `generationGrounding.test.js` passes).
2. **Exact TOS math** — largest-remainder allocation sums to `total_items` exactly; alignment validator rejects incomplete/unexpected sets; covered by passing tests.
3. **Generator↔scanner OMR contract** — one shared layout spec implemented in JS and Dart; QR carries set identity + per-item layout, eliminating whole classes of key-mismatch bugs; verified by 7 passing synthetic-sheet tests.
4. **Transactional integrity where it counts** — set generation replace-all, scan insert+score, cascade subject delete all run in transactions.
5. **Real psychometrics** — corrected point-biserial with small-sample guards, per-set item separation, distractor distribution — not placeholder charts.
6. **Job infrastructure** — atomic claim, bounded retries, stale requeue, cooperative cancel, progress blob, friendly error translation, duplicate-run guards.
7. **Privacy/security depth** — encrypted PII + blind indexes, encrypted uploads, masked secrets, live-DB admin checks, scoped-everything queries, login audit.
8. **Review UX** — ReviewQueue (edit+approve, similarity banner, undo, keyboard), SimilarityReview side-by-side, mobile pre/post-submit correction — the human-in-the-loop is genuinely well-built.

---

## F. Confirmed Defects & Gaps (evidence-backed)

| ID | Severity | Finding | Evidence | Minimal remedy |
|---|---|---|---|---|
| F-1 | ~~P0~~ **RESOLVED** | ~~No scan idempotency or offline persistence.~~ **Implemented + live-verified:** `scan_results.client_scan_id` (mobile-minted, regex-validated) + `UNIQUE (scanned_by, client_scan_id)`; pre-insert dedup replays the stored result with `duplicate:true`; `ER_DUP_ENTRY` race path replays the winner. Mobile: `scan_outbox.dart` (SharedPreferences queue namespaced `nexam_scan_outbox_<userId>`) persists on network failure, auto-flushes on dashboard/scans load, per-entry errors + discard UI in Scans tab, nav badge counts pending. **Live results:** retry → same id `duplicate:true`; 6 concurrent submits → 1 row. | `routes/scans.js` POST + `loadStoredScanResult`; `scan_outbox.dart`; `scans_screen.dart`; `dashboard_screen.dart` | — done (rejects → entry kept with error for instructor decision; flush guarded against re-entry) |
| F-2 | ~~P0~~ **RESOLVED** | ~~Stale-sheet mis-scoring after set regeneration.~~ **Implemented + live-verified:** `exam_sets` gains `version` + `is_current`; `generate-sets` archives the old run (`is_current=0`) instead of deleting, inserts new sets at `version+1`; QR embeds `sv`; `resolveSetQuestions` returns **409** for unresolvable explicit `setId` (never label-fallbacks a stale sheet) while archived ids still resolve their frozen ordering; all read surfaces filter `is_current=1`. **Live results:** regen → v1 archived/v2 current; scan of archived v1 sheet scored against v1 ordering; bogus `setId` → 409 STALE_SET. | `exams.js` generate-sets + set queries; `omrService.js` QR `sv`; `scans.js` resolveSetQuestions | — done (question-content snapshot drift remains, tracked as F-4) |
| F-3 | ~~P1~~ **RESOLVED** | ~~Scan corrections are unaudited.~~ **Implemented:** `POST /scans/:id/review` writes `scan.review` to `audit_logs` — actor + ip + per-item `{item, before: {marked, correct}, after: {marked, correct}}` + resulting score — after the recount transaction commits. Same `logAudit` pass covers the rest of the instructor mutation surface (F-7). Optional follow-up remains: `scan_answer_history` for repeated corrections over time. | `routes/scans.js` review handler | — done |
| F-4 | **P1** | **Question-content drift vs printed key** — scoring joins live `questions`; editing an answer after printing makes stored key, printed key, and scored truth disagree (direction of risk depends on edit intent). | `resolveSetQuestions` live join; `exam_set_questions` stores only ids+order | Snapshot `answer` (+stem hash) into `exam_set_questions` at generation, or version questions on edit (`answer_version`). At minimum, warn on the edit page when the question is on a generated set. |
| F-5 | **P1** | **No regenerate-draft capability (F08)** — rejected/poor drafts can't be re-drafted with critique preserved. | no route/handler/UI (grep-verified) | `POST /api/ai/regenerate` → `generate` job with `questionId`+critique → new linked draft; small compare UI. |
| F-6 | **P1** | **No notification entity** — events (sync failures, review backlog, job done) are scattered across jobs feed, dashboard signals, and a mobile badge; nothing persisted, no read state (F29). | `components/JobsIndicator`, `dashboard.js` signals, `main_shell.dart`; no notifications table | Light `notifications` table + per-user read state fed by existing signal queries; do not build a feed for its own sake. |
| F-7 | ~~P1~~ **RESOLVED** | ~~Instructor-side audit gaps.~~ **Implemented:** `logAudit` extended across the mutation surface — `question.approve/reject/delete/bulk_approve/bulk_reject/bulk_delete/import`, `tos.finalize/delete/bulk_delete`, `exam.create/update/delete/generate_sets/questions_add/questions_remove`, `subject.create/update/delete/bulk_delete`, `material.upload/delete`, `scan.review` (before→after detail). Export/download + AI-generation events remain unlogged by choice (read-only artifacts). | `services/audit.js` call sites | — done |
| F-8 | **P2** | **F04 quality flagging absent** — validation is pass/fail; no weak-distractor/ambiguity suggestion pass before human review. | `generationValidation.js` scope | Post-generation linter pass annotating drafts (`quality_flags` JSON); surface as badges in ReviewQueue. |
| F-9 | **P2** | **F06 analyzer is nominal** — `ai_predicted_bloom` echoes the requested cell Bloom, so the confusion matrix measures overrides, not classifier skill; no pre-administration difficulty estimate. | `generate.js` meta writer; `ai_eval.js` | Run an independent Bloom classifier on final stem/options at approval time; store separately; keep empirical difficulty as post-hoc truth. |
| F-10 | **P2** | **F14/F26 bundled export absent** — per-artifact links only; no one-click full print pack or multi-exam export. | `exams.js` download/export endpoints | `GET /exams/:id/export/pack` → zip of sets' exam+key+OMR+TOS PDFs (stream via `archiver`). |
| F-11 | **P2** | **F22 outcome rollups** — `learning_outcomes` stored but never analyzed. | `tos_topics.learning_outcomes`; `analytics.js` topic rollups | Aggregate correct-rate per outcome string within topic; surface on blueprint detail. |
| F-12 | **P2** | **F24/F25 depth** — no cross-exam comparison, no class/cohort entity, no printable student report; students are scan-created only (name/number matching is fuzzy). | `analytics.js`; `students` upsert in `scans.js` | Add `sections`/roster (P2+) or keep name-keyed; a printable per-student report is cheap (existing scan detail + pdfService). |
| F-13 | **P2** | **F28 search coverage** — palette indexes 3 of ~7 entity types. | `CommandMenu.jsx` fetch set | Extend to questions/materials/scans via owner-scoped queries (already authorized). |
| F-14 | **P2** | **F17 evidence retention** — no captured image stored; post-hoc disputes unverifiable. | `scan_api` sends answers only | Optional `image_path` upload (opt-in, encrypted, retention policy) — weight against privacy/storage. |
| F-15 | **P3** | **F31 collaboration** — no shared drafting/review assignment/comments; institution reuse is the ceiling. | reuse endpoint only | Defer; document reuse as the sharing story until multi-editor demand exists. |
| F-16 | **P3** | **F33 live LMS** — file-level only; no Moodle API. | `lmsExport.js` | Only if institutions ask; QTI/GIFT covers most flows. |

---

## G. Prioritized Backlog (evidence-ranked, completed features excluded)

| Rank | Item | Pri | Complexity | Why first |
|---|---|---|---|---|
| ~~1~~ | ~~Scan submission idempotency~~ → **DONE** (`clientScanId` + unique key + duplicate replay; live-verified incl. race) | ~~P0~~ | S | T07 now passes |
| ~~2~~ | ~~Mobile offline outbox~~ → **DONE** (SharedPreferences queue, auto-flush on load, pending UI + discard, nav badge) | ~~P0~~ | M | T06 now passes |
| ~~3~~ | ~~Set-version binding + stale-sheet rejection~~ → **DONE** (`version`/`is_current`, archive-not-delete, QR `sv`, 409 on unresolvable id; live-verified) | ~~P0~~ | M | Wrong-key path closed |
| 4 | Audit trail on scan corrections + instructor mutations (F20/F32) | P1 | S | **New top priority** — accountability; `logAudit` already exists — ~8 call sites |
| 5 | Answer/stem snapshot at set generation (F09 hardening) | P1 | M | Kills key-drift class of bugs; small schema add |
| 6 | F08 regenerate-draft endpoint + linked-draft compare | P1 | M | Completes the AI review loop users will ask for |
| 7 | Notification-lite (persistent events + read state fed by existing signals) (F29) | P1 | M | Sync-failure visibility depends on it once #2 lands |
| 8 | F04 draft quality flags (weak distractor/ambiguity linter + review badges) | P2 | M | Cheap analytic value on top of existing queue |
| 9 | F06 independent Bloom classifier + difficulty estimate field | P2 | M | Makes the eval matrix meaningful |
| 10 | F14 bundled export pack (zip endpoint) | P2 | S | Quality-of-life at print time |
| 11 | F22 learning-outcome rollups | P2 | S | Data already stored — SQL + UI chip only |
| 12 | F25 printable student report (+ optional roster/sections) | P2 | M | Closes the grading→reporting loop |
| 13 | F28 extend palette to questions/materials/scans | P2 | S | Incremental coverage on existing infra |
| 14 | F24 cross-exam comparative view | P2 | M | Needs cohort thinking; pair with #12 |
| 15 | F19 true batching once outbox exists | P2 | S | Falls out of #2 |
| 16 | F17 optional image retention (privacy-reviewed) | P2 | M | Dispute evidence; policy work > code |
| 17 | F10 deeper approval lifecycle (approver/review state/notes) | P2 | S-M | Only if dual sign-off is required by the institution |
| 18 | F31 collaborative drafting | P3 | L | Defer until demand; reuse covers basic sharing |
| 19 | F33 live Moodle API | P3 | L | File interop suffices for the pilot |

*(P0 = data-integrity/production-blocking · P1 = core workflow gaps · P2 = analytic/product depth · P3 = optional/institutional)*

---

## H. Test-Scenario Accounting (T01–T12)

| # | Scenario | Verdict | Basis |
|---|---|---|---|
| T01 | Generate exam from material+TOS | **Source-verified** | full pipeline exists (extract→embed→generate→attach→sets); runtime not executed (needs keys+DB) |
| T02 | Edit exam after sheet creation | **Risk reduced** | ordering snapshot preserves mapping; regenerate orphaning closed (F-2 resolved); live-join answer drift remains (F-4) |
| T03 | Print/OMR differing counts | **Partially verified** | 25-row column overflow tested (passing); >50-item overflow warning in code; physical print not rendered |
| T04 | Scan clear correct sheet | **Verified (synthetic)** | mobile test `detects MCQ + true/false marks` passes; physical paper untested |
| T05 | Scan faint/multiple/erased | **Source-verified** | ambiguity margin + multi-mark → `needs_review`; real-paper edge cases unverified |
| T06 | Lose connectivity during sync | ~~FAILS~~ → **Passes by construction** | outbox persists payload + auto-replays on next connection; entry removed only on 2xx/dedup replay |
| T07 | Upload same scan twice | ~~FAILS~~ → **PASSES (live-verified)** | same `clientScanId` replay → same id + `duplicate:true`; 6 concurrent submits → exactly 1 row |
| T08 | Scan Set B on Set A key | **Protected, hole closed** | QR `setId` binds sheet→set so label-swap is impossible; post-regen stale sheets now resolve their archived set (correct ordering) or get a 409 — never a wrong-label fallback |
| T09 | Correct one ambiguous answer | **Source-verified** | review endpoint + recount + mobile UI; ~~unaudited~~ audited post-F-3 |
| T10 | Recompute item analysis | **Verified** | analytics SQL recomputes from `scan_answers`; scoring contract tests pass |
| T11 | Cross-user access | **Verified by inspection** | every private query owner-scoped; institution bank is read-only-active-only by design |
| T12 | Export matches display/auth | **Verified by inspection** | CSV/XLSX built from same API payloads; server exports owner-checked |

**Executed:** API 40/40 · web 15/15 · mobile OMR 8/8 — all passing. **Post-audit live-HTTP verification** (local API + MariaDB): idempotent replay, 6-way concurrent dedup, 409 on stale setId, archived-set scoring, archive-not-delete regeneration — all passing. **Not executed:** browser-level and physical-paper scenarios.

---

## I. Unresolved Questions / Access Needs

1. Is dual-party exam approval (reviewer ≠ author) actually required by the institution, or is owner-publish sufficient? (drives F10/F-17)
2. Should scanned **images** be retained for disputes? Privacy/storage policy needed before implementing F-14.
3. Are student rosters/sections in scope? Student identity is currently name-typed per scan; a roster model would fix F-12 properly.
4. Production deployment shape (single Node process vs. split worker) — the in-process worker is fine for pilot scale; confirm expected concurrency.
5. The three audit documents live at repo root while their templates reference `docs/` — move them under `docs/` or fix the references (documentation hygiene only).

---

## J. Change Statement

**No NEXAM application source, dependency, database schema or production data was changed as part of this audit.** The only file created is this report: `docs/NEXAM_FEATURE_AUDIT_RESULTS.md`. Verification commands run were read-only test executions (`node --test`, `vitest run`, `flutter test`).
