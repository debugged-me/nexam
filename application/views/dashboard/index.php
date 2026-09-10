<?php
/**
 * Dashboard — activity overview for the signed-in instructor.
 * Every figure is derived from the instructor's own records.
 */

$first_name = trim(strtok((string) $full_name, ' '));
if ($first_name === '') $first_name = 'there';

$kpis = [
    ['key' => 'subjects',  'label' => 'Subjects',       'value' => $stats['subjects'],  'icon' => 'book-open',   'variant' => 'info',    'url' => site_url('subjects')],
    ['key' => 'questions', 'label' => 'Questions',      'value' => $stats['questions'], 'icon' => 'help-circle', 'variant' => 'success', 'url' => site_url('questions')],
    ['key' => 'tos',       'label' => 'Blueprints (TOS)', 'value' => $stats['tos'],       'icon' => 'table',       'variant' => 'warning', 'url' => site_url('tos')],
    ['key' => 'exams',     'label' => 'Exams',          'value' => $stats['exams'],     'icon' => 'file-text',   'variant' => 'purple',  'url' => site_url('exams')],
];

$bloom_total = array_sum($bloom) + $bloom_unclassified;
$bloom_max   = max(array_merge(array_values($bloom), [$bloom_unclassified, 1]));
$bloom_index = 0;
$initial_activity = array_slice($series, -30);
$initial_activity_total = 0;
foreach ($initial_activity as $day) {
    $initial_activity_total += (int) $day['q'] + (int) $day['e'];
}
?>
<div class="page-content page-content--dashboard">

    <div class="page-header">
        <div>
            <h1><?= htmlspecialchars($greeting) ?>, <?= htmlspecialchars($first_name) ?></h1>
            <p class="page-sub">
                <?php if ($stats['questions'] === 0): ?>
                    Start by adding a subject, then build out your question bank.
                <?php else: ?>
                    <?= number_format($deltas['questions']['current']) ?> question<?= $deltas['questions']['current'] === 1 ? '' : 's' ?>
                    and <?= number_format($deltas['exams']['current']) ?> exam<?= $deltas['exams']['current'] === 1 ? '' : 's' ?>
                    created in the last 30 days.
                <?php endif; ?>
            </p>
        </div>
        <div class="page-header-actions">
            <a href="<?= site_url('questions') ?>" class="btn btn-outline">
                <i data-lucide="plus"></i> New Question
            </a>
            <a href="<?= site_url('exams/create') ?>" class="btn btn-primary">
                <i data-lucide="file-plus-2"></i> New Exam
            </a>
        </div>
    </div>

    <?php
    // Show a Getting Started checklist when the instructor has no exams yet.
    // Once they've created at least one exam, the checklist hides itself.
    $show_onboarding = $stats['exams'] === 0;
    $step_done = [
        1 => $stats['subjects'] > 0,
        2 => $stats['materials'] > 0,
        3 => $stats['tos'] > 0,
        4 => $stats['questions'] > 0,
        5 => $stats['exams'] > 0,
    ];
    $done_count = count(array_filter($step_done));
    ?>
    <?php if ($show_onboarding): ?>
    <div class="card getting-started-card">
        <div class="card-header">
            <div>
                <span class="card-title">Getting Started</span>
                <div class="card-sub"><?= $done_count ?> of 5 steps complete — follow the path from upload to exam</div>
            </div>
            <span class="getting-started-progress"><?= $done_count ?>/5</span>
        </div>
        <div class="card-body">
            <div class="onboarding-steps">
                <a href="<?= site_url('subjects') ?>" class="onboarding-step<?= $step_done[1] ? ' is-done' : '' ?>">
                    <span class="onboarding-num"><?= $step_done[1] ? '<i data-lucide="check"></i>' : '1' ?></span>
                    <span class="onboarding-body">
                        <strong>Create a Subject</strong>
                        <small>Add the course you teach — it groups everything else.</small>
                    </span>
                </a>
                <a href="<?= site_url('materials/upload') ?>" class="onboarding-step<?= $step_done[2] ? ' is-done' : '' ?>">
                    <span class="onboarding-num"><?= $step_done[2] ? '<i data-lucide="check"></i>' : '2' ?></span>
                    <span class="onboarding-body">
                        <strong>Upload a Syllabus</strong>
                        <small>Check "This is a syllabus" when uploading — the AI extracts topics and hours from it.</small>
                    </span>
                </a>
                <a href="<?= site_url('materials') ?>" class="onboarding-step<?= $step_done[3] ? ' is-done' : '' ?>">
                    <span class="onboarding-num"><?= $step_done[3] ? '<i data-lucide="check"></i>' : '3' ?></span>
                    <span class="onboarding-body">
                        <strong>Generate a Blueprint (TOS)</strong>
                        <small>Click "Generate TOS" on a processed syllabus to auto-create a Table of Specification.</small>
                    </span>
                </a>
                <a href="<?= site_url('tos') ?>" class="onboarding-step<?= $step_done[4] ? ' is-done' : '' ?>">
                    <span class="onboarding-num"><?= $step_done[4] ? '<i data-lucide="check"></i>' : '4' ?></span>
                    <span class="onboarding-body">
                        <strong>Generate Questions</strong>
                        <small>From a blueprint, click "Generate Questions" — AI drafts questions from your materials for review.</small>
                    </span>
                </a>
                <a href="<?= site_url('exams/create') ?>" class="onboarding-step<?= $step_done[5] ? ' is-done' : '' ?>">
                    <span class="onboarding-num"><?= $step_done[5] ? '<i data-lucide="check"></i>' : '5' ?></span>
                    <span class="onboarding-body">
                        <strong>Build an Exam</strong>
                        <small>Create an exam from your approved question bank — generate PDFs, OMR sheets, and exports.</small>
                    </span>
                </a>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- ================= Totals ================= -->
    <div class="kpi-grid">
        <?php foreach ($kpis as $kpi): $d = $deltas[$kpi['key']]; ?>
            <a href="<?= $kpi['url'] ?>" class="kpi-card kpi-card--<?= $kpi['variant'] ?>">
                <div class="kpi-top">
                    <span class="kpi-icon kpi-icon--<?= $kpi['variant'] ?>"><i data-lucide="<?= $kpi['icon'] ?>"></i></span>
                    <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
                </div>
                <div class="kpi-num" data-count="<?= (int) $kpi['value'] ?>"><?= number_format($kpi['value']) ?></div>
                <div class="kpi-label"><?= htmlspecialchars($kpi['label']) ?></div>
                <div class="kpi-foot">
                    <?php if ($d['dir'] === 'flat'): ?>
                        <span class="delta flat">No change</span>
                    <?php else: ?>
                        <span class="delta <?= $d['dir'] ?>">
                            <i data-lucide="<?= $d['dir'] === 'down' ? 'trending-down' : 'trending-up' ?>"></i>
                            <?= $d['pct'] ?>%
                        </span>
                    <?php endif; ?>
                    <span>vs. previous 30 days</span>
                </div>
            </a>
        <?php endforeach; ?>
    </div>

    <!-- ================= Activity + readiness ================= -->
    <div class="dash-grid">

        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">Content Activity</span>
                    <div class="card-sub">Questions and exams you created over time</div>
                </div>
                <div class="segmented" id="range-switch">
                    <button type="button" data-range="7" aria-pressed="false">7D</button>
                    <button type="button" data-range="30" class="active" aria-pressed="true">30D</button>
                    <button type="button" data-range="90" aria-pressed="false">90D</button>
                </div>
            </div>

            <div class="chart-summary">
                <span class="cs-value" id="chart-total"><?= number_format($initial_activity_total) ?></span>
                <span class="cs-note" id="chart-note">items created</span>
                <span class="delta flat" id="chart-delta"></span>
            </div>

            <div class="chart-plot" id="activity-chart" tabindex="0" role="img"
                 aria-label="Activity chart for the last 30 days. Use left and right arrow keys to inspect each day.">
                <div class="chart-tip" id="chart-tip" role="status" aria-live="polite"></div>
            </div>

            <div class="chart-axis" id="chart-axis"></div>

            <div class="card-footer">
                <div class="chart-legend">
                    <span class="legend-item"><span class="legend-swatch"></span> Questions</span>
                    <span class="legend-item"><span class="legend-swatch purple"></span> Exams</span>
                    <span class="legend-item"><span class="legend-swatch dashed"></span> Previous period</span>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">Bank Readiness</span>
                    <div class="card-sub">Share of questions active and ready for use</div>
                </div>
            </div>

            <div class="gauge-wrap">
                <div class="gauge" id="readiness-gauge" data-value="<?= (int) $bank['ready_pct'] ?>">
                    <svg viewBox="0 0 200 120" role="img"
                         aria-label="<?= (int) $bank['ready_pct'] ?> percent of questions active">
                        <path d="M18 108 A82 82 0 0 1 182 108" fill="none"
                              stroke="#F1F5F9" stroke-width="14" stroke-linecap="round"/>
                        <path d="M18 108 A82 82 0 0 1 182 108" fill="none"
                              stroke="#059669" stroke-width="14" stroke-linecap="round"
                              id="gauge-arc" stroke-dasharray="258" stroke-dashoffset="258"/>
                    </svg>
                    <div class="gauge-center">
                        <div class="gauge-value" data-count="<?= (int) $bank['ready_pct'] ?>" data-suffix="%"><?= (int) $bank['ready_pct'] ?>%</div>
                        <div class="gauge-caption">
                            <?= number_format($bank['approved']) ?> of <?= number_format($bank['total']) ?> active
                        </div>
                    </div>
                </div>
                <div class="gauge-legend">
                    <span class="gl"><i class="green"></i> Active <b><?= number_format($bank['approved']) ?></b></span>
                    <span class="gl"><i class="amber"></i> Draft <b><?= number_format($bank['draft']) ?></b></span>
                    <?php if ($bank['other'] > 0): ?>
                        <span class="gl"><i class="slate"></i> Other <b><?= number_format($bank['other']) ?></b></span>
                    <?php endif; ?>
                </div>
            </div>

            <div class="card-footer">
                <span class="text-muted gauge-foot-note">
                    <?php if ($blueprint['planned'] > 0): ?>
                        Blueprints (TOS) call for <?= number_format($blueprint['planned']) ?> items — bank covers <?= (int) $blueprint['fill_pct'] ?>%
                    <?php else: ?>
                        No blueprint targets set yet
                    <?php endif; ?>
                </span>
            </div>
        </div>
    </div>

    <!-- ================= Coverage + recent activity ================= -->
    <div class="dash-grid-3">

        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">Bloom Coverage</span>
                    <div class="card-sub"><?= (int) $bloom_covered ?> of 6 levels represented</div>
                </div>
            </div>

            <?php if ($bloom_total === 0): ?>
                <div class="dash-empty">
                    <div class="empty-icon"><i data-lucide="layers" aria-hidden="true"></i></div>
                    <h4>Nothing classified yet</h4>
                    <p>Tag questions with a Bloom level to see coverage here.</p>
                    <a href="<?= site_url('questions') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> New Question
                    </a>
                </div>
            <?php else: ?>
                <?php
                // Each bar uses one comparable scale: count relative to the largest group.
                ?>
                <div class="bloom-pyramid">
                    <?php foreach ($bloom as $level => $count): $bloom_index++; ?>
                        <?php
                        $fill_pct = $bloom_max > 0 ? round(($count / $bloom_max) * 100, 1) : 0;
                        $pct_of_total = $bloom_total > 0 ? round($count / $bloom_total * 100) : 0;
                        $is_empty = $count === 0;
                        ?>
                        <div class="bloom-tier t<?= $bloom_index ?><?= $is_empty ? ' empty' : '' ?>">
                            <span class="bloom-tier-label"><?= htmlspecialchars($level) ?></span>
                            <div class="bloom-tier-track">
                                <div class="bloom-tier-bar" style="width: <?= max($fill_pct, 6) ?>%">
                                    <?= number_format($count) ?>
                                </div>
                            </div>
                            <span class="bloom-tier-pct"><?= $pct_of_total ?>%</span>
                        </div>
                    <?php endforeach; ?>

                    <?php if ($bloom_unclassified > 0): ?>
                        <?php
                        $uncls_pct = $bloom_total > 0 ? round($bloom_unclassified / $bloom_total * 100) : 0;
                        $uncls_fill = $bloom_max > 0 ? round(($bloom_unclassified / $bloom_max) * 100, 1) : 0;
                        ?>
                        <div class="bloom-unclassified">
                            <span class="bloom-tier-label">Unclassified</span>
                            <div class="bloom-tier-track">
                                <div class="bloom-tier-bar" style="width: <?= max($uncls_fill, 6) ?>%">
                                    <?= number_format($bloom_unclassified) ?>
                                </div>
                            </div>
                            <span class="bloom-tier-pct"><?= $uncls_pct ?>%</span>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Subjects</span>
                <a href="<?= site_url('subjects') ?>" class="btn btn-outline btn-sm">View All</a>
            </div>

            <?php if (empty($recent_subjects)): ?>
                <div class="dash-empty">
                    <div class="empty-icon"><i data-lucide="book-open" aria-hidden="true"></i></div>
                    <h4>No subjects yet</h4>
                    <p>Subjects group your questions, blueprints and exams.</p>
                    <a href="<?= site_url('subjects') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> New Subject
                    </a>
                </div>
            <?php else: ?>
                <div class="recent-list">
                    <?php foreach ($recent_subjects as $s): ?>
                        <a href="<?= site_url('subjects/view/' . rawurlencode($s->id)) ?>" class="recent-row">
                            <span class="recent-tile"><?= htmlspecialchars(strtoupper(substr($s->name, 0, 2))) ?></span>
                            <span class="recent-body">
                                <span class="recent-title"><?= htmlspecialchars($s->name) ?></span>
                                <span class="recent-meta">
                                    <?php if (!empty($s->code)): ?>
                                        <span class="chip-code"><?= htmlspecialchars($s->code) ?></span>
                                    <?php endif; ?>
                                    <span><?= number_format($s->question_count) ?> question<?= $s->question_count === 1 ? '' : 's' ?></span>
                                </span>
                            </span>
                            <span class="recent-go"><i data-lucide="chevron-right"></i></span>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Exams</span>
                <a href="<?= site_url('exams') ?>" class="btn btn-outline btn-sm">View All</a>
            </div>

            <?php if (empty($recent_exams)): ?>
                <div class="dash-empty">
                    <div class="empty-icon"><i data-lucide="file-text" aria-hidden="true"></i></div>
                    <h4>No exams generated yet</h4>
                    <p>Build a blueprint (TOS), generate questions, then create an exam from your bank.</p>
                    <a href="<?= site_url('exams/create') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="file-plus-2"></i> New Exam
                    </a>
                </div>
            <?php else: ?>
                <div class="recent-list">
                    <?php foreach ($recent_exams as $e): ?>
                        <a href="<?= site_url('exams/view/' . rawurlencode($e->id)) ?>" class="recent-row">
                            <span class="recent-tile icon"><i data-lucide="file-text"></i></span>
                            <span class="recent-body">
                                <span class="recent-title"><?= htmlspecialchars($e->title) ?></span>
                                <span class="recent-meta">
                                    <span><?= number_format($e->item_count) ?> item<?= (int) $e->item_count === 1 ? '' : 's' ?></span>
                                    <span class="sep">·</span>
                                    <span><?= date('M j, Y', strtotime($e->created_at)) ?></span>
                                </span>
                            </span>
                            <span class="badge badge-<?= $e->status === 'published' ? 'green' : 'amber' ?>"><?= htmlspecialchars($e->status) ?></span>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

</div>

<script id="dashboard-series" type="application/json"><?= json_encode($series, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
