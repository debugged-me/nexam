<div class="page-content">

    <div class="page-header">
        <div class="page-intro">
            <div class="page-intro-icon"><i data-lucide="book-open"></i></div>
            <div class="page-intro-body">
                <div class="page-intro-title">Subjects<?php if (!empty($pagination['total'])): ?><span class="page-intro-count"><?php echo number_format($pagination['total']); ?></span><?php endif; ?></div>
                <div class="page-intro-sub">Courses you teach. Each subject groups its own questions, blueprints and exams.</div>
            </div>
        </div>
        <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
            <i data-lucide="plus"></i> New Subject
        </a>
    </div>

    <?php if (empty($subjects)): ?>
        <div class="card">
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="book-open"></i></div>
                <h4>No subjects yet</h4>
                <p>Create your first subject to start building exams.</p>
                <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
                    <i data-lucide="plus"></i> New Subject
                </a>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-wide">Name</th>
                            <th class="col-shrink">Code</th>
                            <th class="col-shrink">Created</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($subjects as $s): ?>
                            <tr>
                                <td>
                                    <a href="<?php echo site_url('subjects/view/' . $s->id); ?>" class="cell-primary"
                                       title="<?php echo htmlspecialchars($s->name); ?>">
                                        <?php echo htmlspecialchars($s->name); ?>
                                    </a>
                                </td>
                                <td><?php echo $s->code ? '<span class="badge badge-gray">' . htmlspecialchars($s->code) . '</span>' : '<span class="text-muted">—</span>'; ?></td>
                                <td class="text-muted nowrap"><?php echo date('M j, Y', strtotime($s->created_at)); ?></td>
                                <td>
                                    <div class="action-icons">
                                        <a href="<?php echo site_url('subjects/view/' . $s->id); ?>" class="action-icon" title="View"><i data-lucide="eye"></i></a>
                                        <a href="<?php echo site_url('subjects/edit/' . $s->id); ?>" class="action-icon" title="Edit"><i data-lucide="pencil"></i></a>
                                        <a href="<?php echo site_url('subjects/delete/' . $s->id); ?>" class="action-icon danger" title="Delete"
                                           onclick="return confirmDelete(event, '<?php echo htmlspecialchars($s->name, ENT_QUOTES); ?>')"><i data-lucide="trash-2"></i></a>
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
        "Delete subject?",
        "Deleting \"" + name + "\" will also remove its questions, TOS, and exams. This cannot be undone.",
        function () { window.location.href = e.currentTarget.href; }
    );
    return false;
}
</script>
