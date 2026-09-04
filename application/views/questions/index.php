<div class="page-content">

    <div class="page-header">
        <p class="page-sub">Every item you have written. Filter by subject, Bloom level or type.</p>
        <div class="page-header-actions">
            <button type="button" class="btn btn-outline" id="filter-btn">
                <i data-lucide="sliders-horizontal"></i> Filter
                <?php $active_count = (int) !empty($filters['subject_id']) + (int) !empty($filters['bloom']) + (int) !empty($filters['type']); ?>
                <?php if ($active_count > 0): ?>
                    <span class="filter-badge"><?php echo $active_count; ?></span>
                <?php endif; ?>
            </button>
            <button type="button" class="btn btn-primary" id="new-question-btn">
                <i data-lucide="plus"></i> New Question
            </button>
        </div>
    </div>

    <!-- Questions table -->
    <?php if (empty($questions)): ?>
        <div class="card">
            <div class="empty-state">
                <i data-lucide="help-circle"></i>
                <p>No questions found. Create your first question to start building your bank.</p>
                <button type="button" class="btn btn-primary" id="new-question-btn-empty">
                    <i data-lucide="plus"></i> New Question
                </button>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-wide">Question</th>
                            <th class="col-medium">Subject</th>
                            <th class="col-medium">Topic</th>
                            <th class="col-shrink">Bloom</th>
                            <th class="col-shrink">Type</th>
                            <th class="col-shrink">Status</th>
                            <th class="col-shrink" style="text-align:right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        $bloom_badge = [
                            'remember'    => 'badge-gray',
                            'understand'  => 'badge-blue',
                            'apply'       => 'badge-green',
                            'analyze'     => 'badge-amber',
                            'evaluate'    => 'badge-purple',
                            'create'      => 'badge-red',
                        ];
                        $type_label = [
                            'mcq'           => 'Multiple Choice',
                            'true_false'    => 'True / False',
                            'identification'=> 'Identification',
                            'essay'         => 'Essay',
                        ];
                        ?>
                        <?php foreach ($questions as $q): ?>
                            <tr>
                                <td>
                                    <a href="<?php echo site_url('questions/edit/' . $q->id); ?>" class="cell-primary"
                                       title="<?php echo htmlspecialchars($q->stem); ?>">
                                        <?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 100, '…')); ?>
                                    </a>
                                </td>
                                <td class="cell-truncate">
                                    <?php if (!empty($subject_map[$q->subject_id])): ?>
                                        <a href="<?php echo site_url('subjects/view/' . $q->subject_id); ?>"
                                           style="color:var(--ink-2);font-weight:500"
                                           title="<?php echo htmlspecialchars($subject_map[$q->subject_id]); ?>">
                                            <?php echo htmlspecialchars($subject_map[$q->subject_id]); ?>
                                        </a>
                                    <?php else: ?>
                                        <span class="text-muted">—</span>
                                    <?php endif; ?>
                                </td>
                                <td class="cell-truncate"><?php echo $q->topic ? htmlspecialchars($q->topic) : '<span class="text-muted">—</span>'; ?></td>
                                <td>
                                    <?php if ($q->bloom): ?>
                                        <span class="badge <?php echo isset($bloom_badge[$q->bloom]) ? $bloom_badge[$q->bloom] : 'badge-gray'; ?>">
                                            <?php echo ucfirst(htmlspecialchars($q->bloom)); ?>
                                        </span>
                                    <?php else: ?>
                                        <span class="text-muted">—</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="badge badge-blue">
                                        <?php echo isset($type_label[$q->type]) ? $type_label[$q->type] : htmlspecialchars($q->type); ?>
                                    </span>
                                </td>
                                <td>
                                    <?php if ($q->status === 'active'): ?>
                                        <span class="badge badge-green">Active</span>
                                    <?php else: ?>
                                        <span class="badge badge-gray">Draft</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <div class="action-icons" style="justify-content:flex-end">
                                        <a href="<?php echo site_url('questions/edit/' . $q->id); ?>" class="action-icon" title="Edit"><i data-lucide="pencil"></i></a>
                                        <a href="<?php echo site_url('questions/delete/' . $q->id); ?>" class="action-icon danger" title="Delete"
                                           onclick="return confirmDelete(event, '<?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 60, '...'), ENT_QUOTES); ?>')"><i data-lucide="trash-2"></i></a>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php $this->load->view('partials/pagination', ['pagination' => $pagination]); ?>
        </div>
    <?php endif; ?>

</div>

<!-- Data for client-side modals -->
<script id="questions-config" type="application/json"><?php
    echo json_encode([
        'storeUrl'   => site_url('questions/store'),
        'filterUrl'  => site_url('questions'),
        'subjects'   => array_map(function ($s) {
            return ['id' => $s->id, 'name' => $s->name, 'code' => $s->code];
        }, $subjects),
        'bloomLevels'   => $bloom_levels,
        'questionTypes' => $question_types,
        'statuses'      => $statuses,
        'filters'       => $filters,
    ]);
?></script>

<script>
function confirmDelete(e, stem) {
    e.preventDefault();
    NexamModal.deleteConfirm(
        "Delete question?",
        "Deleting \"" + stem + "\" cannot be undone.",
        function () { window.location.href = e.currentTarget.href; }
    );
    return false;
}
</script>
