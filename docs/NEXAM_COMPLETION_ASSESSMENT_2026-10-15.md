# Nexam Completion Assessment

**Assessment date:** October 15, 2026  
**Specification reviewed:** `/Users/CLARk/Downloads/NEXAM.pdf` (62 pages)  
**System reviewed:** React web application, Node.js/Express API, MySQL database, and Flutter mobile application  
**Verdict:** **Not finished yet**

## Executive Summary

Nexam implements most of the functional workflow described in the attached specification:

1. Upload a syllabus and supporting instructional materials.
2. Extract topics, instructional hours, and learning outcomes into a TOS blueprint.
3. Refine and finalize the TOS.
4. Generate objective questions by topic and Bloom's Taxonomy level.
5. Review, edit, similarity-check, and approve questions.
6. Assemble TOS-aligned examinations.
7. Produce Set A and Set B papers, answer keys, TOS reports, OMR sheets, and LMS exports.
8. Scan OMR sheets through the mobile application and synchronize scores and analytics.

The implementation is substantial and its current automated test suites pass. The strict uploaded-material grounding gap identified in the first assessment has now been fixed. However, the system should not yet be declared complete because the printed-exam snapshot risk remains and the full workflow has not been acceptance-tested with representative live data and physical OMR sheets.

**October 15 follow-up:** the three real school DOCX syllabi have now been checked, with live PE 2/PE 3 uploads and existing Contemporary World output verified. Repeated-upload/scan protection and pipeline reporting were corrected. See [Real syllabus findings and manual test steps](NEXAM_REAL_SYLLABUS_FINDINGS_2026-10-15.md). Current suites: **126 API / 39 web tests passed**; local rendered-browser checks passed. This does not remove the project-wide remaining acceptance work below.

**October 16 visual follow-up:** restored the connected-node flowchart console, charts and expand view while retaining all reporting/duplicate/grounding fixes. Removed the large title/Refresh row and condensed repeated text. Constraints, independent verification and run-specific current similarity status are visible; material scans do not claim question checks passed. The web suite now has **44 passing tests**. Local responsive browser, task-switching, modal, timestamp-replay, reduced-motion, post-generation similarity polling and API-failure display checks passed. This UI-only change does not resolve the remaining project-wide blockers.

## Requirements Comparison

| Requirement from the specification | Status | Current evidence | Remaining work |
|---|---|---|---|
| Faculty authentication and protected access | Implemented | JWT authentication, ownership checks, and instructor-scoped API routes | Production access-control review remains necessary |
| PDF/DOCX syllabus upload | Implemented, real DOCX path checked | Three supplied school DOCX syllabi checked; all six DOCX/PDF files text-extracted; identical-file uploads now reuse existing material | Full PDF blueprint acceptance remains pending; cross-format semantic deduplication is not implemented |
| Extract topics, instructional hours, and learning outcomes | Implemented, real DOCX output checked | TCW 20, PE 2 10, PE 3 25 topics, all four periods retained; course totals 54/36/36 hours; live Gemini blueprint scans completed | Instructor confirmation of proposed per-topic hours/Bloom defaults and full PDF parity |
| Upload documents, presentations, URLs, and video transcripts | Implemented | PDF, DOCX, PPTX, text, URL, and YouTube material paths exist | Validate difficult websites and caption availability |
| Instructor-adjustable TOS and Bloom distribution | Implemented | Editable TOS topics, weights, item allocation, and finalization | Complete acceptance testing with realistic blueprints |
| Show approved-question sufficiency per topic and Bloom level | Implemented | Exact topic-by-Bloom matrix and coverage-gap calculation | Verify with a populated live question bank |
| Mandatory question review, editing, and approval | Implemented | Draft-only AI output and explicit approval workflow | None identified in the core workflow |
| Semantic duplicate detection | Implemented | Similarity jobs, flags, review decisions, and approval gates | Validate thresholds against a larger institutional bank |
| Institution-wide approved question bank | Implemented | Approved, similarity-clean questions are available for controlled reuse | Confirm institutional privacy policy for shared questions |
| Generate Set A and Set B | Implemented | Two generated sets with separate stored orderings | Freeze the complete question content and answers per print run |
| Answer keys and TOS alignment reports | Implemented | PDF generation and exact alignment checks exist | Render and visually inspect final representative PDFs |
| Printable QR-linked OMR sheets | Implemented | Per-set QR identity and shared web/mobile sheet layout | Test actual printed sheets on representative phones and printers |
| Mobile OMR grading and web synchronization | Implemented, partially verified | Mobile scanner, correction flow, idempotent synchronization, and API scoring exist | Perform real-device field testing under glare, skew, shadows, and poor print quality |
| Individual scores, class summaries, and item analytics | Implemented | Scan result, exam analytics, item analysis, and attention views exist | Verify with a populated end-to-end dataset |
| GIFT export for Moodle | Implemented and unit-tested | GIFT generation and parsing tests pass | Import a generated file into the target Moodle installation |
| XML export for Canvas | Implemented and unit-tested | Canvas/QTI XML generation and parsing tests pass | Import a generated file into the target Canvas installation |
| Questions strictly grounded in uploaded materials | **Resolved October 15, 2026** | Uploaded lesson chunks only; historical general-knowledge drafts blocked. Real syllabus-only worker test saved 0 of 3 requested questions and reported missing lessons | Run a positive live-provider acceptance generation with actual teaching materials |
| All stored data encrypted and restricted appropriately | Partially implemented | Uploaded files and student PII have application-level encryption; production startup requires security declarations | Verify encrypted database/storage volumes, HTTPS, DB TLS, backups, retention, and deployment access |
| Stable performance as data grows | Not verified | Modular API, worker, database, and vector-index architecture exists | Execute concurrency, queue, database, and large-dataset load tests |
| Philippine Data Privacy Act compliance | Not fully verifiable from source code | PII protection and access controls exist | Complete deployment, policy, retention, consent, incident-response, and DPO review |

