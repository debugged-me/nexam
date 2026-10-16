/**
 * tours.js — guided-tour definitions, one per real route.
 *
 * CONTENT MODEL: every tour explains the SYSTEM — what this part of nexam
 * does and why it exists in the pipeline — not widget anatomy. Each page
 * tour opens with a popover-only narrative card ("what this screen is"),
 * then highlights only the controls that carry the workflow.
 *
 * Steps point at `data-tour` attributes on real controls, never positional or
 * nth-child selectors. A step whose element is absent or hidden (empty
 * states, conditional panels, the mobile-only rail button, the desktop-only
 * sidebar) is filtered when the tour starts, so every page degrades
 * gracefully instead of erroring.
 *
 * Roles follow the auth vocabulary: 'instructor' for the workspace,
 * 'admin'/'superadmin' for the console.
 *
 * Order matters: more specific patterns must precede the parameter routes
 * that would also match them (`/exams/new` before `/exams/:id`, the
 * `/questions/*` subpages before `/questions`).
 */
import { matchPath } from 'react-router-dom';

const INSTRUCTOR = ['instructor'];
const ADMIN = ['admin', 'superadmin'];
const ANYONE = ['instructor', 'admin', 'superadmin'];

/* ---- Shared shell steps ---------------------------------------------------
   `minWidth`/`maxWidth` gate desktop-vs-mobile variants of the same idea:
   the sidebar is hidden below 992px, so narrow screens get the menu button
   or a narrative card instead. */
