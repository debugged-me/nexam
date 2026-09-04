<?php
$current_page = 'rounds';
$round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];

// Helper to render a standings table body
function num_badge($n)
{
    return '<span class="rk-badge">' . $n . '</span>';
}

/** Superscript a leading ordinal (1st, 2nd...) in a placement title for on-screen display. */
function place_sup($name)
{
    return preg_replace('/^(\d+)(st|nd|rd|th)\b/i', '$1<sup>$2</sup>', $name);
}

$pdf = [
    'event' => $event->name ?? 'Binibining Mati 2026',
    'generated' => date('M j, Y g:i A'),
    'prelim' => [],
    'top10' => [],
    'final' => [],
];
foreach ($prelim as $c) {
    $pdf['prelim'][] = ['no' => $c->candidate_number, 'name' => $c->name, 'total' => round($c->total, 2), 'in' => (bool)$c->in_top10];
}
foreach ($top10_standings as $c) {
    $pdf['top10'][] = ['no' => $c->candidate_number, 'name' => $c->name, 'total' => round($c->total, 2), 'in' => (bool)$c->in_top5];
}
$place_names = [1 => 'BINIBINING MATI 2026', 2 => '1st BINIBINING KAUSWAGAN', 3 => '2nd BINIBINING KINAIYAHAN', 4 => '3rd BINIBINING KAHUPAYAN', 5 => '4th BINIBINING KABILIN'];
$rank = 1;
$prev = null;
foreach ($final_standings as $c) {
    $tie = $prev !== null && abs($c->total - $prev) < 0.001;
    $pdf['final'][] = ['no' => $c->candidate_number, 'name' => $c->name, 'barangay' => $c->barangay ?? '', 'total' => round($c->total, 2), 'place' => $tie ? 'TIE' : ($place_names[$rank] ?? ('Place ' . $rank))];
    $prev = $c->total;
    $rank++;
}
$pdf['judges'] = array_map(function ($j) {
    return $j->name . ' (' . $j->judge_id . ')';
}, $judges);

// Max possible (sum of that round's segment weights). Standalone per round —
// each round is scored on its own segment(s) only, and each round's weights are
// designed to total 100, so total/max*100 gives a clean 0-100 round score.
$round_max = [0 => 0.0, 1 => 0.0, 2 => 0.0];
foreach ($segments as $s) {
    $round_max[(int)$s->round_level] += (float)$s->weight;
}
$top5_max  = $round_max[1]; // Top 5 selection — Preliminary Q&A round only
$final_max = $round_max[2]; // Final standings — Final Round only

