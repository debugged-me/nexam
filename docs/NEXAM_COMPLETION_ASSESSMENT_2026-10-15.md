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

The implementation is substantial and its current automated test suites pass. However, the system should not yet be declared complete because two correctness gaps remain and the full workflow has not been acceptance-tested with representative live data and physical OMR sheets.

## Requirements Comparison

| Requirement from the specification | Status | Current evidence | Remaining work |
|---|---|---|---|
| Faculty authentication and protected access | Implemented | JWT authentication, ownership checks, and instructor-scoped API routes | Production access-control review remains necessary |
| PDF/DOCX syllabus upload | Implemented | File validation, protected storage, extraction jobs, and syllabus classification | Test with final representative institutional syllabi |
| Extract topics, instructional hours, and learning outcomes | Implemented | Syllabus blueprint preparation and validation services | Confirm output with final live AI providers and multiple syllabus formats |
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
| Questions strictly grounded in uploaded materials | **Not compliant** | Grounded generation exists, but general-knowledge generation is enabled by default when lesson evidence is insufficient | Disable or remove the knowledge fallback for thesis-compliant operation |
| All stored data encrypted and restricted appropriately | Partially implemented | Uploaded files and student PII have application-level encryption; production startup requires security declarations | Verify encrypted database/storage volumes, HTTPS, DB TLS, backups, retention, and deployment access |
| Stable performance as data grows | Not verified | Modular API, worker, database, and vector-index architecture exists | Execute concurrency, queue, database, and large-dataset load tests |
| Philippine Data Privacy Act compliance | Not fully verifiable from source code | PII protection and access controls exist | Complete deployment, policy, retention, consent, incident-response, and DPO review |

## Completion Blockers

### 1. General-knowledge questions can bypass the strict RAG requirement

The specification states that questions must be based only on instructor-uploaded course materials. The current generation flow first attempts material-grounded generation, but when lesson evidence cannot fill a TOS cell, it can generate questions from the model's general knowledge.

Current behavior:

- `api/src/worker/handlers/generate.js` calls lesson-only retrieval first.
- If the requested count is not reached, `knowledge_fallback_enabled` defaults to enabled.
- These questions are labelled as knowledge-based and require instructor confirmation, but they are still not grounded in uploaded material.

Required correction:

- Disable the knowledge fallback by default for thesis-compliant operation.
- Preferably remove it from the exam-generation path entirely, or place it behind an explicitly non-compliant experimental mode.
- Leave unsupported TOS cells unfilled and show the exact missing material coverage to the instructor.

### 2. Printed examination content is not fully snapshotted

Generated exam sets preserve their question IDs and ordering, including archived prior set versions. However, scanning still loads the current answer, options, and type from the live `questions` table.

Risk:

- An instructor prints an examination and answer key.
- The underlying approved question is edited afterward.
- A scanned sheet can then be scored using the edited answer instead of the answer printed for that set.

Required correction:

- Store a snapshot of the question stem, type, options, answer, topic, and Bloom level in each generated exam-set item.
- Generate PDFs and score OMR responses from that immutable snapshot.
- Warn or require a new print-run version when a source question changes.

## Additional Product Requirement Still Pending

A previously requested workflow asks one syllabus scan to preserve every detected period and present separate blueprint results for Prelim, Midterm, Pre-Final, and Finals. The current worker preserves schedule metadata but creates one TOS record per generation job. Separate period-specific results from one scan are therefore still pending.

This is an additional product requirement. The attached thesis specification itself only explicitly requires generation of an initial syllabus-driven TOS blueprint.

## Verification Already Performed

The following checks were executed against the local project on October 15, 2026:

| Check | Result |
|---|---|
| API automated tests | **124 passed, 0 failed** |
| Web automated tests | **34 passed, 0 failed** |
| Flutter/mobile automated tests | **11 passed, 0 failed** |
| Flutter static analysis | **Passed, no issues found** |
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

An active instructor password was temporarily replaced to verify the actual login route and protected endpoints. The original password hash was restored immediately after the checks. No credential change remains.

## What Was Not Tested

The successful automated checks do not establish all acceptance and production requirements. The following remain unverified:

- A complete populated syllabus → TOS → generation → approval → exam → printed OMR → analytics lifecycle.
- Live AI output using the final production Gemini, Groq, or Ollama configuration.
- Current rendered-browser behavior and responsive visual inspection.
- Visual correctness of representative exam, answer-key, TOS-report, and OMR PDFs.
- Importing the produced GIFT file into the institution's Moodle installation.
- Importing the produced XML/QTI file into the institution's Canvas installation.
- Physical OMR scanning on actual Android and iOS devices.
- Real-world lighting, glare, rotation, printer scaling, faint marks, erasures, and damaged sheets.
- Multi-user concurrency, large material collections, long job queues, and database/vector-index load.
- Hosted production deployment, HTTPS, database TLS, encrypted volumes, backup restoration, and disaster recovery.
- Formal Philippine Data Privacy Act compliance review and operational policies.

## Local Evaluation Data Limitation

At the time of this assessment, the local database contained:

| Record type | Count |
|---|---:|
| Subjects | 4 |
| Materials | 1 |
| TOS blueprints | 0 |
| Questions | 0 |
| Exams | 0 |
| Scan results | 0 |

Because no completed assessment lifecycle currently exists in the local database, the protected list and dashboard endpoints could be verified, but real workflow output could not be inspected end to end without creating evaluation records.

## Recommended Completion Order

1. Enforce uploaded-material-only generation and disable the general-knowledge fallback.
2. Snapshot question content and correct answers for every generated exam-set version.
3. Create a representative acceptance dataset and execute the entire workflow.
4. Visually verify all generated PDF outputs.
5. Import generated GIFT and Canvas XML files into the actual target LMS platforms.
6. Print and scan representative OMR sheets on multiple physical devices.
7. Run performance and concurrency tests with realistic volumes.
8. Verify the production security and privacy deployment checklist.
9. Complete separate all-period blueprint results if that remains an accepted product requirement.

## Final Assessment

Nexam is beyond a prototype: its principal modules are implemented, connected, and covered by passing automated tests. Nevertheless, **it is not yet ready to be declared fully complete or thesis-specification compliant**.

Completion should be declared only after the strict grounding mismatch and printed-answer snapshot risk are corrected and the remaining end-to-end, physical-device, LMS, performance, and production-security acceptance checks pass.
