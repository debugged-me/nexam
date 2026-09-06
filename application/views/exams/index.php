<div class="page-content">

    <div class="page-header">
        <div class="page-intro">
            <div class="page-intro-icon"><i data-lucide="file-text"></i></div>
            <div class="page-intro-body">
                <div class="page-intro-title">Exams<?php if (!empty($pagination['total'])): ?><span class="page-intro-count"><?php echo number_format($pagination['total']); ?></span><?php endif; ?></div>
                <div class="page-intro-sub">Papers generated from your blueprints and question bank.</div>
            </div>
        </div>
        <a href="<?php echo site_url('exams/create'); ?>" class="btn btn-accent">
            <i data-lucide="sparkles"></i> Generate Exam
        </a>
    </div>

    <?php if (empty($exams)): ?>
        <div class="card">
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="file-text"></i></div>
                <h4>No exams yet</h4>
                <p>Generate your first exam from a subject or TOS blueprint.</p>
                <a href="<?php echo site_url('exams/create'); ?>" class="btn btn-accent">
                    <i data-lucide="sparkles"></i> Generate Exam
                </a>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-wide">Title</th>
                            <th class="col-medium">Subject</th>
                            <th class="col-shrink">Format</th>
                            <th class="col-shrink">Status</th>
                            <th class="col-shrink">Questions</th>
                            <th class="col-shrink">Created</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($exams as $e): ?>
                            <tr>
                                <td>
                                    <a href="<?php echo site_url('exams/view/' . $e->id); ?>" class="cell-primary"
                                       title="<?php echo htmlspecialchars($e->title); ?>">
                                        <?php echo htmlspecialchars($e->title); ?>
                                    </a>
                                </td>
                                <td class="cell-truncate"><?php echo !empty($e->subject_name) ? htmlspecialchars($e->subject_name) : '<span class="text-muted">—</span>'; ?></td>
                                <td>
                                    <?php if ($e->format === 'print'): ?>
                                        <span class="badge badge-gray"><i data-lucide="printer"></i> Print</span>
                                    <?php else: ?>
                                        <span class="badge badge-blue"><i data-lucide="monitor"></i> Digital</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ($e->status === 'published'): ?>
                                        <span class="badge badge-green">Published</span>
                                    <?php else: ?>
                                        <span class="badge badge-amber">Draft</span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo isset($e->question_count) ? $e->question_count : 0; ?></td>
                                <td class="text-muted nowrap"><?php echo date('M j, Y', strtotime($e->created_at)); ?></td>
                                <td>
                                    <div class="action-icons">
                                        <a href="<?php echo site_url('exams/view/' . $e->id); ?>" class="action-icon" title="View"><i data-lucide="eye"></i></a>
                                        <a href="<?php echo site_url('exams/edit/' . $e->id); ?>" class="action-icon" title="Edit"><i data-lucide="pencil"></i></a>
                                        <a href="<?php echo site_url('exams/delete/' . $e->id); ?>" class="action-icon danger" title="Delete"
                                           onclick="return confirmDelete(event, '<?php echo htmlspecialchars($e->title, ENT_QUOTES); ?>')"><i data-lucide="trash-2"></i></a>
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

<script>
function confirmDelete(e, name) {
    e.preventDefault();
    NexamModal.deleteConfirm(
        "Delete exam?",
        "Deleting \"" + name + "\" will also remove its questions. This cannot be undone.",
        function () { window.location.href = e.currentTarget.href; }
    );
    return false;
}
</script>