// Scale a round's weighted total onto a 0-100 score for the given round max.
function avg_score($total, $max)
{
    return $max > 0 ? ($total / $max) * 100 : 0.0;
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rounds &amp; Advancement | Binibining Mati</title>
    <link rel="icon" type="image/svg+xml" href="<?= base_url(); ?>assets/images/favicon.svg">
    <link href="<?= base_url(); ?>assets/css/bootstrap.min.css" rel="stylesheet">
    <link href="<?= base_url(); ?>assets/css/admin.css?v=8" rel="stylesheet">
    <style>
        :root {
            --gold: #b8860b;
            --border: #e5e7eb;
            --soft: #faf9f7;
            --text: #111827;
            --muted: #6b7280;
        }

        .rounds-wrap {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .round-card {
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 1.4rem;
        }

        .round-card-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: .75rem;
            margin-bottom: 1rem;
        }

        .round-card-head h2 {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text);
            margin: 0;
            display: flex;
            align-items: center;
            gap: .6rem;
        }

        .step-num {
            width: 26px;
            height: 26px;
            border-radius: 8px;
            background: var(--gold);
            color: #fff;
            font-size: .8rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }

        .round-card-head p {
            margin: .2rem 0 0;
            font-size: .82rem;
            color: var(--muted);
        }

        .rounds-table {
            width: 100%;
            border-collapse: collapse;
            font-size: .88rem;
        }

        .rounds-table thead th {
            background: var(--soft);
            padding: .65rem .8rem;
            font-size: .68rem;
            font-weight: 700;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: .04em;
            border-bottom: 1px solid var(--border);
            text-align: left;
        }

        .rounds-table tbody td {
            padding: .6rem .8rem;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
        }

        .rounds-table tbody tr.is-in {
            background: #fffbeb;
        }

        .rk-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            background: #1a1a2e;
            color: #fff;
            font-weight: 700;
            font-size: .72rem;
            border-radius: 6px;
        }

        .cand-no {
            font-weight: 700;
            color: var(--text);
        }

        .cand-name {
            color: var(--muted);
            font-size: .82rem;
        }

        .total-val {
            font-weight: 700;
            color: var(--gold);
            font-variant-numeric: tabular-nums;
        }

        .save-row {
            margin-top: 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .btn-save {
            background: var(--gold);
            color: #fff;
            border: none;
            padding: .6rem 1.4rem;
            border-radius: 10px;
            font-weight: 600;
            font-size: .85rem;
            cursor: pointer;
        }

        .btn-save:hover {
            background: #9a7009;
        }

        .pick-count {
            font-size: .82rem;
            color: var(--muted);
        }

        .empty-note {
            padding: 1.5rem;
            text-align: center;
            color: var(--muted);
            font-size: .88rem;
            background: var(--soft);
            border-radius: 10px;
        }

        .place-tag {
            display: inline-block;
            padding: .15rem .55rem;
            border-radius: 20px;
            font-size: .68rem;
            font-weight: 700;
            background: #fce7f3;
            color: #9d174d;
        }

        .place-tag.winner {
            background: #fef9c3;
            color: #854d0e;
        }

        .chk {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        .sign-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-top: .5rem;
        }

        .sign-box {
            text-align: center;
        }

        .sign-line {
            border-bottom: 1px solid #6b7280;
            height: 38px;
            margin-bottom: .4rem;
        }

        .sign-name {
            font-size: .8rem;
            font-weight: 600;
        }

        .sign-role {
            font-size: .7rem;
            color: #6b7280;
        }

        .btn-export {
            background: var(--gold);
            color: #fff;
            border: none;
            padding: .5rem 1rem;
            border-radius: 10px;
            font-size: .78rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: .4rem;
        }

        .btn-export:hover {
            background: #9a7009;
        }

        .btn-export.ghost {
            background: #fff;
            color: var(--gold);
            border: 1px solid var(--gold);
        }

        .btn-export.sm {
            padding: .35rem .7rem;
            font-size: .72rem;
        }

        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            body {
                background: #fff !important;
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                font-size: 11pt !important;
            }

            /* Faint pageant-logo watermark, centered on every printed page. */
            body::before {
                content: "";
                position: fixed;
                inset: 0;
                background: url('<?= base_url('assets/images/BB.MATI.png') ?>') center center / 60% auto no-repeat;
                opacity: .07;
                z-index: 9999;
                pointer-events: none;
            }

            .sidebar,
            .top-nav-bar,
            .btn-export,
            .btn-save,
            .chk,
            .alert-custom {
                display: none !important;
            }

            .main {
                margin-left: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
            }

            .content {
                padding: .5rem 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                margin: 0 !important;
            }

            .round-card {
                background: transparent !important;
                border: none !important;
                margin-bottom: 1.5rem !important;
                box-shadow: none !important;
                padding: 0 !important;
                width: 100% !important;
            }

            table,
            .rounds-table {
                width: 100% !important;
                border-collapse: collapse !important;
            }

            .rounds-table thead th:first-child,
            .rounds-table tbody td:first-child {
                display: none !important;
            }

            .rounds-table thead th {
                background: transparent !important;
                color: #333 !important;
                border-bottom: 1px solid #999 !important;
                border-top: none !important;
                font-size: 9pt !important;
                padding: .4rem .5rem !important;
            }

            .rounds-table tbody td {
                border-bottom: 1px solid #ddd !important;
                padding: .35rem .5rem !important;
                font-size: 10pt !important;
            }

            .rounds-table tbody tr.is-in {
                background: transparent !important;
            }

            .cand-no,
            .total-val,
            .rk-badge,
            .place-tag {
                color: #111 !important;
                font-size: 10pt !important;
            }

            .rk-badge {
                background: #1a1a2e !important;
                color: #fff !important;
                font-size: 8pt !important;
            }

            .place-tag {
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
            }

            .place-tag.winner {
                background: transparent !important;
                border-color: transparent !important;
            }

            .sign-grid {
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 1rem !important;
            }

            .sign-line {
                border-bottom: 1px solid #333 !important;
            }

            h1 {
                font-size: 14pt !important;
                color: #111 !important;
                margin-bottom: .3rem !important;
            }

            h2 {
                font-size: 12pt !important;
                color: #111 !important;
                margin-bottom: .5rem !important;
            }

            p,
            th,
            td {
                color: #111 !important;
            }

            .empty-note {
                color: #555 !important;
                background: transparent !important;
                border: none !important;
                padding: .5rem 0 !important;
            }

            .save-row {
                display: none !important;
            }

            .pick-count a {
                color: #111 !important;
                text-decoration: none !important;
            }

            .round-card-head h2 .step-num {
                font-size: 10pt !important;
            }
        }
    </style>
</head>