const NAV_STEP = {
  sel: '[data-tour="shell-nav"]', minWidth: 992, side: 'right', align: 'start',
  title: 'The rail is the pipeline',
  description: 'The sidebar is ordered like an assessment’s life: subject → sources → blueprint → bank → exam → results. Follow it top to bottom and you follow a real exam.',
};
const NAV_STEP_MOBILE = {
  sel: '[data-tour="shell-menu"]', maxWidth: 991, side: 'right',
  title: 'The rail is the pipeline',
  description: 'Open the menu: Subjects → Materials → Blueprints → Question bank → Exams — the same path every exam takes.',
};
const PIPELINE_CARD_MOBILE = {
  maxWidth: 991,
  title: 'One pipeline, six stages',
  description: 'Subjects → Materials → Blueprints → Question bank → Exams → Analytics. nexam walks source documents to graded answer sheets in that order — nothing skips a stage.',
};
export const TOURS = [
  {
    id: 'dashboard', name: 'How nexam works', patterns: ['/dashboard'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Welcome to nexam',
        description: 'nexam turns your course materials into print-ready exam sets — papers, answer keys, QR-linked OMR sheets, and Moodle/Canvas exports. This short tour follows the same path an exam takes. One habit worth forming early: every list row answers to a right-click (or its ⋯ button) for its action menu — and truncated text always has “Read more” / “View details”.',
      },
      NAV_STEP,
      NAV_STEP_MOBILE,
      PIPELINE_CARD_MOBILE,
      {
        sel: '[data-tour="nav-subjects"]', minWidth: 992, side: 'right',
        title: 'Stage 1 · Subjects',
        description: 'A subject is the container everything hangs off — its materials, blueprints, question bank, and exams all live inside it.',
      },
      {
        sel: '[data-tour="nav-materials"]', minWidth: 992, side: 'right',
        title: 'Stage 2 · Materials',
        description: 'Upload syllabi and lectures here. They are the only evidence the AI may cite when drafting questions — nothing is invented.',
      },
      {
        sel: '[data-tour="nav-tos"]', minWidth: 992, side: 'right',
        title: 'Stage 3 · Blueprints',
        description: 'A Table of Specifications decides exactly how many items each topic × Bloom level contributes. Only finalized blueprints may drive generation.',
      },
      {
        sel: '[data-tour="nav-questions"]', minWidth: 992, side: 'right',
        title: 'Stage 4 · Question bank',
        description: 'AI drafts wait in your review queue first. Only questions you approve become exam-eligible — you are the quality gate.',
      },
      {
        sel: '[data-tour="nav-exams"]', minWidth: 992, side: 'right',
        title: 'Stage 5 · Exams',
        description: 'Assemble exact Set A / Set B papers that satisfy the blueprint, publish them, and download print packs with OMR sheets.',
      },
      {
        sel: '[data-tour="nav-analytics"]', minWidth: 992, side: 'right',
        title: 'Stage 6 · Analytics',
        description: 'Scan completed OMR sheets with the mobile app — item difficulty and class performance roll up here.',
      },
      {
        sel: '[data-tour="nav-pipeline"]', minWidth: 992, side: 'right',
        title: 'Watch the AI work',
        description: 'How AI works shows recorded extraction, indexing, blueprint, and question-generation tasks. Select a task to inspect its status, result, or missing lesson evidence.',
      },
      {
        sel: '[data-tour="shell-build"]', minWidth: 992, side: 'right',
        title: 'The shortcut',
        description: 'Build an exam walks this exact pipeline as a guided path — pick a subject and it carries you stage by stage.',
      },
      {
        sel: '[data-tour="shell-jobs"]', side: 'bottom', align: 'end',
        title: 'Work keeps running while you move',
        description: 'Extraction, blueprint drafting, question generation, and duplicate checks are background jobs — this badge counts them. Open it to see each task’s title and live slot progress, or press its stop button to cancel. Finished work announces itself wherever you are.',
      },
      {
        sel: '[data-tour="shell-account"]', side: 'bottom', align: 'end',
        title: 'Your menu',
        description: 'Profile photo, Account, Appearance (theme, typeface, and text size — saved to your account), and sign out. Appearance is a shared page, so staff get it too.',
      },
      {
        sel: '[data-tour="dash-kpis"]', side: 'bottom',
        title: 'The rolling tiles',
        description: 'Drafts, banked questions, exams, and scanned sheets — each tile counts up live, carries its trend, and deep-links to the list it summarizes.',
      },
      {
        sel: '[data-tour="dash-focus"]', side: 'left',
        title: 'Where to look each day',
        description: 'A prioritized queue: scans needing verification, drafts awaiting review, named blueprint shortfalls, and publish-ready exams — each row deep-links to where the work happens.',
      },
      {
        sel: '[data-tour="dash-live"]', side: 'left',
        title: 'AI at work, right here',
        description: 'While a generation run is live this card streams its progress — which cell it is writing, the outcome mix (queued, covered, reused, held), and drafts by cognitive level. Watch it live opens the full pipeline view; the card disappears when nothing is running.',
      },
      {
        title: 'That’s the whole system',
        description: 'Source documents in, graded answer sheets out — with you approving every question along the way. Click Guide anytime to replay; it never starts on its own.',
      },
    ],
  },
  {
    id: 'wizard', name: 'Exam builder', patterns: ['/wizard'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'The pipeline as a guided path',
        description: 'This screen runs the same six stages the sidebar lists — but it watches progress for you and always shows the next real action.',
      },
      {
        sel: '[data-tour="wizard-subject"]', side: 'bottom', align: 'end',
        title: 'Pick a subject',
        description: 'The pipeline runs per subject — choose one and the stage rail fills in with its live status.',
      },
      {
        sel: '[data-tour="wizard-steps"]', side: 'right',
        title: 'Four stages, one rule',
        description: 'Extraction and blueprint drafting can run automatically; the review stages always stop and wait for your decision.',
      },
      {
        sel: '[data-tour="wizard-detail"]', side: 'left',
        title: 'The next real action',
        description: 'Upload a syllabus, review the TOS, approve drafts, create the exam — this card is never filler; it is always the step that moves the exam forward.',
      },
    ],
  },
  {
    id: 'subjects', name: 'Subjects', patterns: ['/subjects'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 1 of the pipeline',
        description: 'Everything in nexam hangs off a subject. Create one and it unlocks its own materials shelf, blueprints, private question bank, and exams.',
      },
      {
        sel: '[data-tour="subjects-pipe"]', side: 'bottom',
        title: 'The whole pipeline at a glance',
        description: 'Instead of bare totals, this funnel counts how many subjects have reached each stage — materials indexed, blueprint finalized, questions approved, exam assembled — so the backlog is visible. When drafts wait on you, a flag links straight to the review queue.',
      },
      {
        sel: '[data-tour="subjects-new"]', side: 'bottom', align: 'end',
        title: 'Create a subject',
        description: 'A name is enough to start. Once it exists, you can upload materials into it and begin building assessments.',
      },
      {
        sel: '[data-tour="subjects-table"]', side: 'top',
        title: 'Each row is a workspace',
        description: 'The name opens the subject’s question bank; the counts are doors too — a question count opens that subject’s bank, a blueprint count its TOS list. Right-click a row (or tap its ⋯ button) for open, edit, copy, and delete.',
      },
    ],
  },
  {
    id: 'materials', name: 'Materials', patterns: ['/materials'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 2 · the evidence shelf',
        description: 'Materials are the foundation of trust: every AI-drafted question must cite an exact span from these documents, so grounding can never be faked.',
      },
      {
        sel: '[data-tour="materials-upload"]', side: 'bottom', align: 'end',
        title: 'Feed the system',
        description: 'Upload PDF, DOCX, PPTX, or TXT — or paste a URL or text. Flag a file as the syllabus to unlock automatic blueprint generation.',
      },
      {
        sel: '[data-tour="materials-tip"]', side: 'bottom',
        title: 'Drop files anywhere',
        description: 'Files dropped on this page queue for upload and processing — several at once.',
      },
      {
        sel: '[data-tour="materials-list"]', side: 'top',
        title: 'From file to fuel',
        description: 'Text extraction and embedding run as background jobs — watch them under the topbar badge. Right-click a card (or its ⋯ button) for the menu — a processed syllabus gains “Auto-generate Blueprint”, the bridge to Stage 3. Long titles wrap two lines and “Read more” opens the full details.',
      },
    ],
  },
  {
    id: 'tos', name: 'Blueprints', patterns: ['/tos'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 3 · the exam’s contract',
        description: 'A Table of Specifications is the promise an exam makes: exactly how many items each topic and Bloom level contributes. Exams are assembled to satisfy it exactly.',
      },
      {
        sel: '[data-tour="tos-band"]', side: 'bottom',
        title: 'Every blueprint’s fill, in cells',
        description: 'Each row is a blueprint; every cell is a share of its planned items — green is banked, blue waits on your approval, gray is still to generate. The matrix follows your search and filter, and a row click opens that blueprint.',
      },
      {
        sel: '[data-tour="tos-new"]', side: 'bottom', align: 'end',
        title: 'Two ways to start',
        description: 'Set item counts and Bloom weights by hand — or let a processed syllabus in Materials auto-generate the whole matrix.',
      },
      {
        sel: '[data-tour="tos-table"]', side: 'top',
        title: 'Draft vs finalized',
        description: 'Drafts are editable; finalized is the locked contract — its meta line tracks how many items are already banked. Right-click a row (or its ⋯ button) for the menu: “Build exam” opens the exam form with this blueprint pre-selected, and “View details” / “Read more” shows what the column clips.',
      },
    ],
  },
  {
    id: 'tos-detail', name: 'Blueprint', patterns: ['/tos/:id'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Building the contract',
        description: 'This screen is where the exam’s shape is decided: topic coverage on rows, cognitive demand on columns.',
      },
      {
        sel: '[data-tour="tos-workflow"]', side: 'bottom',
        title: 'Where this blueprint is',
        description: 'A live pipeline, not a diagram: topics planned → banked → finalized → exam assembled → sheets scanned. Each stage checks off as it happens; the highlighted one is your next job.',
      },
      {
        sel: '[data-tour="tos-detail-actions"]', side: 'bottom', align: 'end',
        title: 'Fill only what is missing',
        description: 'Auto-generate unlocks once finalized — and it is gap-aware: when cells are short the button counts down (“Generate N missing”), it first reuses matching questions your bank already holds, then drafts only the true deficit.',
      },
      {
        sel: '[data-tour="tos-matrix"]', side: 'top',
        title: 'The specification, live',
        description: 'Each cell reads banked/needed — amber means that topic × Bloom cell is still short. The matrix scrolls with its header and totals pinned, so long topic lists stay readable.',
      },
      {
        sel: '[data-tour="tos-topics"]', side: 'top',
        title: 'Slice blueprints per exam period',
        description: 'Tick topics to act on them: “New blueprint” spins the selection into its own draft — a Prelim or Midterm covering just those topics — and “Remove” trims on drafts. Once finalized the rows lock behind a lock icon.',
      },
    ],
  },
  {
    id: 'questions', name: 'Question bank', patterns: ['/questions'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 4 · your private bank',
        description: 'This is the vault exams draw from. The rule that protects it: only ACTIVE questions can enter an exam — and nothing becomes active without passing review.',
      },
      {
        sel: '[data-tour="questions-review"]', side: 'bottom', align: 'end',
        title: 'The quality gate',
        description: 'AI-drafted questions queue here for your approval. This queue is the reason generated content stays trustworthy.',
      },
      {
        sel: '[data-tour="questions-new"]', side: 'bottom',
        title: 'Write your own',
        description: 'Four types: multiple choice, true/false, matching, and fill in the blank (“identification” in the data).',
      },
      {
        sel: '[data-tour="questions-filters"]', side: 'bottom',
        title: 'See it like the blueprint does',
        description: 'The Filters button opens every facet — blueprint, topic, Bloom, status, type — in one modal; the badge counts active filters. Search sits in the toolbar itself.',
      },
      {
        sel: '[data-tour="questions-table"]', side: 'top',
        title: 'Status is everything',
        description: 'draft → active | rejected. Rows paginate 25 at a time — check-all still spans every matching page for bulk approval. Right-click a row / tap its ⋯ button for the full menu; “Read more” opens any stem the column truncates.',
      },
    ],
  },
  {
    id: 'review', name: 'Review queue', patterns: ['/questions/review'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'The quality gate',
        description: 'Every AI draft passes through this screen before it can touch an exam. Nothing enters the bank unreviewed — that is the system’s core promise.',
      },
      {
        sel: '[data-tour="review-card"]', side: 'top',
        title: 'Evidence, not vibes',
        description: 'Each draft must cite an exact span from your materials. Flagged duplicates must be compared before approval — grounding is enforced, not trusted.',
      },
      {
        sel: '[data-tour="review-evidence"]', side: 'top',
        title: 'The citation itself',
        description: 'The quoted span and the source material it came from appear right on the card, with the model that wrote it — verify the claim before approving.',
      },
      {
        sel: '[data-tour="review-actions"]', side: 'top',
        title: 'Decide fast',
        description: 'Approve (A), Reject (R), Edit (E), Skip (S); arrows move through the queue, U undoes. Speed here keeps the pipeline moving.',
      },
      {
        sel: '[data-tour="review-tools"]', side: 'bottom', align: 'end',
        title: 'Scope, bulk & background',
        description: 'Filter to one subject, approve checked drafts at once, or Clear queue to wipe undecided drafts. While jobs run, a live panel here shows their progress — and stop buttons cancel them.',
      },
    ],
  },
  {
    id: 'similarity', name: 'Similarity check', patterns: ['/questions/:id/similarity'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Duplicate defense',
        description: 'The institution index compares each draft against every approved question. High similarity means you may already have this item — check before approving.',
      },
      {
        sel: '[data-tour="sim-flagged"]', side: 'bottom',
        title: 'The suspect item',
        description: 'Its closest-match score sets the color band — the higher the band, the more likely it is a duplicate.',
      },
      {
        sel: '[data-tour="sim-matches"]', side: 'top',
        title: 'What it resembles',
        description: 'Existing bank items ranked by semantic similarity — read them side by side.',
      },
      {
        sel: '[data-tour="sim-decision"]', side: 'top',
        title: 'Your call',
        description: 'Keep it active or reject it — rejection is soft, the row stays for metrics.',
      },
    ],
  },
  {
    id: 'institution', name: 'Institution bank', patterns: ['/questions/institution'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'The shared vault',
        description: 'Every question an instructor at your institution has approved lives here — quality already vetted by a colleague’s review.',
      },
      {
        sel: '[data-tour="institution-filters"]', side: 'bottom',
        title: 'Mine the bank',
        description: 'Search by stem, topic, Bloom level, and type to find items worth reusing.',
      },
      {
        sel: '[data-tour="institution-list"]', side: 'top',
        title: 'Reuse still passes through you',
        description: 'Copying lands the item in YOUR review queue with a similarity check — it never goes straight into an exam. Results paginate so large banks stay fast.',
      },
    ],
  },
  {
    id: 'exam-form', name: 'Exam setup', patterns: ['/exams/new', '/exams/:id/edit'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 5 · assembly',
        description: 'This is where the blueprint becomes an exam — and where the pipeline’s guarantees pay off.',
      },
      {
        sel: '[data-tour="exam-source"]', side: 'bottom',
        title: 'Start from a blueprint',
        description: 'Pick a finalized TOS and nexam auto-assembles the exact topic × Bloom allocation from your approved bank. If the bank is short, an alert lists the exact missing cells — generate the deficit from the blueprint page. Blank works too, for full manual control.',
      },
      {
        sel: '[data-tour="exam-details"]', side: 'top',
        title: 'Print or digital',
        description: 'Print produces papers, answer keys, and QR-linked OMR sheets; digital produces a Moodle GIFT or Canvas QTI export. nexam does not run exams online.',
      },
      {
        sel: '[data-tour="exam-save"]', side: 'top',
        title: 'Draft first',
        description: 'Exams start as drafts — publishing is a separate, explicit step on the exam page.',
      },
    ],
  },
  {
    id: 'exams', name: 'Exams', patterns: ['/exams'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Where assessments ship',
        description: 'Every exam here is built only from questions you approved — the pipeline’s guarantees end as papers in your hand.',
      },
      {
        sel: '[data-tour="exams-scanband"]', side: 'bottom',
        title: 'The OMR readout',
        description: 'The shaded answer sheet marks the class average across every scanned sheet; the fact run counts exams, published papers, drafts, and generated sets. Rows that have scans carry the same reading as a chip.',
      },
      {
        sel: '[data-tour="exams-new"]', side: 'bottom',
        title: 'Assemble one',
        description: 'Blank, or generated from a finalized blueprint so the matrix fills itself.',
      },
      {
        sel: '[data-tour="exams-board"]', side: 'top',
        title: 'Draft → published',
        description: 'Status pills track each exam’s state. Open a row to attach questions, generate Set A/B packs, and publish — or right-click (⋯ button) for the row menu, including “View details” for clipped titles.',
      },
    ],
  },
  {
    id: 'exam-detail', name: 'Exam', patterns: ['/exams/:id'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'From draft to print pack',
        description: 'This screen turns an assembled exam into the actual artifacts: parallel papers, keys, and OMR sheets.',
      },
      {
        sel: '[data-tour="exam-actions"]', side: 'bottom', align: 'end',
        title: 'The big two',
        description: 'Generate sets builds the parallel Set A/B pack; Publish is always an explicit, confirmed step — nothing publishes itself.',
      },
      {
        sel: '[data-tour="exam-pipeline"]', side: 'bottom',
        title: 'The exam’s live status',
        description: 'Assembled → sets generated → published → scanned → reviewed. The rail updates itself as sheets come in — the highlighted stage is where this exam stands right now.',
      },
      {
        sel: '[data-tour="exam-downloads"]', side: 'bottom',
        title: 'The artifacts',
        description: 'Per set: a PDF paper, the answer key, and a QR-linked OMR sheet for the mobile scanner.',
      },
      {
        sel: '[data-tour="exam-questions"]', side: 'top',
        title: 'The contents',
        description: 'Attach approved questions from the subject’s bank — a linked blueprint can fill the exact matrix automatically.',
      },
      {
        sel: '[data-tour="exam-export"]', side: 'left',
        title: 'Take it elsewhere',
        description: 'GIFT for Moodle, QTI XML for Canvas, plus a TOS coverage report showing the exam satisfied its blueprint.',
      },
    ],
  },
  {
    id: 'ai-eval', name: 'AI quality', patterns: ['/analytics/ai-eval'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'How well the AI serves you',
        description: 'These metrics are measured against your own review decisions — not a benchmark, your judgment.',
      },
      {
        sel: '[data-tour="aieval-stats"]', side: 'bottom',
        title: 'The scorecard',
        description: 'Precision and approval rate of AI drafts, similarity flag rate, extraction accuracy — the system grading itself.',
      },
      {
        sel: '[data-tour="aieval-cards"]', side: 'top',
        title: 'Outcomes and provenance',
        description: 'The donut splits generated drafts by your verdict; provider usage shows which model wrote what — so a model that keeps getting rejected stands out.',
      },
      {
        sel: '[data-tour="aieval-matrix"]', side: 'top',
        title: 'Where it misjudges demand',
        description: 'Predicted Bloom level versus the level you assigned — the confusion matrix shows exactly where it needs your correction.',
      },
    ],
  },
  {
    id: 'item-analysis', name: 'Item analysis', patterns: ['/analytics/items/:examId'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'The per-question autopsy',
        description: 'After grading, each item shows whether it discriminated well: correct rate, difficulty band, and which distractors students actually picked.',
      },
      {
        sel: '[data-tour="ia-table"]', side: 'top',
        title: 'Spot the weak item',
        description: 'A bad question is a one-line read — too easy, too hard, or a distractor nobody chose.',
      },
    ],
  },
  {
    id: 'attention', name: 'Needs attention', patterns: ['/analytics/attention'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'The weak-signal list',
        description: 'Every scanned item that underperformed across your exams lands here — the questions worth revising before they go out again.',
      },
      {
        sel: '[data-tour="attn-stats"]', side: 'bottom',
        title: 'The size of the problem',
        description: 'Flagged items, exams affected, weighted correct rate, and responses analyzed — the KPI tiles animate so the worst number is the first thing you see.',
      },
      {
        sel: '[data-tour="attn-filter"]', side: 'bottom', align: 'end',
        title: 'One exam or all of them',
        description: 'Scope the list to a single exam — or keep the cross-exam view to spot items that struggle everywhere.',
      },
      {
        sel: '[data-tour="attn-table"]', side: 'top',
        title: 'Read the row',
        description: 'Each row pairs the item’s correct rate with its topic and Bloom level, so you can tell a hard question from a broken one. Print turns this list into a review checklist.',
      },
    ],
  },
  {
    id: 'exam-analytics', name: 'Exam report', patterns: ['/analytics/exam/:examId'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'One exam, fully read',
        description: 'This is the per-exam report: who was scanned, how the class scored, and where the items landed. It has its own URL now — refresh, share, or bookmark it.',
      },
      {
        sel: '[data-tour="exam-stats"]', side: 'bottom',
        title: 'The headline numbers',
        description: 'Students scanned, class average (with its delta versus the passing mark), spread, pass count, and sheets still awaiting your review.',
      },
      {
        sel: '[data-tour="analytics-topics"]', side: 'right',
        title: 'What the class mastered',
        description: 'Topic and Bloom breakdowns for this exam alone — the same color language as the overview, narrowed to one paper.',
      },
      {
        sel: '[data-tour="exam-students"]', side: 'top',
        title: 'Per-student rows',
        description: 'Score, correct count, and review status per scanned sheet — anything flagged waits here for your confirmation.',
      },
    ],
  },
  {
    id: 'scans', name: 'OMR scans', patterns: ['/scans'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Where the paperwork lands',
        description: 'Every OMR sheet the phone captures becomes a row here — scored by the server, flagged when a bubble is ambiguous, and tied to a student record the roster tab maintains. Nothing on this page is typed in by hand.',
      },
      {
        sel: '[data-tour="scans-views"]', side: 'bottom', align: 'end',
        title: 'Two views of the same data',
        description: 'Answer sheets is the flat archive — every scan, one row. Students is the roster scans built up; open it to fix a misspelled name or merge a duplicate so one person never counts twice.',
      },
      {
        sel: '[data-tour="scans-filters"]', side: 'bottom',
        title: 'Slice by exam or set',
        description: 'Pick an exam to see only its sheets, then narrow further to Set A or Set B. The same filter state feeds the counts and the chart below.',
      },
      {
        sel: '[data-tour="scans-status"]', side: 'bottom',
        title: 'Review is a gate',
        description: 'A sheet with a doubtful bubble stays in “Needs review” until someone resolves it — it never silently counts. The numbers are live: they follow the exam and set you filtered to.',
      },
      {
        sel: '[data-tour="scans-mix"]', side: 'bottom', align: 'end',
        title: 'The class at a glance',
        description: 'Four bars sketch the score distribution — red under 60, amber to 74, green to 89, blue for 90+. Beside it: the average, how many distinct students were captured, and the sheet count.',
      },
      {
        sel: '[data-tour="scans-grid"]', side: 'top',
        title: 'Open a sheet to correct it',
        description: 'Click a row and the sheet slides in from the right — every item, its recorded mark, and the key. Pick a different answer and the server re-scores the whole sheet. Right-click (or ⋯) for the row actions.',
      },
    ],
  },
  {
    id: 'analytics', name: 'Analytics', patterns: ['/analytics'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Stage 6 · after the exam',
        description: 'OMR sheets scanned in the mobile app roll up here — this is the payoff end of the pipeline: evidence of what students actually learned.',
      },
      {
        sel: '[data-tour="analytics-stats"]', side: 'bottom',
        title: 'The roll-up',
        description: 'Animated KPI tiles — exams, sheets scanned, students graded, flags needing review, and the class average with its day-over-day delta.',
      },
      {
        sel: '[data-tour="analytics-trend"]', side: 'bottom',
        title: 'Trend and volume',
        description: 'Average score over time beside sheets scanned per day — the finance-style pair that separates a weak cohort from a quiet week.',
      },
      {
        sel: '[data-tour="analytics-insights"]', side: 'bottom',
        title: 'The system reads it for you',
        description: 'Plain-language findings: weakest and strongest topics, higher-order vs recall gaps, score trends, and anything still pending review.',
      },
      {
        sel: '[data-tour="analytics-topics"]', side: 'right',
        title: 'Thematic mastery',
        description: 'Every scanned item traces back to its blueprint topic and Bloom level — see exactly which themes students struggle with, green → amber → red.',
      },
      {
        sel: '[data-tour="analytics-averages"]', side: 'right',
        title: 'Per-exam results',
        description: 'Click an exam for its score distribution, per-student rows, and that exam’s own topic and cognitive-level breakdown.',
      },
      {
        sel: '[data-tour="analytics-ai"]', side: 'bottom', align: 'end',
        title: 'And the AI’s own grade',
        description: 'How accurate generated questions have been — measured against your review decisions.',
      },
    ],
  },
  {
    id: 'pipeline', name: 'How AI works', patterns: ['/pipeline'], roles: INSTRUCTOR,
    steps: [
      {
        title: 'Watch the AI think',
        description: 'This page shows a processing task as it happens — reading files, drafting blueprints, indexing passages, or writing questions. Nothing here approves anything: drafts still wait in your review queue.',
      },
      {
        sel: '[data-tour="pipe-graph"]', side: 'top',
        title: 'The flow, left to right',
        description: 'Your blueprint and question bank feed the chain: retrieve lesson evidence → draft → constraint checks → an independent blind check. Blue streams are the working channel; a colored flash shows where each question ended up — drafted, reused from the bank, already covered, or held back for lack of proof.',
      },
      {
        sel: '[data-tour="pipe-kpis"]', side: 'bottom',
        title: 'The counters',
        description: 'Drafted, reused, covered, and held-back tally live, alongside blueprint-cell progress and pace. Question counts and cell counts are separate — a scoreboard of work done, not a measure of accuracy.',
      },
      {
        sel: '[data-tour="pipe-now"]', side: 'top',
        title: 'What it’s doing right now',
        description: 'The current blueprint cell — topic and Bloom level — while writing, then the newest saved question once a run settles.',
      },
      {
        sel: '[data-tour="pipe-controls"]', side: 'bottom', align: 'end',
        title: 'Tasks and the brake',
        description: 'Switch between recent tasks with the picker — finished runs replay their saved questions. Stop ends a live run cleanly; work already saved stays in your queue.',
      },
      {
        sel: '[data-tour="pipe-stats"]', side: 'top',
        title: 'Reading a run afterwards',
        description: 'The donut shows where questions and cells ended up, the bars spread drafts across Bloom levels, the pace line tracks writing speed, and the latest list previews each question — all replayable for finished runs.',
      },
    ],
  },
  {
    id: 'account', name: 'Account', patterns: ['/account'], roles: ANYONE,
    steps: [
      {
        title: 'Your instructor identity',
        description: 'Everything you build in nexam is scoped to this account — your subjects, materials, and question bank are private to you.',
      },
      {
        sel: '[data-tour="account-photo"]', side: 'right',
        title: 'Profile photo',
        description: 'Upload or remove a photo — it shows in the sidebar and topbar.',
      },
      {
        sel: '[data-tour="account-password"]', side: 'left',
        title: 'Security',
        description: 'Change your password here; the eye toggles reveal what you type.',
      },
      {
        sel: '[data-tour="account-letterhead"]', side: 'left',
        title: 'Your letterhead',
        description: 'Upload your school or department letterhead (and an optional footer) — it heads every printed exam, answer key, and report you generate. Only you see it.',
      },
      {
        sel: '[data-tour="account-legal"]', side: 'left',
        title: 'Privacy & terms, always reachable',
        description: 'The Data Privacy Notice and Terms of Use live here permanently — review anytime how your uploads, drafts, and student data are handled by the AI features.',
      },
    ],
  },
  {
    id: 'appearance', name: 'Appearance', patterns: ['/appearance'], roles: ANYONE,
    steps: [
      {
        title: 'Make the workspace yours',
        description: 'Theme, accent, typeface, text size, and corner style live here — saved to your account, so they follow you across devices.',
      },
      {
        sel: '[data-tour="appearance-themes"]', side: 'bottom',
        title: 'Theme',
        description: 'Light, dark, or follow your system — also reachable from the account menu.',
      },
      {
        sel: '[data-tour="appearance-accent"]', side: 'bottom',
        title: 'Accent',
        description: 'Recolors every action, focus ring, and active state — blue is the institution default. Status colors stay semantic so warning and danger still read correctly.',
      },
      {
        sel: '[data-tour="appearance-typeface"]', side: 'bottom',
        title: 'Typeface',
        description: 'Six presets — Sora + SF Pro is the default, pairing a geometric display face with a compact body face. The Custom card opens a mixer where you pair any display and body face yourself.',
      },
      {
        sel: '[data-tour="appearance-size"]', side: 'top',
        title: 'Text size',
        description: 'Compact is the standard scale — Regular and Large grow text and spacing together for easier reading.',
      },
      {
        sel: '[data-tour="appearance-corners"]', side: 'top',
        title: 'Corners',
        description: 'Sharp, default, or rounded — retunes the radius scale on every card, button, and field at once.',
      },
      {
        sel: '[data-tour="appearance-palette"]', side: 'top',
        title: 'The palette',
        description: 'The resolved design tokens for the active theme.',
      },
    ],
  },
  {
    id: 'admin', name: 'Admin console', patterns: ['/admin/:view'], roles: ADMIN,
    steps: [
      {
        title: 'The institution’s control room',
        description: 'This console governs who gets in and what the system is allowed to do — approvals, sign-in security, and AI credentials. What you see depends on your role: admins manage instructors, the superadmin manages everything.',
      },
      {
        sel: '[data-tour="shell-nav"]', minWidth: 992, side: 'right',
        title: 'Console sections',
        description: 'Dashboard and Users are for everyone here; reports, login logs, audit trail, and settings are superadmin-only. Reports prints or exports to Excel.',
      },
      NAV_STEP_MOBILE,
      {
        sel: '[data-tour="admin-kpis"]', side: 'bottom',
        title: 'At a glance',
        description: 'Pending approvals, active instructors, and sign-in activity. System health appears for the superadmin only.',
      },
      {
        sel: '[data-tour="admin-toolbar"]', side: 'bottom',
        title: 'Controls',
        description: 'Search and filter the records below — the Users view opens on All; the chips switch to Pending, Active, or Rejected.',
      },
      {
        sel: '[data-tour="admin-add"]', side: 'bottom', align: 'end',
        title: 'Provision an account',
        description: 'Add user creates a verified account instantly — the server generates the password and emails it straight to the user, so it never appears on your screen. The superadmin can create admins; admins create instructors only.',
      },
      {
        sel: '[data-tour="admin-table"]', side: 'top',
        title: 'The records',
        description: 'Every row answers to its ⋯ menu (or right-click): Approve, Edit details — all four name fields — and Send reset link, which emails the user a one-time link without ever showing you a password. Reject sits at the bottom in red.',
      },
    ],
  },
];

/** First tour whose pattern matches this pathname AND admits this role. */
export function resolveTour(pathname, role) {
  for (const tour of TOURS) {
    if (role && !tour.roles.includes(role)) continue;
    for (const pattern of tour.patterns) {
      if (matchPath({ path: pattern, end: true }, pathname)) return tour;
    }
  }
  return null;
}
