<div class="page-content page-content--wide">
    <div class="page-header">
        <div>
            <h1><?php echo htmlspecialchars($exam->title ?? 'Exam Analytics'); ?></h1>
            <p class="page-sub">Class performance and score distribution.</p>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('analytics/items/' . rawurlencode($exam->id)); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="list-checks"></i> Item Analysis
            </a>
        </div>
    </div>

    <div class="stats-grid mb-3">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="users"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) ($stats->total_scans ?? 0); ?></div><div class="stat-label">Students</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="trending-up"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo number_format($stats->avg_score ?? 0, 1); ?>%</div><div class="stat-label">Class Average</div></div>
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

    <div class="card mb-3">
        <div class="card-header"><span class="card-title">Score Distribution</span></div>
        <div class="card-body">
            <div class="score-distribution">
                <?php
                $bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                $dist_map = [];
                foreach ($distribution as $d) { $dist_map[(int)$d->bin_start] = (int)$d->count; }
                $max_count = max(1, max($dist_map));
                for ($i = 0; $i < 10; $i++):
                    $bin_start = $i * 10;
                    $count = $dist_map[$bin_start] ?? 0;
                    $height_pct = ($count / $max_count) * 100;
                ?>
                    <div class="dist-bar">
                        <div class="dist-bar-count"><?php echo $count; ?></div>
                        <div class="dist-bar-track">
                            <div class="dist-bar-fill" style="height:<?php echo $height_pct; ?>%"></div>
                        </div>
                        <div class="dist-bar-label"><?php echo $bin_start; ?>-<?php echo $bin_start + 9; ?></div>
                    </div>
                <?php endfor; ?>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Student Scores</span>
            <span class="text-muted meta-sm"><?php echo count($students); ?> students</span>
        </div>
        <?php if (empty($students)): ?>
            <div class="empty-state empty-state-md"><i data-lucide="scan-line" aria-hidden="true"></i><p>No scans for this exam yet.</p></div>
        <?php else: ?>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr><th>#</th><th>Student</th><th>Set</th><th>Score</th><th>Correct</th><th>Status</th><th>Scanned</th></tr>
                    </thead>
                    <tbody>
                        <?php foreach ($students as $i => $s): ?>
                            <tr>
                                <td class="text-muted"><?php echo $i + 1; ?></td>
                                <td class="cell-primary">
                                    <?php if (!empty($s->student_id)): ?>
                                        <a href="<?php echo site_url('analytics/student/' . rawurlencode($s->student_id)); ?>">
                                            <?php echo htmlspecialchars($s->student_name ?? 'Unknown'); ?>
                                        </a>
                                    <?php else: ?>
                                        <?php echo htmlspecialchars($s->student_name ?? 'Unknown'); ?>
                                    <?php endif; ?>
                                </td>
                                <td><span class="badge badge-gray"><?php echo htmlspecialchars($s->set_label ?? '—'); ?></span></td>
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
                                <td class="text-muted meta-sm"><?php echo date('M j, g:i A', strtotime($s->scanned_at)); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
</div>
