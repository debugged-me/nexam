<div class="page-content">

    <div class="stats-grid">
        <a href="<?php echo site_url('subjects'); ?>" class="stat-card" style="text-decoration:none;color:inherit">
            <div class="stat-icon blue"><i data-lucide="book-open"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo $stats['subjects']; ?></div>
                <div class="stat-label">Subjects</div>
            </div>
        </a>
        <a href="<?php echo site_url('questions'); ?>" class="stat-card" style="text-decoration:none;color:inherit">
            <div class="stat-icon green"><i data-lucide="help-circle"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo $stats['questions']; ?></div>
                <div class="stat-label">Questions</div>
            </div>
        </a>
        <a href="<?php echo site_url('tos'); ?>" class="stat-card" style="text-decoration:none;color:inherit">
            <div class="stat-icon amber"><i data-lucide="table"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo $stats['tos']; ?></div>
                <div class="stat-label">TOS Blueprints</div>
            </div>
        </a>
        <a href="<?php echo site_url('exams'); ?>" class="stat-card" style="text-decoration:none;color:inherit">
            <div class="stat-icon purple"><i data-lucide="file-text"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo $stats['exams']; ?></div>
                <div class="stat-label">Exams</div>
            </div>
        </a>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem" class="dashboard-grid">
        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Subjects</span>
                <a href="<?php echo site_url('subjects'); ?>" class="btn btn-outline btn-sm">View All</a>
            </div>
            <?php if (empty($recent_subjects)): ?>
                <div class="empty-state">
                    <i data-lucide="book-open"></i>
                    <p>No subjects yet.</p>
                    <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> New Subject
                    </a>
                </div>
            <?php else: ?>
                <div class="table-wrap" style="border:none;border-radius:0">
                    <table class="data-table">
                        <?php foreach ($recent_subjects as $s): ?>
                            <tr>
                                <td>
                                    <strong><?php echo htmlspecialchars($s->name); ?></strong>
                                    <?php if ($s->code): ?>
                                        <span class="badge badge-gray" style="margin-left:6px"><?php echo htmlspecialchars($s->code); ?></span>
                                    <?php endif; ?>
                                </td>
                                <td style="text-align:right">
                                    <a href="<?php echo site_url('subjects/view/' . $s->id); ?>" class="btn btn-outline btn-sm">Open</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Exams</span>
                <a href="<?php echo site_url('exams'); ?>" class="btn btn-outline btn-sm">View All</a>
            </div>
            <?php if (empty($recent_exams)): ?>
                <div class="empty-state">
                    <i data-lucide="file-text"></i>
                    <p>No exams generated yet.</p>
                    <a href="<?php echo site_url('exams/create'); ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> Generate Exam
                    </a>
                </div>
            <?php else: ?>
                <div class="table-wrap" style="border:none;border-radius:0">
                    <table class="data-table">
                        <?php foreach ($recent_exams as $e): ?>
                            <tr>
                                <td>
                                    <strong><?php echo htmlspecialchars($e->title); ?></strong>
                                    <span class="badge badge-<?php echo $e->status === 'published' ? 'green' : 'amber'; ?>" style="margin-left:6px"><?php echo htmlspecialchars($e->status); ?></span>
                                </td>
                                <td style="text-align:right">
                                    <a href="<?php echo site_url('exams/view/' . $e->id); ?>" class="btn btn-outline btn-sm">Open</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>

</div>

<style>
@media (max-width: 768px) {
    .dashboard-grid { grid-template-columns: 1fr !important; }
}
</style>
