# Assessment coverage

From **Materials → Generate blueprint**, choose a detected syllabus time frame
or enter an assessment name and optional week range. The scan keeps the outline
topics for review. It preserves stated period ranges, including Pre-Final; it
does not assign individual weeks to topics when the syllabus does not do so.

In the draft blueprint, use **Review coverage**:

1. Choose a period or select topics manually. Week fields may stay blank for
   syllabi organized by units or outcomes. For a cumulative exam, enter the full
   range and include the earlier topics.
2. Review the quoted schedule evidence. Unknown or overlapping schedules need
   an instructor decision. Applying coverage explicitly removes unchecked
   topics from this draft, after confirmation.
3. Select supporting passages from the subject's processed lessons, readings,
   or slides. When a passage spans periods, retain an exact excerpt covering
   the intended content. A schedule or bibliography alone may not contain
   enough evidence to generate questions.
4. Confirm coverage, check instructional hours and Bloom allocations, finalize,
   then generate and review the draft questions.

Existing blueprints keep their original behavior until a draft is explicitly
scoped. Finalized coverage is locked; derive a new blueprint from selected
topics to change it. New syllabus scans and derived blueprints require source
review. Nothing rewrites existing questions or exam records.

## Enforcement

`ensureSchema()` adds `tos.assessment_scope`, `tos.scope_key`,
`tos_topics.schedule`, and `questions.scope_key` on API startup.
The scope key identifies the confirmed period and exact selected passages.
Retrieval filters both embedding providers by allowed source IDs before top-k
selection, and supplies only the confirmed excerpts to question generation.
There is no fallback to unselected subject material.

Scope checks apply to generation, automatic question reuse, question coverage
counts, approval, exam assembly, direct question attachment, and exam alignment.
Questions from an older/unscoped or different assessment cannot automatically
fill a scoped blueprint. Current source existence and excerpts are rechecked
before finalization, generation, approval, and exam circulation. If selected
material is removed or reprocessed, create a new draft with current sources.

## Verification

API tests cover the four-period heading format, missing weeks, incorrect
schedule evidence, optional and invalid ranges, exact excerpts, source ownership,
stale source records, finalized locks, and vector filtering before top-k.
The provided DOCX samples were read locally; their contents are not bundled
into test fixtures or sent to a provider by these checks.
