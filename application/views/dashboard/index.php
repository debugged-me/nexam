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
    ['key' => 'tos',       'label' => 'TOS Blueprints', 'value' => $stats['tos'],       'icon' => 'table',       'variant' => 'warning', 'url' => site_url('tos')],
    ['key' => 'exams',     'label' => 'Exams',          'value' => $stats['exams'],     'icon' => 'file-text',   'variant' => 'purple',  'url' => site_url('exams')],
];

$bloom_total = array_sum($bloom) + $bloom_unclassified;
$bloom_max   = max(array_merge(array_values($bloom), [$bloom_unclassified, 1]));
$bloom_index = 0;
?>
<div class="page-content">

    <div class="page-header">
        <div>
            <h2><?= htmlspecialchars($greeting) ?>, <?= htmlspecialchars($first_name) ?></h2>
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
            <a href="<?= site_url('questions/create') ?>" class="btn btn-outline">
                <i data-lucide="plus"></i> New Question
            </a>
            <a href="<?= site_url('exams/create') ?>" class="btn btn-primary">
                <i data-lucide="sparkles"></i> Generate Exam
            </a>
        </div>
    </div>

    <!-- ================= Totals ================= -->
    <div class="kpi-grid">
        <?php foreach ($kpis as $kpi): $d = $deltas[$kpi['key']]; ?>
            <a href="<?= $kpi['url'] ?>" class="kpi-card kpi-card--<?= $kpi['variant'] ?>">
                <div class="kpi-top">
                    <span class="kpi-icon kpi-icon--<?= $kpi['variant'] ?>"><i data-lucide="<?= $kpi['icon'] ?>"></i></span>
                    <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
                </div>
                <div class="kpi-num" data-count="<?= (int) $kpi['value'] ?>">0</div>
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
                    <button type="button" data-range="7">7D</button>
                    <button type="button" data-range="30" class="active">30D</button>
                    <button type="button" data-range="90">90D</button>
                </div>
            </div>

            <div class="chart-summary">
                <span class="cs-value" id="chart-total">0</span>
                <span class="cs-note" id="chart-note">items created</span>
                <span class="delta flat" id="chart-delta"></span>
            </div>

            <div class="chart-plot" id="activity-chart">
                <div class="chart-tip" id="chart-tip"></div>
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
                    <div class="card-sub">Share of questions approved for use</div>
                </div>
            </div>

            <div class="gauge-wrap">
                <div class="gauge" id="readiness-gauge" data-value="<?= (int) $bank['ready_pct'] ?>">
                    <svg viewBox="0 0 200 120" role="img"
                         aria-label="<?= (int) $bank['ready_pct'] ?> percent of questions approved">
                        <path d="M18 108 A82 82 0 0 1 182 108" fill="none"
                              stroke="#F1F5F9" stroke-width="14" stroke-linecap="round"/>
                        <path d="M18 108 A82 82 0 0 1 182 108" fill="none"
                              stroke="#059669" stroke-width="14" stroke-linecap="round"
                              id="gauge-arc" stroke-dasharray="258" stroke-dashoffset="258"/>
                    </svg>
                    <div class="gauge-center">
                        <div class="gauge-value" data-count="<?= (int) $bank['ready_pct'] ?>" data-suffix="%">0%</div>
                        <div class="gauge-caption">
                            <?= number_format($bank['approved']) ?> of <?= number_format($bank['total']) ?> approved
                        </div>
                    </div>
                </div>
                <div class="gauge-legend">
                    <span class="gl"><i style="background:#059669"></i> Approved <b><?= number_format($bank['approved']) ?></b></span>
                    <span class="gl"><i style="background:#D97706"></i> Draft <b><?= number_format($bank['draft']) ?></b></span>
                    <?php if ($bank['other'] > 0): ?>
                        <span class="gl"><i style="background:#94A3B8"></i> Other <b><?= number_format($bank['other']) ?></b></span>
                    <?php endif; ?>
                </div>
            </div>

            <div class="card-footer">
                <span class="text-muted" style="font-size:.74rem">
                    <?php if ($blueprint['planned'] > 0): ?>
                        Blueprints call for <?= number_format($blueprint['planned']) ?> items — bank covers <?= (int) $blueprint['fill_pct'] ?>%
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
                    <div class="empty-icon"><i data-lucide="layers"></i></div>
                    <h4>Nothing classified yet</h4>
                    <p>Tag questions with a Bloom level to see coverage here.</p>
                    <a href="<?= site_url('questions/create') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> New Question
                    </a>
                </div>
            <?php else: ?>
                <div class="bloom-list">
                    <?php foreach ($bloom as $level => $count): $bloom_index++; ?>
                        <div class="bloom-row">
                            <div class="bloom-head">
                                <span class="bloom-name"><?= htmlspecialchars($level) ?></span>
                                <span class="bloom-meta">
                                    <b><?= number_format($count) ?></b> · <?= round($count / $bloom_total * 100) ?>%
                                </span>
                            </div>
                            <div class="bloom-track">
                                <div class="bloom-fill b<?= $bloom_index ?>"
                                     data-width="<?= round($count / $bloom_max * 100, 1) ?>"></div>
                            </div>
                        </div>
                    <?php endforeach; ?>

                    <?php if ($bloom_unclassified > 0): ?>
                        <div class="bloom-row">
                            <div class="bloom-head">
                                <span class="bloom-name">Unclassified</span>
                                <span class="bloom-meta"><b><?= number_format($bloom_unclassified) ?></b></span>
                            </div>
                            <div class="bloom-track">
                                <div class="bloom-fill muted"
                                     data-width="<?= round($bloom_unclassified / $bloom_max * 100, 1) ?>"></div>
                            </div>
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
                    <div class="empty-icon"><i data-lucide="book-open"></i></div>
                    <h4>No subjects yet</h4>
                    <p>Subjects group your questions, blueprints and exams.</p>
                    <a href="<?= site_url('subjects/create') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="plus"></i> New Subject
                    </a>
                </div>
            <?php else: ?>
                <div class="recent-list">
                    <?php foreach ($recent_subjects as $s): ?>
                        <a href="<?= site_url('subjects/view/' . $s->id) ?>" class="recent-row">
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
                    <div class="empty-icon"><i data-lucide="file-text"></i></div>
                    <h4>No exams generated yet</h4>
                    <p>Build a blueprint, then generate a paper from your bank.</p>
                    <a href="<?= site_url('exams/create') ?>" class="btn btn-primary btn-sm">
                        <i data-lucide="sparkles"></i> Generate Exam
                    </a>
                </div>
            <?php else: ?>
                <div class="recent-list">
                    <?php foreach ($recent_exams as $e): ?>
                        <a href="<?= site_url('exams/view/' . $e->id) ?>" class="recent-row">
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

<script id="dashboard-series" type="application/json"><?= json_encode($series) ?></script>
