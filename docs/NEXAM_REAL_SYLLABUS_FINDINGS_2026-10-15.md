# Real syllabus upload and pipeline findings

Date: October 15, 2026. Environment: local React app at `http://localhost:5173`, local Express API and MySQL. Source folder: `/Users/CLARk/Downloads/SYLLABUS`.

## Verdict

The supplied school syllabi produce usable **draft blueprints**, but this is not proof of a complete, accurate examination. Duplicate submission paths and misleading pipeline reporting were real problems and have been corrected locally. The syllabus-only question-generation check correctly refused to invent questions.

No existing materials, blueprints, questions, exams, or scans were deleted. No account password was changed during this evaluation. An ephemeral local test session was used for authenticated API/browser checks.

## Actual files and results

The folder contains three courses, each supplied as DOCX and PDF: six files, not six different courses. Both formats were inspected through the application's text extractor. The live upload/blueprint acceptance tests used the DOCX versions; the matching PDFs were not also uploaded as duplicate course materials. Full PDF-to-blueprint generation is **not yet verified** by this evaluation.

| School syllabus | Local material action | Topics | Prelim | Midterm | Pre-final | Final(s) | Stated course hours |
|---|---|---:|---:|---:|---:|---:|---:|
| The Contemporary World | Reused existing DOCX and checked its completed scan | 20 | 5 | 5 | 5 | 5 | 54 |
| DOIT College PE 2 – BCIT | Uploaded DOCX; extraction, indexing and live blueprint drafting completed | 10 | 3 | 2 | 2 | 3 | 36 |
| DOIT College PE 3 – BCIT | Uploaded DOCX; extraction, indexing and live blueprint drafting completed | 25 | 7 | 7 | 6 | 5 | 36 |

The school documents state weeks **1–5, 6–10, 11–14, and 15–18** for those periods. All four were retained. PE 3's nested game, dance, and badminton-skill items are represented as parent–sub-item topic names instead of adding an extra parent topic for the same content. Live blueprint jobs completed using the configured Gemini provider (`gemini-3.6-flash`).

Per-topic instructional hours are **proposed allocations of the stated course total**, not hours explicitly assigned to each topic by the school. Bloom percentages and the default 50-item target are also planning choices. The UI exposes these assumptions for instructor review; the three school blueprints remain drafts.

The existing default Bloom mix includes **Creating**, which the objective-question generator intentionally refuses. Review that allocation before finalization; use zero Creating weight and rebalance the supported levels when planning an objective-only exam. This is a planning-default limitation, not an extracted school requirement.

PE 2 contains similarly worded source items, “Comprehensive Exercise and Application” and “Comprehensive Exercise Drills & Application.” They were retained as distinct source entries. An instructor should decide whether the school intended different coverage; the application must not silently merge them.

## Why things looked duplicated

1. The screenshot itself shows two different materials: a YouTube item and a syllabus. The YouTube item was left untouched.
2. The existing job history showed three scans of the same Contemporary World material. Upload extraction could automatically queue a scan, while each manual **Generate blueprint** click independently queued another. Some older results were already absent when inspected; no historical cleanup was performed.
3. Uploading identical file bytes again previously created another material and another processing chain. Renaming the same file did not prevent this.
4. Reading, indexing, and blueprint drafting are different processing tasks for **one** material. Their history entries are not themselves duplicate uploaded files.
5. A DOCX and a PDF of the same course are separate byte-level files. The new exact-file protection does not perform semantic cross-format merging. Upload one source version per course unless comparing versions intentionally.

## Corrections implemented

- **One shared scan queue:** automatic and manual scans now lock the same instructor-owned material. Matching content, destination blueprint and assessment scope reuse a queued/running job or its existing result. Changed content and deleted results can be scanned again.
- **Identical-file protection:** uploads compare a SHA-256 hash of decrypted original bytes within the same instructor, subject and syllabus classification. Concurrent requests serialize on the subject; renamed identical copies reuse the saved material. Legacy uploads acquire hashes when compared. Only the unused file from the current duplicate request is discarded.
- **Honest upload feedback:** the Materials page distinguishes new uploads, reused files and failures. Clicking Generate blueprint on an unchanged completed syllabus opens its existing blueprint.
- **Recorded pipeline tasks:** `/pipeline` now includes extraction, indexing, syllabus scans and question runs. Selection works, including fetching a linked task outside the recent-list window. Material-stage cards explicitly describe the latest recorded stages, not precise historical stage timings.
- **All-period result display:** a completed syllabus scan displays its topics grouped by every detected period/week range. It still produces one master TOS; it does not automatically create four independent finalized blueprints.
- **Correct counters:** drafted/reused **questions** are separate from covered/shortfall **cells**. Completed totals persist in job results and survive a refresh. A finished task is not labelled as proof of question accuracy.
- **Run-specific output:** new AI questions carry their generation job ID. Historical output streams do not indiscriminately include every later question from the same blueprint; older untagged rows use the run's time bounds.
- Removed simulated stage/pace claims and updated the guided-tour descriptions to match the recorded-work page.

## Tests actually performed

