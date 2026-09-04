<div class="page-content">

    <div class="page-header">
        <p class="page-sub">Blueprints that decide how many items each topic and Bloom level gets.</p>
        <a href="<?php echo site_url('tos/create'); ?>" class="btn btn-primary">
            <i data-lucide="plus"></i> New TOS
        </a>
    </div>

    <?php if (empty($tos_list)): ?>
        <div class="card">
            <div class="empty-state">
                <i data-lucide="table"></i>
                <p>No TOS blueprints yet. Create one to plan your exam distribution.</p>
                <a href="<?php echo site_url('tos/create'); ?>" class="btn btn-primary">
                    <i data-lucide="plus"></i> New TOS
                </a>
            </div>
        </div>
    <?php else: ?>
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Subject</th>
                        <th>Total Items</th>
                        <th>Created</th>
                        <th style="text-align:right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($tos_list as $t): ?>
                        <tr>
                            <td>
                                <a href="<?php echo site_url('tos/view/' . $t->id); ?>" style="font-weight:600;color:var(--navy)">
                                    <?php echo htmlspecialchars($t->title); ?>
                                </a>
                            </td>
                            <td>
                                <?php if (!empty($t->subject_name)): ?>
                                    <a href="<?php echo site_url('subjects/view/' . $t->subject_id); ?>" style="color:var(--text)">
                                        <?php echo htmlspecialchars($t->subject_name); ?>
                                    </a>
                                    <?php if (!empty($t->subject_code)): ?>
                                        <span class="badge badge-gray" style="margin-left:6px"><?php echo htmlspecialchars($t->subject_code); ?></span>
                                    <?php endif; ?>
                                <?php else: ?>
                                    <span class="text-muted">—</span>
                                <?php endif; ?>
                            </td>
                            <td><span class="badge badge-blue"><?php echo (int) $t->total_items; ?> items</span></td>
                            <td class="text-muted"><?php echo date('M j, Y', strtotime($t->created_at)); ?></td>
                            <td>
                                <div class="action-icons" style="justify-content:flex-end">
                                    <a href="<?php echo site_url('tos/view/' . $t->id); ?>" class="action-icon" title="View"><i data-lucide="eye"></i></a>
                                    <a href="<?php echo site_url('tos/edit/' . $t->id); ?>" class="action-icon" title="Edit"><i data-lucide="pencil"></i></a>
                                    <a href="<?php echo site_url('tos/delete/' . $t->id); ?>" class="action-icon danger" title="Delete"
                                       onclick="return confirmDelete(event, '<?php echo htmlspecialchars($t->title, ENT_QUOTES); ?>')"><i data-lucide="trash-2"></i></a>
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
        "Delete TOS?",
        "Deleting \"" + name + "\" will also remove its topics. This cannot be undone.",
        function () { window.location.href = e.currentTarget.href; }
    );
    return false;
}
</script>
