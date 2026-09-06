<div class="page-content">

    <div class="page-header">
        <div>
            <?php if (!empty($subject)): ?>
                <span class="badge badge-gray"><?php echo htmlspecialchars($subject->name); ?></span>
            <?php endif; ?>
            <?php if ($exam->status === 'published'): ?>
                <span class="badge badge-green">Published</span>
            <?php else: ?>
                <span class="badge badge-amber">Draft</span>
            <?php endif; ?>
        </div>
        <div class="header-actions">
            <?php if ($exam->status === 'draft'): ?>
                <a href="<?php echo site_url('exams/publish/' . $exam->id); ?>" class="btn btn-primary btn-sm"
                   onclick="return confirmPublish(event)">
                    <i data-lucide="send"></i> Publish
                </a>
            <?php endif; ?>
            <?php if ($exam->format === 'print'): ?>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.print()">
                    <i data-lucide="printer"></i> Print
                </button>
            <?php endif; ?>
            <a href="<?php echo site_url('exams/edit/' . $exam->id); ?>" class="btn btn-outline btn-sm"><i data-lucide="pencil"></i> Edit</a>
            <a href="<?php echo site_url('exams'); ?>" class="btn btn-outline btn-sm"><i data-lucide="arrow-left"></i> Back</a>
        </div>
    </div>

    <div class="stats-grid mb-2">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="file-text"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo count($questions); ?></div><div class="stat-label">Questions</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon <?php echo $exam->format === 'print' ? 'amber' : 'green'; ?>"><i data-lucide="<?php echo $exam->format === 'print' ? 'printer' : 'monitor'; ?>"></i></div>
            <div class="stat-info"><div class="stat-value stat-value-sm"><?php echo htmlspecialchars($exam->format); ?></div><div class="stat-label">Format</div></div>
        </div>
        <?php if ($exam->duration_minutes): ?>
            <div class="stat-card">
                <div class="stat-icon purple"><i data-lucide="clock"></i></div>
                <div class="stat-info"><div class="stat-value"><?php echo (int) $exam->duration_minutes; ?></div><div class="stat-label">Minutes</div></div>
            </div>
        <?php endif; ?>
    </div>

    <?php if ($exam->instructions): ?>
        <div class="card mb-2">
            <div class="card-header"><span class="card-title">Instructions</span></div>
            <div class="card-body">
                <p class="preserve-lines"><?php echo htmlspecialchars($exam->instructions); ?></p>
            </div>
        </div>
    <?php endif; ?>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Questions</span>
            <?php if (!empty($questions)): ?>
                <span class="text-muted meta-sm"><?php echo count($questions); ?> total</span>
            <?php endif; ?>
        </div>
        <?php if (empty($questions)): ?>
            <div class="empty-state empty-state-lg">
                <i data-lucide="help-circle"></i>
                <p>This exam has no questions yet.</p>
                <a href="<?php echo site_url('exams/create?tos='); ?>" class="btn btn-primary btn-sm">
                    <i data-lucide="sparkles"></i> Generate from TOS
                </a>
            </div>
        <?php else: ?>
            <div class="table-wrap table-bare">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-num">#</th>
                            <th>Question</th>
                            <th>Type</th>
                            <th>Bloom</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($questions as $i => $q): ?>
                            <tr>
                                <td class="text-muted"><?php echo $i + 1; ?></td>
                                <td class="cell-medium"><?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 120, '…')); ?></td>
                                <td><span class="badge badge-gray"><?php echo htmlspecialchars(ucfirst($q->type)); ?></span></td>
                                <td><span class="badge badge-purple"><?php echo htmlspecialchars(ucfirst($q->bloom)); ?></span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>

</div>

<script>
function confirmPublish(e) {
    e.preventDefault();
    NexamModal.confirm(
        "Publish exam?",
        "Once published, the exam will be finalized. You can still edit it later.",
        "warning",
        function () { window.location.href = e.currentTarget.href; }
    );
    return false;
}
</script>