## Correctness Status

### Resolved: General-knowledge questions could bypass the strict RAG requirement

The specification states that questions must be based only on instructor-uploaded course materials. The previous generation flow first attempted material-grounded generation, but could fill an unsupported TOS cell from the model's general knowledge.

Correction implemented on October 15, 2026:

- Removed general-model-knowledge fallback generation from `api/src/worker/handlers/generate.js`.
- Unsupported TOS cells now stay unfilled and are reported through `failedSlots` with the missing material coverage.
- Added a central strict-grounding gate so historical knowledge-based AI drafts cannot be approved, reused, counted toward coverage, assembled into an exam, exported, or exposed in the shared institution bank.
- Removed the former instructor-confirmation approval path from the API and web review interfaces.
- Added a regression test proving that historical general-knowledge AI drafts are blocked.

Verification:

- API tests: **125 passed, 0 failed**.
- Web tests: **35 passed, 0 failed**.
- Web production build: **passed**.
- Web lint: **passed with pre-existing warnings only**.

### Remaining blocker: Printed examination content is not fully snapshotted

Generated exam sets preserve their question IDs and ordering, including archived prior set versions. However, scanning still loads the current answer, options, and type from the live `questions` table.

Risk:

- An instructor prints an examination and answer key.
- The underlying approved question is edited afterward.
- A scanned sheet can then be scored using the edited answer instead of the answer printed for that set.

Required correction:

- Store a snapshot of the question stem, type, options, answer, topic, and Bloom level in each generated exam-set item.
- Generate PDFs and score OMR responses from that immutable snapshot.
- Warn or require a new print-run version when a source question changes.

## Additional Product Requirement: Partially Completed

A previously requested workflow asks one syllabus scan to preserve every detected period and distinguish Prelim, Midterm, Pre-Final, and Finals. The updated pipeline now displays all four period groups from one completed scan, verified with the real school syllabi. The worker still creates one master TOS record per scan; automatically producing separate period-specific TOS records remains pending.

This is an additional product requirement. The attached thesis specification itself only explicitly requires generation of an initial syllabus-driven TOS blueprint.

## Verification Already Performed

The following checks were executed against the local project on October 15, 2026:

