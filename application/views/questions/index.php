<?php
$bloom_order = ['remember' => 1, 'understand' => 2, 'apply' => 3, 'analyze' => 4, 'evaluate' => 5, 'create' => 6];
$type_label  = [
    'mcq'            => 'Multiple choice',
    'true_false'     => 'True / false',
    'matching'       => 'Matching type',
    'identification' => 'Identification',
];

// The subject facet only appears when the page is not already scoped to one
// subject server-side — otherwise it could filter to a subject that was never
// loaded and silently return nothing.
$scoped  = !empty($subject_context);
$columns = ['subject' => 2, 'bloom' => 3, 'type' => 4, 'status' => 5];

$facets = [];
if (!$scoped && count($subjects) > 1) {
    $options = [];
    foreach ($subjects as $s) $options[$s->name] = $s->name;
    $facets[] = ['name' => 'Subject', 'column' => $columns['subject'], 'options' => $options];
}
$facets[] = ['name' => 'Status', 'column' => $columns['status'], 'options' => ['Active' => 'Active', 'Draft' => 'Draft']];
$facets[] = [
    'name'     => 'Bloom',
    'column'   => $columns['bloom'],
    'options'  => array_combine(
        array_map('ucfirst', array_keys($bloom_order)),
        array_map('ucfirst', array_keys($bloom_order))
    ),
    'selected' => !empty($filters['bloom']) ? ucfirst($filters['bloom']) : '',
];
$facets[] = [
    'name'     => 'Type',
    'column'   => $columns['type'],
    'options'  => array_combine(array_values($type_label), array_values($type_label)),
    'selected' => !empty($filters['type']) && isset($type_label[$filters['type']]) ? $type_label[$filters['type']] : '',
];
?>
<div class="page-content page-content--wide">


    <header class="list-head">
        <div class="list-head-main">
            <h1 class="list-head-title">
                Questions
                <?php if (!empty($questions)): ?>
                    <span class="list-head-count"><?php echo number_format($total); ?></span>
                <?php endif; ?>
            </h1>
            <p class="list-head-desc">One reusable bank. Tag each item with a topic and Bloom level so blueprints can draw from it.</p>
        </div>
        <div class="list-head-actions">
            <button type="button" class="btn btn-outline" id="btn-import-questions">
                <i data-lucide="upload"></i> Import
            </button>
            <button type="button" class="btn btn-primary" id="new-question-btn">
                <i data-lucide="plus"></i> New Question
            </button>
        </div>
    </header>

    <?php if (empty($questions)): ?>
        <div class="empty-state">
            <?php if ($scoped): ?>
                <h4>No questions for this subject</h4>
                <p>Add a question manually, import from GIFT/XML, or auto-generate from a blueprint (TOS) using your uploaded materials.</p>
                <div class="empty-state-actions">
                    <button type="button" class="btn btn-primary" id="new-question-btn-empty"><i data-lucide="plus"></i> New Question</button>
                    <button type="button" class="btn btn-outline" id="btn-import-questions-empty"><i data-lucide="upload"></i> Import</button>
                    <a href="<?php echo site_url('tos?subject_id=' . rawurlencode($subject_context->id)); ?>" class="btn btn-outline"><i data-lucide="sparkles"></i> Auto-generate from Blueprint</a>
                </div>
            <?php else: ?>
                <h4>Your question bank is empty</h4>
                <p>Add a question manually, import from GIFT/XML, or auto-generate from a blueprint (TOS) using your uploaded materials.</p>
                <div class="empty-state-actions">
                    <button type="button" class="btn btn-primary" id="new-question-btn-empty"><i data-lucide="plus"></i> New Question</button>
                    <button type="button" class="btn btn-outline" id="btn-import-questions-empty"><i data-lucide="upload"></i> Import</button>
                    <a href="<?php echo site_url('tos'); ?>" class="btn btn-outline"><i data-lucide="sparkles"></i> Auto-generate from Blueprint</a>
                </div>
            <?php endif; ?>
        </div>
    <?php else: ?>
        <?php
        $grid = [
            'key'         => 'questions',
            'label'       => 'questions',
            'placeholder' => 'Search stems and topics…',
            'facets'      => $facets,
        ];
        $this->load->view('partials/grid_open', ['grid' => $grid, 'csrf_name' => $csrf_name, 'csrf_hash' => $csrf_hash]);
        ?>

        <table class="grid datatable" data-grid="questions" data-grid-label="questions">
            <caption class="sr-only">Questions in your question bank</caption>
            <thead>
                <tr>
                    <th class="col-primary wp-36" data-name="Question" data-locked>Question</th>
                    <th class="wp-16" data-name="Subject">Subject</th>
                    <th class="wp-11" data-name="Bloom">Bloom</th>
                    <th class="wp-12" data-name="Type">Type</th>
                    <th class="wp-10" data-name="Status">Status</th>
                    <th class="wp-10" data-name="Updated">Updated</th>
                    <th class="col-actions wp-5"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($questions as $q): ?>
                    <?php
                    $stem    = trim(preg_replace('/\s+/', ' ', $q->stem));
                    $active  = $q->status === 'active';
                    $level   = isset($bloom_order[$q->bloom]) ? $bloom_order[$q->bloom] : 0;
                    $subject = isset($subject_map[$q->subject_id]) ? $subject_map[$q->subject_id] : '';
                    $touched = !empty($q->updated_at) ? $q->updated_at : $q->created_at;
                    ?>
                    <tr data-id="<?php echo htmlspecialchars($q->id); ?>">
                        <td>
                            <span class="g-primary">
                                <a href="<?php echo site_url('questions/edit/' . rawurlencode($q->id)); ?>" class="g-title" title="<?php echo htmlspecialchars($stem); ?>"><?php echo htmlspecialchars(mb_strimwidth($stem, 0, 120, '…')); ?></a>
                                <?php if (!empty($q->similarity_flag) && $q->similarity_flag === 'flagged'): ?>
                                    <a href="<?php echo site_url('questions/similarity/' . rawurlencode($q->id)); ?>" class="sim-flag" title="Possible duplicate — click to review">
                                        <i data-lucide="copy"></i> Similar
                                    </a>
                                <?php endif; ?>
                                <span class="g-meta"><?php echo $q->topic ? htmlspecialchars($q->topic) : 'No topic'; ?></span>
                            </span>
                        </td>
                        <td data-order="<?php echo htmlspecialchars($subject); ?>" data-filter="<?php echo htmlspecialchars($subject); ?>">
                            <?php if ($subject !== ''): ?>
                                <a href="<?php echo site_url('subjects/view/' . rawurlencode($q->subject_id)); ?>" class="g-link" title="<?php echo htmlspecialchars($subject); ?>"><?php echo htmlspecialchars($subject); ?></a>
                            <?php else: ?>
                                <span class="g-mute">—</span>
                            <?php endif; ?>
                        </td>
                        <td data-order="<?php echo $level; ?>" data-filter="<?php echo $level ? ucfirst(htmlspecialchars($q->bloom)) : ''; ?>">
                            <?php if ($level): ?>
                                <span class="g-bloom" data-level="<?php echo $level; ?>"><?php echo ucfirst(htmlspecialchars($q->bloom)); ?></span>
                            <?php else: ?>
                                <span class="g-mute">—</span>
                            <?php endif; ?>
                        </td>
                        <?php $type_text = isset($type_label[$q->type]) ? $type_label[$q->type] : htmlspecialchars($q->type); ?>
                        <td class="g-text" data-filter="<?php echo $type_text; ?>"><?php echo $type_text; ?></td>
                        <td data-order="<?php echo $active ? 1 : 0; ?>" data-filter="<?php echo $active ? 'Active' : 'Draft'; ?>">
                            <span class="g-state <?php echo $active ? 'is-live' : 'is-draft'; ?>"><?php echo $active ? 'Active' : 'Draft'; ?></span>
                        </td>
                        <td class="g-mute" data-order="<?php echo htmlspecialchars($touched); ?>"><?php echo date('M j, Y', strtotime($touched)); ?></td>
                        <td class="col-actions">
                            <?php if (!$active && $q->source === 'ai'): ?>
                                <div class="row-actions">
                                    <button type="button" class="btn btn-primary btn-xs btn-approve-q" data-id="<?php echo htmlspecialchars($q->id); ?>" title="Approve">
                                        <i data-lucide="check"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline btn-xs btn-reject-q" data-id="<?php echo htmlspecialchars($q->id); ?>" title="Reject">
                                        <i data-lucide="x"></i>
                                    </button>
                                </div>
                            <?php else: ?>
                                <details class="g-menu">
                                    <summary class="g-menu-trigger" aria-label="Actions for <?php echo htmlspecialchars($stem); ?>"><i data-lucide="ellipsis"></i></summary>
                                    <div class="g-menu-panel">
                                        <a href="<?php echo site_url('questions/edit/' . rawurlencode($q->id)); ?>" class="g-menu-item"><i data-lucide="pencil"></i> Edit</a>
                                        <div class="g-menu-sep"></div>
                                        <form action="<?php echo site_url('questions/delete/' . rawurlencode($q->id)); ?>" method="post" class="g-menu-form">
                                            <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                            <button type="button" class="g-menu-item is-danger" data-confirm data-confirm-title="Delete question?" data-confirm-type="delete" data-confirm-message="This question will be permanently removed from the bank. Exams already built with it keep their copy."><i data-lucide="trash-2"></i> Delete</button>
                                        </form>
                                    </div>
                                </details>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <?php $this->load->view('partials/grid_close'); ?>
    <?php endif; ?>

</div>

<script id="questions-config" type="application/json"><?php
    echo json_encode([
        'storeUrl'      => site_url('questions/store'),
        'importUrl'     => site_url('questions/import'),
        'subjects'      => array_map(function ($s) {
            return ['id' => $s->id, 'name' => $s->name, 'code' => $s->code];
        }, $subjects),
        'bloomLevels'   => $bloom_levels,
        'questionTypes' => $question_types,
        'statuses'      => $statuses,
        'filters'       => $filters,
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?></script>

<!-- Import Questions Modal (uses NexamModal shell, body injected by JS) -->
<!-- The modal is opened by questions.js via NexamModal.open() -->
