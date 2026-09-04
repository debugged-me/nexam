<div class="page-content">

    <div class="page-header">
        <h2>Subjects</h2>
        <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
            <i data-lucide="plus"></i> New Subject
        </a>
    </div>

    <?php if (empty($subjects)): ?>
        <div class="card">
            <div class="empty-state">
                <i data-lucide="book-open"></i>
                <p>No subjects yet. Create your first subject to start building exams.</p>
                <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
                    <i data-lucide="plus"></i> New Subject
                </a>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Created</th>
                        <th style="text-align:right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($subjects as $s): ?>
                        <tr>
                            <td>
                                <a href="<?php echo site_url('subjects/view/' . $s->id); ?>" style="font-weight:600;color:var(--navy)">
                                    <?php echo htmlspecialchars($s->name); ?>
                                </a>
                            </td>
                            <td><?php echo $s->code ? '<span class="badge badge-gray">' . htmlspecialchars($s->code) . '</span>' : '<span class="text-muted">—</span>'; ?></td>
                            <td class="text-muted"><?php echo date('M j, Y', strtotime($s->created_at)); ?></td>
                            <td>
                                <div class="action-icons" style="justify-content:flex-end">
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