| Check | Observed result |
|---|---|
| Six source-file text extraction inspections | DOCX and PDF text readable; only DOCX received the full live upload/blueprint acceptance path |
| Live school DOCX scans | TCW 20 topics; PE 2 10; PE 3 25; all four periods retained |
| Concurrent repeated uploads | Two requests per school DOCX, including renamed copies: all six reused the correct existing material |
| Concurrent repeated blueprint requests | Two requests per syllabus: all six reused the existing blueprint/job |
| Duplicate-test database counts | Materials **4 → 4**, blueprints **3 → 3**, jobs **13 → 13**, before creating the separate refusal-test blueprint |
| Browser Generate blueprint action | Existing PE 3 blueprint opened, rather than creating a new one |
| Browser repeat upload | PE 2 returned HTTP 200, `reused: true`, existing material ID, and an already-uploaded message |
| Real syllabus-only generation | Worker completed: **0 new questions**, **1/1 cell processed**, **3 questions missing**, explicit missing-lesson reason |
| Reload completed generation result | The same zero/shortfall counters and explanation remained visible |
| Browser history selection | Switching from PE 3 to PE 2 displayed the correct 25/10-topic results |
| Direct-link fallback | With the recent-list response deliberately emptied, the linked PE 3 job still loaded its real authenticated detail and 25-topic result |
| Responsive rendered browser | 1440, 1024, 768 and 380px: no page horizontal overflow; tested mobile page controls at least 44px tall; no browser JavaScript or API errors during the tested flow |
| API automated suite | **126 passed, 0 failed** |
| Web automated suite | **39 passed, 0 failed** |
| Web production build | Passed; existing dependency eval/chunk-size warnings remain |
| Web lint | Passed with existing warnings |
| API JavaScript syntax | Passed for all 78 source/script files |
| Git diff integrity | Passed |

The refusal check used a clearly named, separate finalized blueprint, **TCW — Syllabus-only validation (2026-10-15)**, for three Remember questions on the first source topic. Its recorded reason is:

> No uploaded lesson material covers "Introduction to Contemporary World"; a syllabus plans coverage but does not contain answers.

This check validates the live worker's refusal path, not a successful live-provider question-writing/independent-review path. The latter still needs actual lessons, readings or slides.

## Records retained for your inspection

| Record | Local link |
|---|---|
| Contemporary World scan | [Open recorded scan](http://localhost:5173/pipeline?job=1f936aff-f312-4275-a069-4786e27bfbc8) |
| PE 2 scan | [Open recorded scan](http://localhost:5173/pipeline?job=79c954dd-5785-4f03-af21-a5d9e96a9a7e) |
| PE 3 scan | [Open recorded scan](http://localhost:5173/pipeline?job=deb83e79-cfaa-4ac3-9e8a-e1e28a03ee4d) |
| Syllabus-only refusal test | [Open recorded result](http://localhost:5173/pipeline?job=5bebb0e3-8bec-42db-b26a-3b99cb9db852) |

At the final local data check, this instructor had **4 subjects, 4 materials, 4 blueprints, 12 questions, 1 exam, 26 scan results, and 14 processing jobs**. The 12 questions were pre-existing manual TECH 1 questions, not output from the syllabus test. There are **zero** questions attached to the validation blueprint. Existing exam/scan records were not graded, altered, or used as evidence of real-device acceptance in this task.

The fourth blueprint is the explicitly named validation record above, not an accidental repeated school scan. Browser screenshots and the disposable QA script are available locally in `/tmp/nexam-syllabus-qa.zEN6JL/`; this temporary folder is not a deployment artifact.

## How to repeat the manual checks

1. Refresh the local app and open **How AI works**. Select PE 3's **Draft blueprint** task, or use its link above.
2. Confirm **25 topics**, four groups, and the printed source week ranges. Switch to PE 2 and check **10 topics**; switch to TCW and check **20**.
3. Open **Materials → Upload material**, choose **PE 2**, and upload `DOIT College PE 2- BCIT Syllabus.docx` again with its syllabus flag on. Expect “already uploaded,” no extra material, and no new processing chain. Keep the subject and syllabus flag the same for this check.
4. Click **Generate blueprint** for PE 3. Expect its existing blueprint to open. Its title should be “Physical Activities Toward Health and Fitness 3.”
5. Open the refusal-test result above. Expect **0 questions drafted**, **1 cell with a shortfall**, **1/1 cells processed**, and **3 questions still missing**. Refresh; the counts must remain.
6. For a positive question-generation test, upload the actual teaching lessons/readings into the matching subject as **non-syllabus** materials. Review topic coverage, hours and Bloom allocations, confirm the supporting source scope, and finalize the intended blueprint. Do not use the deliberately limited validation blueprint as the real course exam plan.
7. Generate a small batch, compare each saved answer and cited passage against the lesson itself, then review/approve. “Processed” or “Finished” alone is not an accuracy guarantee.

## Still not established

- Full PDF-to-blueprint parity, especially PDF table/list hierarchy.
- Semantic duplicate detection between different formats or edited versions of the same document.
- A positive factual question-generation and independent-review acceptance test using school lessons.
- Automatic independent per-period TOS records from one scan; grouped master results are now visible.
- Complete syllabus-to-approved-exam-to-physical-OMR acceptance, immutable printed-answer snapshots, target LMS imports, and production security/performance checks.

See [the updated completion assessment](NEXAM_COMPLETION_ASSESSMENT_2026-10-15.md) for the project-wide remaining work. These results are local, not proof of deployed production or physical-device correctness.
