<div class="page-content">

    <div class="page-header">
        <h2>Question Bank</h2>
        <a href="<?php echo site_url('questions/create'); ?>" class="btn btn-primary">
            <i data-lucide="plus"></i> New Question
        </a>
    </div>

    <!-- Filter bar -->
    <div class="card mb-2">
        <div class="card-body" style="padding:16px 20px">
            <form action="<?php echo site_url('questions'); ?>" method="get" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
                <div class="form-group" style="margin-bottom:0;flex:1;min-width:180px">
                    <label class="form-label" for="filter_subject">Subject</label>
                    <select id="filter_subject" name="subject_id" class="form-control form-select">
                        <option value="">All subjects</option>
                        <?php foreach ($subjects as $s): ?>
                            <option value="<?php echo htmlspecialchars($s->id); ?>"
                                <?php echo ($filters['subject_id'] === $s->id) ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($s->name); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom:0;flex:1;min-width:160px">
                    <label class="form-label" for="filter_bloom">Bloom Level</label>
                    <select id="filter_bloom" name="bloom" class="form-control form-select">
                        <option value="">All levels</option>
                        <?php foreach (['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as $b): ?>
                            <option value="<?php echo $b; ?>" <?php echo ($filters['bloom'] === $b) ? 'selected' : ''; ?>>
                                <?php echo ucfirst($b); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom:0;flex:1;min-width:160px">
                    <label class="form-label" for="filter_type">Type</label>
                    <select id="filter_type" name="type" class="form-control form-select">
                        <option value="">All types</option>
                        <?php foreach (['mcq' => 'Multiple Choice', 'true_false' => 'True / False', 'identification' => 'Identification', 'essay' => 'Essay'] as $t_val => $t_label): ?>
                            <option value="<?php echo $t_val; ?>" <?php echo ($filters['type'] === $t_val) ? 'selected' : ''; ?>>
                                <?php echo $t_label; ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div style="display:flex;gap:8px">
                    <button type="submit" class="btn btn-primary">
                        <i data-lucide="filter"></i> Filter
                    </button>
                    <a href="<?php echo site_url('questions'); ?>" class="btn btn-outline">
                        Clear
                    </a>
                </div>
            </form>
        </div>
    </div>

    <!-- Questions table -->
    <?php if (empty($questions)): ?>
        <div class="card">
            <div class="empty-state">
                <i data-lucide="help-circle"></i>
                <p>No questions found. Create your first question to start building your bank.</p>
                <a href="<?php echo site_url('questions/create'); ?>" class="btn btn-primary">
                    <i data-lucide="plus"></i> New Question
                </a>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Question</th>
                        <th>Subject</th>
                        <th>Topic</th>
                        <th>Bloom</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th style="text-align:right">Actions</th>
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
                            <td style="max-width:320px">
                                <span style="font-weight:500"><?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 80, '...')); ?></span>
                            </td>
                            <td>
                                <?php if (!empty($subject_map[$q->subject_id])): ?>
                                    <a href="<?php echo site_url('subjects/view/' . $q->subject_id); ?>" style="color:var(--navy);font-weight:500">
                                        <?php echo htmlspecialchars($subject_map[$q->subject_id]); ?>
                                    </a>
                                <?php else: ?>
                                    <span class="text-muted">—</span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo $q->topic ? htmlspecialchars($q->topic) : '<span class="text-muted">—</span>'; ?></td>
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
    <?php endif; ?>

</div>

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