<body>
    <?php $this->load->view("includes/sidebar"); ?>

    <div class="main">
        <?php $this->load->view('includes/top-nav-bar', ['page_title' => 'Rounds & Advancement']); ?>

        <main class="content">
            <?php if ($this->session->flashdata("success")): ?>
                <div class="alert-custom alert-custom-success"><?= htmlspecialchars($this->session->flashdata("success")) ?></div>
            <?php endif; ?>

            <div style="margin-bottom:1.2rem">
                <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 .2rem">Rounds &amp; Advancement</h1>
                <p style="color:var(--muted);font-size:.9rem;margin:0">Standings are a guide — you choose who advances. Each round is scored on its own segment(s) only (not cumulative): Top 10 on the Preliminary, Top 5 on the Prelim Q&amp;A, winners on the Final Round.</p>
            </div>

            <div class="rounds-wrap">

                <!-- STEP 1: Select Top 10 -->
                <div class="round-card">
                    <div class="round-card-head">
                        <div>
                            <h2><span class="step-num">1</span> Select Top 10</h2>
                            <p>Ranked by weighted preliminary segments. Tick the candidates advancing to the Top 10.</p>
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                            <button class="btn-export sm" onclick="downloadPrelimPDF()">PDF</button>
                            <button class="btn-export sm ghost" onclick="downloadPrelimExcel()">Excel</button>
                            <button class="btn-export sm ghost" onclick="downloadPrelimDocx()">Word</button>
                        </div>
                    </div>

                    <form action="<?= site_url('admin/rounds_save') ?>" method="post">
                        <input type="hidden" name="flag" value="in_top10">
                        <?php if (empty($prelim)): ?>
                            <div class="empty-note">No preliminary scores recorded yet.</div>
                        <?php else: ?>
                            <div class="table-responsive-custom">
                                <table class="rounds-table">
                                    <thead>
                                        <tr>
                                            <th style="width:50px">Advance</th>
                                            <th style="width:60px">Rank</th>
                                            <th>Candidate</th>
                                            <th style="text-align:right">Preliminary Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php $rank = 1;
                                        foreach ($prelim as $c): ?>
                                            <tr class="<?= $c->in_top10 ? 'is-in' : '' ?>">
                                                <td><input class="chk t10-chk" type="checkbox" name="candidates[]" value="<?= $c->id ?>" <?= $c->in_top10 ? 'checked' : '' ?>></td>
                                                <td><?= num_badge($rank) ?></td>
                                                <td><span class="cand-no">#<?= htmlspecialchars($c->candidate_number) ?></span> <span class="cand-name"><?= htmlspecialchars($c->name) ?></span></td>
                                                <td style="text-align:right"><span class="total-val"><?= number_format($c->total, 2) ?></span></td>
                                            </tr>
                                        <?php $rank++;
                                        endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                            <div class="save-row">
                                <span class="pick-count"><span id="t10count"><?= count($top10_ids) ?></span> selected</span>
                                <button type="submit" class="btn-save">Save Top 10</button>
                            </div>
                        <?php endif; ?>
                    </form>
                </div>

                <!-- STEP 2: Select Top 5 -->
                <div class="round-card">
                    <div class="round-card-head">
                        <div>
                            <h2><span class="step-num">2</span> Select Top 5</h2>
                            <p>Top 10 only — ranked on the Preliminary Q&amp;A round score (this round only). Tick the Top 5.</p>
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                            <button class="btn-export sm" onclick="downloadTop10PDF()">PDF</button>
                            <button class="btn-export sm ghost" onclick="downloadTop10Excel()">Excel</button>
                            <button class="btn-export sm ghost" onclick="downloadTop10Docx()">Word</button>
                        </div>
                    </div>

                    <?php if (empty($top10_ids)): ?>
                        <div class="empty-note">Select the Top 10 first (Step 1) to open this round.</div>
                    <?php else: ?>
                        <form action="<?= site_url('admin/rounds_save') ?>" method="post">
                            <input type="hidden" name="flag" value="in_top5">
                            <div class="table-responsive-custom">
                                <table class="rounds-table">
                                    <thead>
                                        <tr>
                                            <th style="width:50px">Advance</th>
                                            <th style="width:60px">Rank</th>
                                            <th>Candidate</th>
                                            <th style="text-align:right">Q&amp;A Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php $rank = 1;
                                        foreach ($top10_standings as $c): ?>
                                            <tr class="<?= $c->in_top5 ? 'is-in' : '' ?>">
                                                <td><input class="chk t5-chk" type="checkbox" name="candidates[]" value="<?= $c->id ?>" <?= $c->in_top5 ? 'checked' : '' ?>></td>
                                                <td><?= num_badge($rank) ?></td>
                                                <td><span class="cand-no">#<?= htmlspecialchars($c->candidate_number) ?></span> <span class="cand-name"><?= htmlspecialchars($c->name) ?></span></td>
                                                <td style="text-align:right"><span class="total-val"><?= number_format(avg_score($c->total, $top5_max), 2) ?></span></td>
                                            </tr>
                                        <?php $rank++;
                                        endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                            <div class="save-row">
                                <span class="pick-count"><span id="t5count"><?= count($top5_ids) ?></span> selected</span>
                                <button type="submit" class="btn-save">Save Top 5</button>
                            </div>
                        </form>
                    <?php endif; ?>
                </div>

                <!-- STEP 3: Final standings -->
                <div class="round-card">
                    <div class="round-card-head">
                        <div>
                            <h2><span class="step-num">3</span> Final Standings &amp; Winners</h2>
                            <p>Top 5 only — ranked on the Final Round score (this round only). Highest = winner.</p>
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                            <button class="btn-export sm" onclick="downloadFinalPDF()">PDF</button>
                            <button class="btn-export sm ghost" onclick="downloadFinalExcel()">Excel</button>
                            <button class="btn-export sm ghost" onclick="downloadFinalDocx()">Word</button>
                        </div>
                    </div>

                    <?php if (empty($top5_ids)): ?>
                        <div class="empty-note">Select the Top 5 first (Step 2) to see final standings.</div>
                    <?php else:
                        $placements = [1 => 'BINIBINING MATI 2026', 2 => '1st BINIBINING KAUSWAGAN', 3 => '2nd BINIBINING KINAIYAHAN', 4 => '3rd BINIBINING KAHUPAYAN', 5 => '4th BINIBINING KABILIN'];
                    ?>
                        <div class="table-responsive-custom">
                            <table class="rounds-table">
                                <thead>
                                    <tr>
                                        <th style="width:60px">Rank</th>
                                        <th>Candidate</th>
                                        <th>Barangay</th>
                                        <th>Placement</th>
                                        <th style="text-align:right">Final Round Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $rank = 1;
                                    $prev = null;
                                    foreach ($final_standings as $c):
                                        $tie = $prev !== null && abs($c->total - $prev) < 0.001;
                                    ?>
                                        <tr class="<?= $rank === 1 ? 'is-in' : '' ?>">
                                            <td><?= num_badge($rank) ?></td>
                                            <td><span class="cand-no">#<?= htmlspecialchars($c->candidate_number) ?></span> <span class="cand-name"><?= htmlspecialchars($c->name) ?></span></td>
                                            <td><?= $c->barangay ? htmlspecialchars($c->barangay) : '<span style="color:var(--muted)">—</span>' ?></td>
                                            <td>
                                                <?php if ($tie): ?>
                                                    <span class="place-tag" style="background:#fee2e2;color:#991b1b">TIE — break manually</span>
                                                <?php else: ?>
                                                    <span class="place-tag <?= $rank === 1 ? 'winner' : '' ?>"><?= place_sup($placements[$rank] ?? ('Place ' . $rank)) ?></span>
                                                <?php endif; ?>
                                            </td>
                                            <td style="text-align:right"><span class="total-val"><?= number_format(avg_score($c->total, $final_max), 2) ?></span></td>
                                        </tr>
                                    <?php $prev = $c->total;
                                        $rank++;
                                    endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                        <div class="save-row">
                            <span class="pick-count">Full breakdown &amp; printable sheets are on the <a href="<?= site_url('judgedashboard/tabulation') ?>">Tabulation</a> page.</span>
                        </div>
                    <?php endif; ?>
                </div>

            </div>

            <!-- PER-SEGMENT SCORES: the 0-100 figures that feed each round's standing above -->
            <div style="margin:1.8rem 0 .8rem">
                <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 .25rem">Per-Segment Scores</h2>
                <p style="color:var(--muted);font-size:.85rem;margin:0">Each segment's score out of 100 (the judges' average). Each round above is ranked on its own segment(s) only: the Top 5 step uses the <strong>Preliminary Q&amp;A</strong> score, and the Final step uses the <strong>Final Round</strong> score — so those columns match the figures here exactly.</p>
            </div>

            <?php foreach ($segments as $seg):
                $rows = $segment_results[$seg->id] ?? []; ?>
                <div class="round-card">
                    <div class="round-card-head">
                        <div>
                            <h2 style="font-size:1rem"><?= htmlspecialchars($seg->name) ?></h2>
                            <p><?= $round_labels[(int)$seg->round_level] ?? 'Preliminary' ?> &middot; Weight <?= number_format((float)$seg->weight, 0) ?>%</p>
                        </div>
                    </div>
                    <?php if (empty($rows)): ?>
                        <div class="empty-note">No scores recorded for this segment yet.</div>
                    <?php else: ?>
                        <div class="table-responsive-custom">
                            <table class="rounds-table">
                                <thead>
                                    <tr>
                                        <th style="width:60px">Rank</th>
                                        <th>Candidate</th>
                                        <th>Barangay</th>
                                        <th style="text-align:right">Segment Score</th>
                                        <th style="text-align:right;width:80px">Judges</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $rank = 1;
                                    foreach ($rows as $r):
                                        $seg_score = $r->segment_max > 0 ? $r->avg_raw / $r->segment_max * 100 : 0; ?>
                                        <tr class="<?= $rank === 1 ? 'is-in' : '' ?>">
                                            <td><?= num_badge($rank) ?></td>
                                            <td><span class="cand-no">#<?= htmlspecialchars($r->candidate_number) ?></span> <span class="cand-name"><?= htmlspecialchars($r->name) ?></span></td>
                                            <td><?= $r->barangay ? htmlspecialchars($r->barangay) : '<span style="color:var(--muted)">—</span>' ?></td>
                                            <td style="text-align:right"><span class="total-val"><?= number_format($seg_score, 2) ?></span></td>
                                            <td style="text-align:right"><?= (int)$r->judge_count ?></td>
                                        </tr>
                                    <?php $rank++;
                                    endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>

            <!-- Verified by: Board of Judges -->
            <div class="round-card">
                <h2 style="font-size:1rem;font-weight:700;margin:0 0 1rem">Verified by: &mdash; Board of Judges</h2>
                <div class="sign-grid">
                    <?php foreach ($judges as $j): ?>
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <div class="sign-name">Judge's Name &amp; Signature</div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </main>
    </div>

    <script src="<?= base_url(); ?>assets/libs/pdfmake/pdfmake.min.js"></script>
    <script src="<?= base_url(); ?>assets/libs/pdfmake/vfs_fonts.js"></script>
    <script src="<?= base_url(); ?>assets/libs/xlsx/xlsx.full.min.js"></script>
    <script src="https://unpkg.com/docx@8.5.0/build/index.umd.js"></script>
    <script src="<?= base_url(); ?>assets/js/jquery-3.6.0.min.js"></script>
    <script>
        var RND = <?= json_encode($pdf, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
        var GOLD = '#b8860b';

        // Preload the pageant logo as a data URL so it can be embedded as a faint
        // watermark behind every exported PDF page (pdfMake needs base64 images).
        var LOGO_DATAURL = null,
            LOGO_RATIO = 1;
        (function() {
            var img = new Image();
            img.onload = function() {
                LOGO_RATIO = img.naturalHeight / img.naturalWidth || 1;
                try {
                    // Downscale to a watermark-sized canvas (the source art is huge);
                    // keeps the embedded PDF image small.
                    var cap = 600,
                        scale = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight)),
                        c = document.createElement('canvas');
                    c.width = Math.round(img.naturalWidth * scale);
                    c.height = Math.round(img.naturalHeight * scale);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    LOGO_DATAURL = c.toDataURL('image/png');
                } catch (e) {
                    LOGO_DATAURL = null;
                }
            };
            img.src = '<?= base_url('assets/images/BB.MATI.png') ?>';
        })();

        function wireCount(cls, out) {
            var boxes = document.querySelectorAll(cls);
            var el = document.getElementById(out);

            function upd() {
                if (!el) return;
                el.innerText = document.querySelectorAll(cls + ':checked').length;
            }
            boxes.forEach(function(b) {
                b.addEventListener('change', upd);
            });
        }
        wireCount('.t10-chk', 't10count');
        wireCount('.t5-chk', 't5count');

        // ----- PDF helpers -----
        function pdfHeader(title, subtitle) {
            return [{
                    text: RND.event,
                    style: 'evt'
                },
                {
                    text: title,
                    style: 'h1'
                },
                subtitle ? {
                    text: subtitle,
                    style: 'sub'
                } : {},
                {
                    text: 'Generated: ' + RND.generated,
                    style: 'meta'
                },
                {
                    canvas: [{
                        type: 'line',
                        x1: 0,
                        y1: 5,
                        x2: 515,
                        y2: 5,
                        lineWidth: 1,
                        lineColor: GOLD
                    }],
                    margin: [0, 4, 0, 12]
                }
            ];
        }

        function buildPdf(content, filename) {
            if (typeof pdfMake === 'undefined') {
                alert('PDF library not loaded.');
                return;
            }
            var doc = {
                pageSize: 'A4',
                pageMargins: [40, 40, 40, 40],
                background: function(currentPage, pageSize) {
                    if (!LOGO_DATAURL) return null;
                    var w = 360,
                        h = w * LOGO_RATIO;
                    return {
                        image: LOGO_DATAURL,
                        width: w,
                        opacity: 0.06,
                        absolutePosition: {
                            x: (pageSize.width - w) / 2,
                            y: (pageSize.height - h) / 2
                        }
                    };
                },
                content: content,
                styles: {
                    evt: {
                        fontSize: 11,
                        bold: true,
                        color: GOLD
                    },
                    h1: {
                        fontSize: 16,
                        bold: true,
                        margin: [0, 2, 0, 0]
                    },
                    sub: {
                        fontSize: 10,
                        color: '#444',
                        margin: [0, 2, 0, 0]
                    },
                    meta: {
                        fontSize: 8,
                        color: '#888',
                        margin: [0, 4, 0, 0]
                    },
                    h2: {
                        fontSize: 11,
                        bold: true,
                        margin: [0, 8, 0, 4]
                    },
                    th: {
                        fontSize: 8,
                        bold: true,
                        fillColor: '#faf9f7',
                        color: '#444'
                    }
                },
                defaultStyle: {
                    fontSize: 9
                }
            };
            pdfMake.createPdf(doc).download(filename + '.pdf');
        }

        function simpleTable(rows, cols, widths) {
            var body = [cols.map(function(c) {
                return {
                    text: c,
                    style: 'th'
                };
            })];
            rows.forEach(function(r, i) {
                var row = [String(i + 1), '#' + r.no, r.name, String(r.total)];
                body.push(row.map(function(v) {
                    return {
                        text: v,
                        bold: false
                    };
                }));
            });
            return {
                table: {
                    headerRows: 1,
                    widths: widths || [30, 50, '*', 80],
                    body: body
                },
                layout: 'lightHorizontalLines',
                fontSize: 9,
                margin: [0, 0, 0, 12]
            };
        }

        function finalTable(rows) {
            var body = [
                [{
                    text: 'Rank',
                    style: 'th'
                }, {
                    text: 'Candidate',
                    style: 'th'
                }, {
                    text: 'Name',
                    style: 'th'
                }, {
                    text: 'Barangay',
                    style: 'th'
                }, {
                    text: 'Placement',
                    style: 'th'
                }, {
                    text: 'Final Round Score',
                    style: 'th'
                }]
            ];
            rows.forEach(function(r, i) {
                body.push([
                    String(i + 1), '#' + r.no, r.name, r.barangay || '—', r.place,
                    {
                        text: String(r.total),
                        bold: true,
                        color: GOLD
                    }
                ]);
            });
            return {
                table: {
                    headerRows: 1,
                    widths: [28, 42, '*', 90, 95, 50],
                    body: body
                },
                layout: 'lightHorizontalLines',
                fontSize: 9,
                margin: [0, 0, 0, 12]
            };
        }

        function signatoryBlock(names) {
            if (!names || !names.length) return {};
            var cols = [];
            names.forEach(function(n) {
                cols.push({
                    width: '*',
                    stack: [{
                        text: '________________________________________',
                        margin: [0, 18, 0, 2]
                    }, {
                        text: "Judge's Name & Signature",
                        fontSize: 8,
                        bold: true
                    }],
                    alignment: 'center'
                });
            });
            var rows = [];
            for (var i = 0; i < cols.length; i += 3) {
                rows.push({
                    columns: cols.slice(i, i + 3),
                    columnGap: 16,
                    margin: [0, 0, 0, 6]
                });
            }
            return {
                stack: [{
                    text: 'Verified by:',
                    style: 'h2',
                    margin: [0, 14, 0, 4]
                }].concat(rows)
            };
        }

        function downloadPrelimPDF() {
            var content = pdfHeader('SELECT TOP 10', 'Ranked by weighted preliminary segments');
            if (!RND.prelim || !RND.prelim.length) {
                content.push({
                    text: 'No preliminary scores recorded yet.',
                    italics: true
                });
            } else {
                content.push(simpleTable(RND.prelim, ['Rank', 'No.', 'Candidate', 'Preliminary Score']));
            }
            content.push(signatoryBlock(RND.judges));
            buildPdf(content, 'Select-Top10');
        }

        function downloadTop10PDF() {
            var content = pdfHeader('SELECT TOP 5', 'Top 10 only — Preliminary Q&A round score');
            if (!RND.top10 || !RND.top10.length) {
                content.push({
                    text: 'No Top 10 scores recorded yet.',
                    italics: true
                });
            } else {
                content.push(simpleTable(RND.top10, ['Rank', 'No.', 'Candidate', 'Q&A Score']));
            }
            content.push(signatoryBlock(RND.judges));
            buildPdf(content, 'Select-Top5');
        }

        function downloadFinalPDF() {
            var content = pdfHeader('FINAL STANDINGS & WINNERS', 'Top 5 only — Final Round score');
            if (!RND.final || !RND.final.length) {
                content.push({
                    text: 'No final standings recorded yet.',
                    italics: true
                });
            } else {
                content.push(finalTable(RND.final));
            }
            content.push(signatoryBlock(RND.judges));
            buildPdf(content, 'Final-Standings');
        }

        // ----- Excel helpers -----
        function downloadPrelimExcel() {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded.');
                return;
            }
            var wb = XLSX.utils.book_new();
            wb.Props = {
                Title: 'Select Top 10 - ' + RND.event,
                CreatedDate: new Date()
            };
            var data = [
                ['Rank', 'Candidate No.', 'Name', 'Preliminary Score', 'Advanced']
            ];
            RND.prelim.forEach(function(r, i) {
                data.push([i + 1, '#' + r.no, r.name, r.total, r.in ? 'Yes' : 'No']);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Top 10 Selection');
            XLSX.writeFile(wb, 'Select-Top10.xlsx');
        }

        function downloadTop10Excel() {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded.');
                return;
            }
            var wb = XLSX.utils.book_new();
            wb.Props = {
                Title: 'Select Top 5 - ' + RND.event,
                CreatedDate: new Date()
            };
            var data = [
                ['Rank', 'Candidate No.', 'Name', 'Q&A Score', 'Advanced']
            ];
            RND.top10.forEach(function(r, i) {
                data.push([i + 1, '#' + r.no, r.name, r.total, r.in ? 'Yes' : 'No']);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Top 5 Selection');
            XLSX.writeFile(wb, 'Select-Top5.xlsx');
        }

        function downloadFinalExcel() {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded.');
                return;
            }
            var wb = XLSX.utils.book_new();
            wb.Props = {
                Title: 'Final Standings - ' + RND.event,
                CreatedDate: new Date()
            };
            var data = [
                ['Rank', 'Candidate No.', 'Name', 'Barangay', 'Placement', 'Final Round Score']
            ];
            RND.final.forEach(function(r, i) {
                data.push([i + 1, '#' + r.no, r.name, r.barangay || '', r.place, r.total]);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Final Standings');
            XLSX.writeFile(wb, 'Final-Standings.xlsx');
        }

        // ----- Word helpers -----
        async function downloadPrelimDocx() {
            if (typeof docx === 'undefined') {
                alert('DOCX library not loaded.');
                return;
            }
            const {
                Document,
                Packer,
                Paragraph,
                Table,
                TableCell,
                TableRow,
                TextRun,
                WidthType,
                AlignmentType,
                HeadingLevel
            } = docx;

            function cell(text, opts) {
                opts = opts || {};
                return new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: String(text),
                            bold: !!opts.bold,
                            size: 20
                        })]
                    })],
                    width: {
                        size: opts.width || 20,
                        type: WidthType.PERCENTAGE
                    }
                });
            }

            function row(cells) {
                return new TableRow({
                    children: cells
                });
            }
            var children = [];
            children.push(new Paragraph({
                text: RND.event,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Select Top 10',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Generated: ' + RND.generated,
                alignment: AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));
            var rows = [row([cell('Rank', {
                bold: true,
                width: 10
            }), cell('No.', {
                bold: true,
                width: 15
            }), cell('Candidate', {
                bold: true,
                width: 40
            }), cell('Preliminary Score', {
                bold: true,
                width: 20
            }), cell('Advanced', {
                bold: true,
                width: 15
            })])];
            RND.prelim.forEach(function(r, i) {
                rows.push(row([cell(String(i + 1)), cell('#' + r.no), cell(r.name), cell(String(r.total)), cell(r.in ? 'Yes' : 'No')]));
            });
            children.push(new Table({
                rows: rows,
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                }
            }));
            if (RND.judges && RND.judges.length) {
                children.push(new Paragraph({
                    text: '',
                    spacing: {
                        after: 200
                    }
                }));
                children.push(new Paragraph({
                    text: 'Verified by:',
                    heading: HeadingLevel.HEADING_2
                }));
                var srows = [];
                RND.judges.forEach(function(j) {
                    srows.push(row([cell('________________________________________', {
                        width: 33
                    }), cell("Judge's Name & Signature", {
                        width: 34
                    }), cell('Date: _________', {
                        width: 33
                    })]));
                });
                children.push(new Table({
                    rows: srows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    }
                }));
            }
            var doc = new Document({
                sections: [{
                    properties: {},
                    children: children
                }]
            });
            var blob = await Packer.toBlob(doc);
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Select-Top10.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        async function downloadTop10Docx() {
            if (typeof docx === 'undefined') {
                alert('DOCX library not loaded.');
                return;
            }
            const {
                Document,
                Packer,
                Paragraph,
                Table,
                TableCell,
                TableRow,
                TextRun,
                WidthType,
                AlignmentType,
                HeadingLevel
            } = docx;

            function cell(text, opts) {
                opts = opts || {};
                return new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: String(text),
                            bold: !!opts.bold,
                            size: 20
                        })]
                    })],
                    width: {
                        size: opts.width || 20,
                        type: WidthType.PERCENTAGE
                    }
                });
            }

            function row(cells) {
                return new TableRow({
                    children: cells
                });
            }
            var children = [];
            children.push(new Paragraph({
                text: RND.event,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Select Top 5',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Generated: ' + RND.generated,
                alignment: AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));
            var rows = [row([cell('Rank', {
                bold: true,
                width: 10
            }), cell('No.', {
                bold: true,
                width: 15
            }), cell('Candidate', {
                bold: true,
                width: 40
            }), cell('Q&A Score', {
                bold: true,
                width: 20
            }), cell('Advanced', {
                bold: true,
                width: 15
            })])];
            RND.top10.forEach(function(r, i) {
                rows.push(row([cell(String(i + 1)), cell('#' + r.no), cell(r.name), cell(String(r.total)), cell(r.in ? 'Yes' : 'No')]));
            });
            children.push(new Table({
                rows: rows,
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                }
            }));
            if (RND.judges && RND.judges.length) {
                children.push(new Paragraph({
                    text: '',
                    spacing: {
                        after: 200
                    }
                }));
                children.push(new Paragraph({
                    text: 'Verified by:',
                    heading: HeadingLevel.HEADING_2
                }));
                var srows = [];
                RND.judges.forEach(function(j) {
                    srows.push(row([cell('________________________________________', {
                        width: 33
                    }), cell("Judge's Name & Signature", {
                        width: 34
                    }), cell('Date: _________', {
                        width: 33
                    })]));
                });
                children.push(new Table({
                    rows: srows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    }
                }));
            }
            var doc = new Document({
                sections: [{
                    properties: {},
                    children: children
                }]
            });
            var blob = await Packer.toBlob(doc);
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Select-Top5.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        async function downloadFinalDocx() {
            if (typeof docx === 'undefined') {
                alert('DOCX library not loaded.');
                return;
            }
            const {
                Document,
                Packer,
                Paragraph,
                Table,
                TableCell,
                TableRow,
                TextRun,
                WidthType,
                AlignmentType,
                HeadingLevel
            } = docx;

            function cell(text, opts) {
                opts = opts || {};
                return new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: String(text),
                            bold: !!opts.bold,
                            size: 20
                        })]
                    })],
                    width: {
                        size: opts.width || 20,
                        type: WidthType.PERCENTAGE
                    }
                });
            }

            function row(cells) {
                return new TableRow({
                    children: cells
                });
            }
            var children = [];
            children.push(new Paragraph({
                text: RND.event,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Final Standings & Winners',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Generated: ' + RND.generated,
                alignment: AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));
            var rows = [row([cell('Rank', {
                bold: true,
                width: 8
            }), cell('No.', {
                bold: true,
                width: 10
            }), cell('Candidate', {
                bold: true,
                width: 27
            }), cell('Barangay', {
                bold: true,
                width: 22
            }), cell('Placement', {
                bold: true,
                width: 18
            }), cell('Final Round Score', {
                bold: true,
                width: 15
            })])];
            RND.final.forEach(function(r, i) {
                rows.push(row([cell(String(i + 1)), cell('#' + r.no), cell(r.name), cell(r.barangay || '—'), cell(r.place), cell(String(r.total))]));
            });
            children.push(new Table({
                rows: rows,
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                }
            }));
            if (RND.judges && RND.judges.length) {
                children.push(new Paragraph({
                    text: '',
                    spacing: {
                        after: 200
                    }
                }));
                children.push(new Paragraph({
                    text: 'Verified by:',
                    heading: HeadingLevel.HEADING_2
                }));
                var srows = [];
                RND.judges.forEach(function(j) {
                    srows.push(row([cell('________________________________________', {
                        width: 33
                    }), cell("Judge's Name & Signature", {
                        width: 34
                    }), cell('Date: _________', {
                        width: 33
                    })]));
                });
                children.push(new Table({
                    rows: srows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    }
                }));
            }
            var doc = new Document({
                sections: [{
                    properties: {},
                    children: children
                }]
            });
            var blob = await Packer.toBlob(doc);
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Final-Standings.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    </script>
</body>

</html>