| Check | Result |
|---|---|
| API automated tests (latest follow-up) | **126 passed, 0 failed** |
| Web automated tests (latest follow-up) | **39 passed, 0 failed** |
| Flutter/mobile automated tests (earlier assessment; mobile unchanged) | **11 passed, 0 failed** |
| Flutter static analysis (earlier assessment; mobile unchanged) | **Passed, no issues found** |
| Web production build | **Passed** |
| Web lint | **Passed with existing warnings** |
| API health endpoint | **HTTP 200** |
| Instructor login | **HTTP 200** |
| Authenticated profile endpoint | **HTTP 200** |
| Authenticated dashboard endpoint | **HTTP 200** |
| Authenticated subjects endpoint | **HTTP 200** |
| Authenticated TOS endpoint | **HTTP 200** |
| Authenticated questions endpoint | **HTTP 200** |
| Authenticated exams endpoint | **HTTP 200** |
| Authenticated scans endpoint | **HTTP 200** |
| Git diff integrity check | **Passed** |
| Real syllabus duplicate submission checks | **Concurrent repeat uploads/scans reused existing records; counts unchanged** |
| Real syllabus-only question run | **Correct refusal: 0 drafted, 3 missing with explicit lesson-evidence reason** |
| Local browser: pipeline/material interactions | **Passed at 1440/1024/768/380px; counters survived reload; no page overflow or tested-flow API/JS errors** |

An active instructor password was temporarily replaced to verify the actual login route and protected endpoints. The original password hash was restored immediately after the checks. No credential change remains.

That password check belongs to the earlier assessment. The real-syllabus follow-up used an ephemeral local authenticated test session and did not alter any password.

## What Was Not Tested

The successful automated checks do not establish all acceptance and production requirements. The following remain unverified:

- A complete populated syllabus → TOS → generation → approval → exam → printed OMR → analytics lifecycle.
- Positive live-provider question-writing/independent-review output with actual school lessons. Local Gemini syllabus drafting and the live worker refusal path were verified, not production generation.
- Rendered-browser behavior outside the Materials/pipeline paths covered in the follow-up.
- Full PDF-to-blueprint parity; PDF text extraction alone is not full blueprint verification.
- Visual correctness of representative exam, answer-key, TOS-report, and OMR PDFs.
- Importing the produced GIFT file into the institution's Moodle installation.
- Importing the produced XML/QTI file into the institution's Canvas installation.
- Physical OMR scanning on actual Android and iOS devices.
- Real-world lighting, glare, rotation, printer scaling, faint marks, erasures, and damaged sheets.
- Multi-user concurrency, large material collections, long job queues, and database/vector-index load.
- Hosted production deployment, HTTPS, database TLS, encrypted volumes, backup restoration, and disaster recovery.
- Formal Philippine Data Privacy Act compliance review and operational policies.

## Local Evaluation Data Limitation

At the initial assessment, the local database contained:

| Record type | Count |
|---|---:|
| Subjects | 4 |
| Materials | 1 |
| TOS blueprints | 0 |
| Questions | 0 |
| Exams | 0 |
| Scan results | 0 |

That was an early snapshot, not the current data count. The latest instructor-scoped check found **4 subjects, 4 materials, 4 blueprints, 12 pre-existing manual questions, 1 exam, and 26 scan results**. Three blueprints are the school syllabus drafts; the fourth is a deliberately named syllabus-only validation blueprint, which produced no questions. Existing exam/scan rows were preserved and do not by themselves establish physical-device or full real-school lifecycle acceptance. The real-data additions and job links are documented in the follow-up report.

## Recommended Completion Order

1. Snapshot question content and correct answers for every generated exam-set version.
2. Create a representative acceptance dataset and execute the entire workflow.
3. Visually verify all generated PDF outputs.
4. Import generated GIFT and Canvas XML files into the actual target LMS platforms.
5. Print and scan representative OMR sheets on multiple physical devices.
6. Run performance and concurrency tests with realistic volumes.
7. Verify the production security and privacy deployment checklist.
8. Complete automatic separate per-period TOS records if required; all-period grouped results are now visible in the pipeline.

## Final Assessment

Nexam is beyond a prototype: its principal modules are implemented, connected, and covered by passing automated tests. The strict uploaded-material grounding mismatch is now resolved. Nevertheless, **it is not yet ready to be declared fully complete**.

Completion should be declared only after the printed-answer snapshot risk is corrected and the remaining end-to-end, physical-device, LMS, performance, and production-security acceptance checks pass.
