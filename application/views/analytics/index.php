<div class="page-content page-content--wide">
    <div class="page-header">
        <div>
            <h1>Analytics</h1>
            <p class="page-sub">Performance insights from scanned OMR answer sheets.</p>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('analytics/ai-eval'); ?>" class="btn btn-outline btn-sm" title="View AI accuracy, precision, recall, and Bloom-level classification metrics">
                <i data-lucide="sparkles"></i> AI Evaluation Metrics
            </a>
        </div>
    </div>

    <div class="stats-grid mb-3">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="file-text"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($overview['total_exams'] ?? 0); ?></div><div class="stat-label">Exams</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="scan-line"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($overview['total_scans'] ?? 0); ?></div><div class="stat-label">Scanned Sheets</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple"><i data-lucide="users"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($overview['total_students'] ?? 0); ?></div><div class="stat-label">Students</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon amber"><i data-lucide="alert-circle"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($overview['needs_review'] ?? 0); ?></div><div class="stat-label">Need Review</div></div>
        </div>
    </div>

    <div class="detail-grid-2 mb-3">
        <div class="card">
            <div class="card-header">
                <span class="card-title">Exam Averages</span>
            </div>
            <?php if (empty($exam_averages)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="bar-chart-3" aria-hidden="true"></i><p>No scan data yet.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <thead>
                            <tr><th>Exam</th><th>Scans</th><th>Average</th><th>Range</th></tr>
                        </thead>
                        <tbody>
                            <?php foreach ($exam_averages as $ea): ?>
                                <?php if (!$ea->avg_score && !$ea->scan_count) continue; ?>
                                <tr>
                                    <td>
                                        <a href="<?php echo site_url('analytics/exam/' . rawurlencode($ea->id)); ?>" class="cell-title">
                                            <?php echo htmlspecialchars($ea->title); ?>
                                        </a>
                                    </td>
                                    <td class="text-muted"><?php echo (int) $ea->scan_count; ?></td>
                                    <td>
                                        <?php if ($ea->avg_score !== null): ?>
                                            <span class="badge badge-<?php echo $ea->avg_score >= 75 ? 'green' : 'amber'; ?>">
                                                <?php echo number_format($ea->avg_score, 1); ?>%
                                            </span>
                                        <?php else: ?>
                                            <span class="text-muted">—</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="text-muted meta-sm">
                                        <?php echo $ea->min_score !== null ? number_format($ea->min_score, 0) . '–' . number_format($ea->max_score, 0) . '%' : '—'; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Scans</span>
            </div>
            <?php if (empty($recent_scans)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="scan-line" aria-hidden="true"></i><p>No scans yet. Use the mobile app to scan OMR sheets.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <thead>
                            <tr><th>Student</th><th>Exam</th><th>Score</th><th>Scanned</th></tr>
                        </thead>
                        <tbody>
                            <?php foreach ($recent_scans as $rs): ?>
                                <tr>
                                    <td class="cell-primary"><?php echo htmlspecialchars($rs->student_name ?? 'Unknown'); ?></td>
                                    <td class="text-muted"><?php echo htmlspecialchars(mb_strimwidth($rs->exam_title, 0, 30, '...')); ?></td>
                                    <td>
                                        <span class="badge badge-<?php echo $rs->score >= 75 ? 'green' : 'amber'; ?>">
                                            <?php echo number_format($rs->score, 1); ?>%
                                        </span>
                                    </td>
                                    <td class="text-muted meta-sm"><?php echo date('M j, g:i A', strtotime($rs->scanned_at)); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
