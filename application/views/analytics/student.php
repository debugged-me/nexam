<div class="page-content page-content--wide">
    <div class="page-header">
        <div>
            <h1><?php echo htmlspecialchars($student->full_name ?? 'Student'); ?></h1>
            <?php if (!empty($student->student_number)): ?>
                <span class="badge badge-gray"><?php echo htmlspecialchars($student->student_number); ?></span>
            <?php endif; ?>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('analytics'); ?>" class="btn btn-outline btn-sm"><i data-lucide="arrow-left"></i> Back</a>
        </div>
    </div>

    <div class="stats-grid mb-3">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="file-text"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($stats->total_exams ?? 0); ?></div><div class="stat-label">Exams Taken</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="trending-up"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo number_format($stats->avg_score ?? 0, 1); ?>%</div><div class="stat-label">Average Score</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon amber"><i data-lucide="trending-down"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo number_format($stats->min_score ?? 0, 0); ?>%</div><div class="stat-label">Lowest</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple"><i data-lucide="trending-up"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo number_format($stats->max_score ?? 0, 0); ?>%</div><div class="stat-label">Highest</div></div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Exam History</span>
        </div>
        <?php if (empty($scans)): ?>
            <div class="empty-state empty-state-md"><i data-lucide="file-text" aria-hidden="true"></i><p>No exam records yet.</p></div>
        <?php else: ?>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr><th>Exam</th><th>Score</th><th>Correct</th><th>Status</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        <?php foreach ($scans as $s): ?>
                            <tr>
                                <td class="cell-primary">
                                    <a href="<?php echo site_url('analytics/exam/' . rawurlencode($s->exam_id)); ?>">
                                        <?php echo htmlspecialchars($s->exam_title); ?>
                                    </a>
                                </td>
                                <td>
                                    <span class="badge badge-<?php echo $s->score >= 75 ? 'green' : 'amber'; ?>">
                                        <?php echo number_format($s->score, 1); ?>%
                                    </span>
                                </td>
                                <td class="text-muted"><?php echo (int) $s->correct_count; ?> / <?php echo (int) $s->total_items; ?></td>
                                <td>
                                    <?php if ($s->needs_review): ?>
                                        <span class="g-state is-draft"><i data-lucide="alert-circle"></i> Needs Review</span>
                                    <?php else: ?>
                                        <span class="g-state is-live"><i data-lucide="check-circle"></i> Reviewed</span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-muted meta-sm"><?php echo date('M j, Y, g:i A', strtotime($s->scanned_at)); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
</div>
