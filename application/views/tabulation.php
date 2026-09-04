<?php
$current_page = 'tabulation';
$round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];

/**
 * Candidate label used by on-screen tables and exported official sheets.
 */
function candidate_label_text($candidate)
{
    $number = trim((string)($candidate->candidate_number ?? $candidate->no ?? ''));
    $name = trim((string)($candidate->name ?? ''));
    $label = $number !== '' ? '#' . $number : '#-';
    if ($name !== '') {
        $label .= ' - ' . $name;
    }
    return $label;
}

function candidate_label_html($candidate)
{
    return htmlspecialchars(candidate_label_text($candidate));
}

function barangay_text($candidate)
{
    $barangay = trim((string)($candidate->barangay ?? ''));
    return $barangay !== '' ? $barangay : '—';
}

function barangay_html($candidate)
{
    return htmlspecialchars(barangay_text($candidate));
}

/**
 * Render a ranked standings table body. $advanced_ids highlights/marks advancers.
 * Score column behaviour, given $max_weight (sum of the round's segment weights):
 *   - $max_weight <= 0           -> raw weighted total only
 *   - $max_weight > 0, $avg_only -> score out of 100 only (total / max_weight * 100)
 *   - $max_weight > 0            -> raw weighted total + score-out-of-100 columns
 */
function rank_rows($list, $advanced_ids = [], $max_weight = 0, $avg_only = false)
{
    $rank = 1;
    $prev = null;
    $html = '';
    foreach ($list as $c) {
        $tie = $prev !== null && abs($c->total - $prev) < 0.001;
        $disp = $tie ? '=' : $rank;
        $is_adv = in_array((int)$c->id, $advanced_ids, true);
        $cls = $rank === 1 ? 'rank-1' : ($rank <= 3 ? 'rank-top' : '');
        if ($is_adv) $cls .= ' is-adv';
        $avg = $max_weight > 0 ? $c->total / $max_weight * 100 : 0;
        $html .= '<tr class="' . trim($cls) . '">';
        $html .= '<td><span class="rank-badge">' . $disp . '</span></td>';
        $html .= '<td><span class="candidate-num">' . candidate_label_html($c) . '</span></td>';
        $html .= '<td>' . barangay_html($c) . '</td>';
        if ($max_weight > 0 && $avg_only) {
            $html .= '<td class="score-val total">' . number_format($avg, 2) . '</td>';
        } else {
            $html .= '<td class="score-val total">' . number_format($c->total, 2) . '</td>';
            if ($max_weight > 0) {
                $html .= '<td class="score-val">' . number_format($avg, 2) . '</td>';
            }
        }
        $html .= '</tr>';
        $prev = $c->total;
        $rank++;
    }
    return $html;
}

/** Superscript a leading ordinal (1st, 2nd...) in a placement title for on-screen display. */
function place_sup($name)
{
    return preg_replace('/^(\d+)(st|nd|rd|th)\b/i', '$1<sup>$2</sup>', $name);
}

// ---- Build data payload for client-side PDF generation ----
$pdf = [
    'event' => $event->name ?? 'Binibining Mati 2026',
    'generated' => date('M j, Y g:i A'),
    'segments' => [],
    'grand' => [],
    'winners' => [],
];
foreach ($segments as $seg) {
    $rows = [];
    foreach (($segment_results[$seg->id] ?? []) as $r) {
        $rows[] = [
            'no' => $r->candidate_number,
            'name' => $r->name ?? '',
            'barangay' => $r->barangay ?? '',
            'candidate' => candidate_label_text($r),
            'score' => $r->segment_max > 0 ? round($r->avg_raw / $r->segment_max * 100, 2) : 0,
            'avg' => round($r->avg_raw, 2),
            'max' => round($r->segment_max, 2),
            'weighted' => round($r->weighted, 2),
            'judges' => (int)$r->judge_count,
        ];
    }
    $jn = array_map(function ($j) {
        return $j->name . ' (' . $j->judge_id . ')';
    }, $segment_judges[$seg->id] ?? []);
    $pdf['segments'][] = [
        'name' => $seg->name,
        'weight' => $seg->weight,
        'round' => $round_labels[(int)($seg->round_level ?? 0)] ?? 'Preliminary',
        'rows' => $rows,
        'judges' => $jn,
    ];
}
// Max possible per round block (sum of that block's segment weights). Each block
// is designed to total 100, so total/max*100 is a clean average out of 100.
$round_max = [0 => 0.0, 1 => 0.0, 2 => 0.0];
foreach ($segments as $s) {
    $round_max[(int)($s->round_level ?? 0)] += (float)$s->weight;
}
// Standalone per round — each round is scored on its own segment(s) only (no
// carry-forward). Each round's weights total 100, so total/max*100 is a 0-100 score.
$top10_max = $round_max[1];                                // Top 5 Selection — Preliminary Q&A round only
$final_max = $round_max[2];                                // Final Standings — Final Round only
$grand_max = $round_max[0] + $round_max[1] + $round_max[2]; // Grand Total — informational combined view only

$avg_of = function ($total, $max) {
    return $max > 0 ? round($total / $max * 100, 2) : 0;
};

foreach ($prelim as $c) {
    $pdf['prelim'][] = ['no' => $c->candidate_number, 'name' => $c->name ?? '', 'barangay' => $c->barangay ?? '', 'candidate' => candidate_label_text($c), 'total' => round($c->total, 2)];
}
foreach ($top10_standings as $c) {
    $pdf['top10'][] = ['no' => $c->candidate_number, 'name' => $c->name ?? '', 'barangay' => $c->barangay ?? '', 'candidate' => candidate_label_text($c), 'avg' => $avg_of($c->total, $top10_max)];
}
foreach ($grand as $c) {
    $pdf['grand'][] = [
        'no' => $c->candidate_number,
        'name' => $c->name ?? '',
        'barangay' => $c->barangay ?? '',
        'candidate' => candidate_label_text($c),
        'total' => round($c->total, 2),
        'avg' => $avg_of($c->total, $grand_max),
    ];
}
// Official placement titles. Rank 1 = the crown (no ordinal); ranks 2-5 are the
// runner-up titles, prefixed 1st-4th. place_sup() superscripts the ordinal on screen.
$place_names = [
    1 => 'BINIBINING MATI 2026',
    2 => '1st BINIBINING KAUSWAGAN',
    3 => '2nd BINIBINING KINAIYAHAN',
    4 => '3rd BINIBINING KAHUPAYAN',
    5 => '4th BINIBINING KABILIN',
];
$wp = 1;
foreach ($final_standings as $c) {
    $pdf['winners'][] = ['no' => $c->candidate_number, 'name' => $c->name ?? '', 'barangay' => $c->barangay ?? '', 'candidate' => candidate_label_text($c), 'avg' => $avg_of($c->total, $final_max), 'place' => $place_names[$wp] ?? ('Place ' . $wp)];
    $wp++;
}
$pdf['all_judges'] = array_map(function ($j) {
    return $j->name . ' (' . $j->judge_id . ')';
}, $judges);
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tabulation &amp; Score Sheets | Binibining Mati</title>
    <link rel="icon" type="image/svg+xml" href="<?= base_url(); ?>assets/images/favicon.svg">
    <link href="<?= base_url(); ?>assets/css/bootstrap.min.css" rel="stylesheet">
    <link href="<?= base_url(); ?>assets/css/admin.css?v=8" rel="stylesheet">
    <style>
        :root {
            --bg: #f3f0eb;
            --card: #fff;
            --text: #111827;
            --text-secondary: #6b7280;
            --gold: #b8860b;
            --gold-hover: #9a7009;
            --soft: #faf9f7;
            --border: #e5e7eb;
        }

        body {
            background: var(--bg);
            font-family: 'Karla', sans-serif;
            min-height: 100vh;
        }

        .judge-header {
            padding: 1.2rem 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #fff;
        }

        .judge-header-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--text);
        }

        .judge-header-meta {
            font-size: .78rem;
            color: var(--text-secondary);
        }

        .tab-wrap {
            padding: 1.5rem;
            max-width: 1200px;
            margin: 0 auto;
        }

        .tab-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .tab-header h1 {
            font-size: 1.35rem;
            font-weight: 700;
            margin: 0 0 .25rem;
        }

        .tab-header p {
            color: var(--text-secondary);
            font-size: .88rem;
            margin: 0;
        }

        .btn-pdf {
            background: var(--gold);
            color: #fff;
            border: none;
            padding: .6rem 1.2rem;
            border-radius: 10px;
            font-size: .82rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: .45rem;
        }

        .btn-pdf:hover {
            background: var(--gold-hover);
        }

        .btn-pdf.sm {
            padding: .4rem .8rem;
            font-size: .74rem;
        }

        .btn-pdf.ghost {
            background: #fff;
            color: var(--gold);
            border: 1px solid var(--gold);
        }

        .section-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 1.4rem;
            margin-bottom: 1.5rem;
        }

        .section-card h2 {
            font-size: 1rem;
            font-weight: 700;
            margin: 0 0 1rem;
            display: flex;
            align-items: center;
            gap: .6rem;
        }

        .seg-meta {
            margin-left: auto;
            font-size: .72rem;
            color: var(--text-secondary);
            font-weight: 500;
            display: flex;
            gap: .8rem;
            align-items: center;
        }

        .tab-table {
            width: 100%;
            border-collapse: collapse;
            font-size: .85rem;
        }

        .tab-table thead th {
            background: var(--soft);
            padding: .7rem .8rem;
            font-size: .67rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: .04em;
            border-bottom: 1px solid var(--border);
            text-align: center;
            white-space: nowrap;
        }

        .tab-table thead th:first-child {
            text-align: left;
        }

        .tab-table thead th:nth-child(2),
        .tab-table thead th:nth-child(3),
        .tab-table tbody td:nth-child(2),
        .tab-table tbody td:nth-child(3) {
            text-align: left;
        }

        .tab-table tbody td {
            padding: .55rem .8rem;
            border-bottom: 1px solid #f1f5f9;
            text-align: center;
        }

        .tab-table tbody td:first-child {
            text-align: left;
        }

        .tab-table tbody tr.rank-1 {
            background: #fffbeb;
        }

        .tab-table tbody tr.is-adv {
            background: #ecfdf5;
        }

        .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 26px;
            height: 26px;
            padding: 0 .4rem;
            background: #1a1a2e;
            color: #fff;
            font-weight: 700;
            font-size: .72rem;
            border-radius: 6px;
        }

        .candidate-num {
            font-weight: 700;
            color: var(--text);
        }

        .score-val {
            font-variant-numeric: tabular-nums;
            font-weight: 600;
        }

        .score-val.total {
            color: var(--gold);
        }

        .adv-tag {
            display: inline-block;
            font-size: .62rem;
            font-weight: 700;
            color: #059669;
            background: #d1fae5;
            border-radius: 10px;
            padding: .1rem .45rem;
            margin-left: .35rem;
            vertical-align: middle;
        }

        .grand-total-card {
            background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
            color: #fff;
            border: none;
        }

        .grand-total-card h2 {
            color: #fff;
        }

        .grand-total-card .tab-table thead th {
            background: rgba(255, 255, 255, .08);
            color: #a0a0b0;
            border-color: rgba(255, 255, 255, .1);
        }

        .grand-total-card .tab-table tbody td {
            border-color: rgba(255, 255, 255, .06);
        }

        .grand-total-card .candidate-num {
            color: #fff;
        }

        .grand-total-card .tab-table tbody tr.rank-1 .candidate-num,
        .grand-total-card .tab-table tbody tr.rank-top .candidate-num {
            color: #fff;
        }

        .grand-total-card .tab-table tbody tr.rank-1 {
            background: rgba(255, 255, 255, .06);
        }

        .grand-total-card .tab-table tbody tr.is-adv {
            background: rgba(16, 185, 129, .12);
        }

        .grand-total-card .tab-table tbody tr:hover {
            background: rgba(255, 255, 255, .1);
        }

        .grand-total-card .score-val.total {
            color: #fbbf24;
        }

        .grand-total-card .rank-badge {
            background: var(--gold);
            color: #1a1a2e;
        }

        .tie-banner {
            background: #fef3c7;
            border: 1px solid #fcd34d;
            color: #92400e;
            padding: .6rem 1rem;
            border-radius: 8px;
            font-size: .82rem;
            font-weight: 500;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: .5rem;
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
            border-bottom: 1px solid var(--text-secondary);
            height: 38px;
            margin-bottom: .4rem;
        }

        .sign-name {
            font-size: .8rem;
            font-weight: 600;
        }

        .sign-role {
            font-size: .7rem;
            color: var(--text-secondary);
        }

        .winner-card {
            background: #fffaf0;
            border: 1px solid #f3d27a;
        }

        .place-tag {
            display: inline-block;
            padding: .15rem .55rem;
            border-radius: 20px;
            font-size: .66rem;
            font-weight: 700;
            background: #fce7f3;
            color: #9d174d;
        }

        .place-tag.winner {
            background: #fde68a;
            color: #854d0e;
        }

        .empty-note {
            color: var(--text-secondary);
            padding: 1.4rem;
            text-align: center;
            font-size: .88rem;
        }

        .round-pill {
            display: inline-block;
            padding: .15rem .5rem;
            border-radius: 20px;
            font-size: .64rem;
            font-weight: 700;
        }

        .round-pill.round-0 {
            background: #eef2ff;
            color: #4338ca;
        }

        .round-pill.round-1 {
            background: #fef3c7;
            color: #92400e;
        }

        .round-pill.round-2 {
            background: #fce7f3;
            color: #9d174d;
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
            .mobile-menu-btn,
            .btn-pdf,
            .btn-export,
            .judge-header a,
            .tab-header a,
            .tab-header button,
            .tab-header .seg-meta {
                display: none !important;
            }

            .main {
                margin-left: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
            }

            .tab-wrap {
                padding: .5rem 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                margin: 0 !important;
            }

            .section-card {
                background: transparent !important;
                border: none !important;
                margin-bottom: 1.5rem !important;
                box-shadow: none !important;
                padding: 0 !important;
                width: 100% !important;
            }

            .grand-total-card {
                background: transparent !important;
                color: #111 !important;
                border: none !important;
            }

            .grand-total-card h2 {
                color: #111 !important;
            }

            .grand-total-card .tab-table thead th {
                background: transparent !important;
                color: #333 !important;
                border-color: transparent !important;
            }

            .grand-total-card .tab-table tbody td {
                border-color: transparent !important;
                border-bottom: 1px solid #ddd !important;
            }

            .grand-total-card .candidate-num,
            .grand-total-card .tab-table tbody tr.rank-1 .candidate-num,
            .grand-total-card .tab-table tbody tr.rank-top .candidate-num {
                color: #111 !important;
            }

            .grand-total-card .tab-table tbody tr.rank-1,
            .grand-total-card .tab-table tbody tr.is-adv {
                background: transparent !important;
            }

            .grand-total-card .score-val.total {
                color: #111 !important;
                font-weight: 700 !important;
            }

            .grand-total-card .rank-badge {
                background: #1a1a2e !important;
                color: #fff !important;
            }

            table,
            .tab-table {
                width: 100% !important;
                border-collapse: collapse !important;
            }

            .tab-table thead th {
                background: transparent !important;
                color: #333 !important;
                border-bottom: 1px solid #999 !important;
                border-top: none !important;
                font-size: 9pt !important;
                padding: .4rem .5rem !important;
            }

            .tab-table tbody td {
                border-bottom: 1px solid #ddd !important;
                padding: .35rem .5rem !important;
                font-size: 10pt !important;
            }

            .tab-table tbody tr.rank-1,
            .tab-table tbody tr.is-adv {
                background: transparent !important;
            }

            .candidate-num {
                color: #111 !important;
                font-size: 10pt !important;
            }

            .score-val.total {
                color: #111 !important;
                font-weight: 700 !important;
                font-size: 10pt !important;
            }

            .rank-badge {
                background: #1a1a2e !important;
                color: #fff !important;
                font-size: 8pt !important;
            }

            .place-tag {
                border: none !important;
                background: transparent !important;
                color: #111 !important;
                font-weight: 700 !important;
                font-size: 9pt !important;
                padding: 0 !important;
            }

            .winner-card {
                background: transparent !important;
                border: none !important;
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
            td,
            .judge-header-title {
                color: #111 !important;
            }

            .tab-header p {
                font-size: 10pt !important;
            }

            .empty-note {
                color: #555 !important;
                background: transparent !important;
                padding: .5rem 0 !important;
            }

            .tie-banner {
                border: none !important;
                background: transparent !important;
                padding-left: 0 !important;
                font-size: 10pt !important;
            }

            .seg-meta {
                color: #666 !important;
                font-size: 9pt !important;
            }

            .section-card h2 .seg-meta {
                display: none !important;
            }
        }
    </style>
</head>

<body>
    <?php $this->load->view("includes/sidebar"); ?>

    <div class="main">
        <?php if ($is_admin): ?>
            <?php $this->load->view('includes/top-nav-bar', ['page_title' => 'Tabulation']); ?>
        <?php else: ?>
            <header class="judge-header">
                <div style="display:flex;align-items:center">
                    <button class="mobile-menu-btn" onclick="toggleMobileSidebar()" aria-label="Menu">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div>
                        <div class="judge-header-title">Tabulation &amp; Score Sheets</div>
                        <div class="judge-header-meta">Binibining Mati 2026</div>
                    </div>
                </div>
                <a href="<?= site_url('judgedashboard') ?>" style="font-size:.82rem;color:var(--text-secondary);text-decoration:none;">&larr; Dashboard</a>
            </header>
        <?php endif; ?>

        <main class="tab-wrap">
            <div class="tab-header">
                <div>
                    <h1>Tabulation &amp; e-Score Sheets</h1>
                    <p>Each round is scored on its own segment(s) only (not cumulative): Top 10 on the Preliminary, Top 5 on the Prelim Q&amp;A, winners on the Final Round. Barangay is shown in its own column.</p>
                </div>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
                    <a class="btn-pdf ghost" href="<?= site_url('judgedashboard/judge_results') ?>" style="text-decoration:none">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 11H3v10h6V11Z" />
                            <path d="M15 7H9v14h6V7Z" />
                            <path d="M21 3h-6v18h6V3Z" />
                        </svg>
                        Per-Judge Results
                    </a>
                    <button class="btn-pdf" onclick="downloadFullPDF()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        PDF
                    </button>
                    <button class="btn-pdf ghost" onclick="downloadExcel()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        Excel
                    </button>
                    <button class="btn-pdf ghost" onclick="downloadDocx()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Word
                    </button>
                </div>
            </div>

            <!-- ===================== ROUND STANDINGS ===================== -->
            <div class="section-card">
                <h2>
                    <span class="round-pill round-0">Step 1</span> Top 10 Selection
                    <span class="seg-meta">Weighted preliminary total &mdash; advancers highlighted</span>
                    <span class="seg-meta">
                        <button class="btn-pdf sm ghost" onclick="downloadPrelimPDF()">PDF</button>
                    </span>
                </h2>
                <?php if (empty($prelim)): ?>
                    <div class="empty-note">No preliminary scores recorded yet.</div>
                <?php else: ?>
                    <table class="tab-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Candidate</th>
                                <th>Barangay</th>
                                <th>Preliminary Score</th>
                            </tr>
                        </thead>
                        <tbody><?= rank_rows($prelim, $top10_ids) ?></tbody>
                    </table>
                <?php endif; ?>
            </div>

            <?php if (!empty($top10_ids)): ?>
                <div class="section-card">
                    <h2>
                        <span class="round-pill round-1">Step 2</span> Top 5 Selection
                        <span class="seg-meta">Preliminary Q&amp;A round only &mdash; Top 10 candidates</span>
                        <span class="seg-meta">
                            <button class="btn-pdf sm ghost" onclick="downloadTop10PDF()">PDF</button>
                        </span>
                    </h2>
                    <table class="tab-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Candidate</th>
                                <th>Barangay</th>
                                <th>Q&amp;A Score</th>
                            </tr>
                        </thead>
                        <tbody><?= rank_rows($top10_standings, $top5_ids, $top10_max, true) ?></tbody>
                    </table>
                </div>
            <?php endif; ?>

            <?php if (!empty($top5_ids)): ?>
                <?php
                $final_vals = array_map(function ($c) {
                    return round($c->total, 2);
                }, $final_standings);
                $final_has_tie = count($final_vals) !== count(array_unique($final_vals));
                ?>
                <div class="section-card winner-card">
                    <h2>
                        <span class="round-pill round-2">Step 3</span> Final Standings &amp; Winners
                        <span class="seg-meta">Final Round only &mdash; Top 5 candidates</span>
                        <span class="seg-meta">
                            <button class="btn-pdf sm ghost" onclick="downloadFinalPDF()">PDF</button>
                        </span>
                    </h2>
                    <?php if ($final_has_tie): ?>
                        <div class="tie-banner">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Tie detected. Resolve by tie-breaker vote (system or verbal).
                        </div>
                    <?php endif; ?>
                    <table class="tab-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Candidate</th>
                                <th>Barangay</th>
                                <th>Placement</th>
                                <th>Final Round Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php $rank = 1;
                            foreach ($final_standings as $c): ?>
                                <tr class="<?= $rank === 1 ? 'rank-1' : '' ?>">
                                    <td><span class="rank-badge"><?= $rank ?></span></td>
                                    <td><span class="candidate-num"><?= candidate_label_html($c) ?></span></td>
                                    <td><?= barangay_html($c) ?></td>
                                    <td><span class="place-tag <?= $rank === 1 ? 'winner' : '' ?>"><?= place_sup($place_names[$rank] ?? ('Place ' . $rank)) ?></span></td>
                                    <td class="score-val total"><?= number_format($avg_of($c->total, $final_max), 2) ?></td>
                                </tr>
                            <?php $rank++;
                            endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>

            <!-- ===================== PER-SEGMENT SCORE SHEETS ===================== -->
            <h2 style="font-size:1.05rem;font-weight:700;margin:2rem 0 1rem">Per-Segment Score Sheets</h2>
            <?php foreach ($segments as $idx => $seg):
                $rl = (int)($seg->round_level ?? 0);
                $rows = $segment_results[$seg->id] ?? [];
            ?>
                <div class="section-card">
                    <h2>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <?= htmlspecialchars($seg->name) ?>
                        <span class="round-pill round-<?= $rl ?>" style="margin-left:.4rem"><?= $round_labels[$rl] ?></span>
                        <span class="seg-meta">
                            <span>Weight: <?= $seg->weight ?>%</span>
                            <button class="btn-pdf sm ghost" onclick="downloadSegmentPDF(<?= $idx ?>)">PDF</button>
                        </span>
                    </h2>
                    <?php if (empty($rows)): ?>
                        <div class="empty-note">No scores yet for this segment.</div>
                    <?php else: ?>
                        <table class="tab-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Candidate</th>
                                    <th>Barangay</th>
                                    <th>Segment Score</th>
                                    <th>Judges</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php $rank = 1;
                                foreach ($rows as $r):
                                    $seg_score = $r->segment_max > 0 ? $r->avg_raw / $r->segment_max * 100 : 0; ?>
                                    <tr class="<?= $rank === 1 ? 'rank-1' : '' ?>">
                                        <td><span class="rank-badge"><?= $rank ?></span></td>
                                        <td><span class="candidate-num"><?= candidate_label_html($r) ?></span></td>
                                        <td><?= barangay_html($r) ?></td>
                                        <td class="score-val total"><?= number_format($seg_score, 2) ?></td>
                                        <td><?= (int)$r->judge_count ?></td>
                                    </tr>
                                <?php $rank++;
                                endforeach; ?>
                            </tbody>
                        </table>

                        <div style="margin-top:1.4rem">
                            <div class="sign-role" style="text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:.5rem">Judges &mdash; <?= htmlspecialchars($seg->name) ?></div>
                            <div class="sign-grid">
                                <?php foreach ($segment_judges[$seg->id] as $j): ?>
                                    <div class="sign-box">
                                        <div class="sign-line"></div>
                                        <div class="sign-name">Judge's Name &amp; Signature</div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>

            <!-- ===================== GRAND TOTAL =====================
            <div class="section-card grand-total-card">
                <h2>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Grand Total &mdash; All Segments Combined (Weighted)
                    <span class="seg-meta">Reference only &mdash; placements come from the Final Round above</span>
                    <span class="seg-meta">
                        <button class="btn-pdf sm ghost" onclick="downloadGrandPDF()">PDF</button>
                    </span>
                </h2>
                <?php
                $grand_vals = array_map(function ($c) {
                    return round($c->total, 2);
                }, $grand);
                $grand_has_tie = count($grand_vals) !== count(array_unique(array_filter($grand_vals)));
                // $grand_max (sum of every segment's weight) is computed above with
                // the PDF payload. Each round block totals 100, so total/grand_max*100
                // is a clean average out of 100.
                ?>
                <?php if ($grand_has_tie): ?>
                    <div class="tie-banner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Tie detected in rankings. Tie-breaker vote required (system or verbal).
                    </div>
                <?php endif; ?>
                <?php if (empty($grand)): ?>
                    <div class="empty-note" style="color:#a0a0b0">No scores recorded yet.</div>
                <?php else: ?>
                    <table class="tab-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Candidate</th>
                                <th>Barangay</th>
                                <th>Grand Total</th>
                                <th>Overall Average</th>
                            </tr>
                        </thead>
                        <tbody><?= rank_rows($grand, [], $grand_max) ?></tbody>
                    </table>
                <?php endif; ?>
            </div> -->
            <!-- 
            <!-- ===================== VERIFIED BY ===================== -->
            <!-- <div class="section-card">
                <h2>Verified by: &mdash; Board of Judges</h2>
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
    </div> -->

            <script src="<?= base_url(); ?>assets/libs/pdfmake/pdfmake.min.js"></script>
            <script src="<?= base_url(); ?>assets/libs/pdfmake/vfs_fonts.js"></script>
            <script src="<?= base_url(); ?>assets/libs/xlsx/xlsx.full.min.js"></script>
            <script src="https://unpkg.com/docx@8.5.0/build/index.umd.js"></script>
            <script>
                var TAB = <?= json_encode($pdf, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
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

                function pdfHeader(title, subtitle) {
                    return [{
                            text: TAB.event,
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
                            text: 'Generated: ' + TAB.generated + '  •  Barangay shown in a separate column',
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

                function signatoryBlock(names) {
                    if (!names || !names.length) return {};
                    var cols = [];
                    names.forEach(function(n) {
                        cols.push({
                            width: '*',
                            stack: [{
                                    text: '________________________________________',
                                    margin: [0, 18, 0, 2]
                                },
                                {
                                    text: "Judge's Name & Signature",
                                    fontSize: 8,
                                    bold: true
                                }
                            ],
                            alignment: 'center'
                        });
                    });
                    // chunk into rows of 3
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

                function candidateText(row) {
                    if (!row) return '';
                    if (row.candidate) return String(row.candidate);
                    var label = row.no != null && row.no !== '' ? '#' + row.no : '#-';
                    return row.name ? label + ' - ' + row.name : label;
                }

                function barangayText(row) {
                    return row && row.barangay ? String(row.barangay) : '—';
                }

                function segmentTable(seg) {
                    var body = [
                        [{
                            text: 'Rank',
                            style: 'th'
                        }, {
                            text: 'Candidate',
                            style: 'th'
                        }, {
                            text: 'Barangay',
                            style: 'th'
                        }, {
                            text: 'Segment Score',
                            style: 'th'
                        }, {
                            text: 'Judges',
                            style: 'th'
                        }]
                    ];
                    seg.rows.forEach(function(r, i) {
                        body.push([
                            String(i + 1),
                            candidateText(r),
                            barangayText(r), {
                                text: (r.score != null ? r.score : 0).toFixed(2),
                                bold: true,
                                color: GOLD
                            },
                            String(r.judges)
                        ]);
                    });
                    return {
                        table: {
                            headerRows: 1,
                            widths: [30, '*', 90, 60, 40],
                            body: body
                        },
                        layout: 'lightHorizontalLines',
                        fontSize: 9,
                        margin: [0, 0, 0, 8]
                    };
                }

                function downloadSegmentPDF(idx) {
                    var seg = TAB.segments[idx];
                    var content = pdfHeader('OFFICIAL SCORE SHEET', seg.name + '  —  ' + seg.round + '  •  Weight ' + seg.weight + '%');
                    if (!seg.rows.length) {
                        content.push({
                            text: 'No scores recorded for this segment.',
                            italics: true
                        });
                    } else {
                        content.push(segmentTable(seg));
                        content.push(signatoryBlock(seg.judges));
                    }
                    buildPdf(content, 'ScoreSheet-' + seg.name.replace(/[^a-z0-9]+/gi, '_'));
                }

                function simpleRankTable(title, rows, cols, withAvg, valKey) {
                    valKey = valKey || 'total';
                    var body = [];
                    body.push(cols.map(function(c) {
                        return {
                            text: c,
                            style: 'th'
                        };
                    }));
                    rows.forEach(function(r, i) {
                        var row = [String(i + 1), candidateText(r), barangayText(r), {
                            text: String(r[valKey] != null ? r[valKey] : 0),
                            bold: true,
                            color: GOLD
                        }];
                        if (withAvg) {
                            row.push({
                                text: (r.avg != null ? r.avg : 0).toFixed(2)
                            });
                        }
                        body.push(row);
                    });
                    return {
                        table: {
                            headerRows: 1,
                            widths: withAvg ? [30, '*', 90, 80, 70] : [30, '*', 90, 80],
                            body: body
                        },
                        layout: 'lightHorizontalLines',
                        fontSize: 9,
                        margin: [0, 0, 0, 12]
                    };
                }

                function downloadPrelimPDF() {
                    var content = pdfHeader('TOP 10 SELECTION', 'Preliminary round score');
                    if (!TAB.prelim || !TAB.prelim.length) {
                        content.push({
                            text: 'No preliminary scores recorded yet.',
                            italics: true
                        });
                    } else {
                        content.push(simpleRankTable('Top 10 Selection', TAB.prelim, ['Rank', 'Candidate', 'Barangay', 'Preliminary Score']));
                    }
                    buildPdf(content, 'Top10-Selection');
                }

                function downloadTop10PDF() {
                    var content = pdfHeader('TOP 5 SELECTION', 'Preliminary Q&A round only — Top 10 candidates');
                    if (!TAB.top10 || !TAB.top10.length) {
                        content.push({
                            text: 'No Top 10 scores recorded yet.',
                            italics: true
                        });
                    } else {
                        content.push(simpleRankTable('Top 5 Selection', TAB.top10, ['Rank', 'Candidate', 'Barangay', 'Q&A Score'], false, 'avg'));
                    }
                    buildPdf(content, 'Top5-Selection');
                }

                function downloadFinalPDF() {
                    var content = pdfHeader('FINAL STANDINGS & WINNERS', 'Final Round only — Top 5 candidates');
                    if (!TAB.winners || !TAB.winners.length) {
                        content.push({
                            text: 'No final standings recorded yet.',
                            italics: true
                        });
                    } else {
                        var body = [
                            [{
                                text: 'Rank',
                                style: 'th'
                            }, {
                                text: 'Candidate',
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
                        TAB.winners.forEach(function(w, i) {
                            body.push([String(i + 1), candidateText(w), barangayText(w), w.place, {
                                text: (w.avg != null ? w.avg : 0).toFixed(2),
                                bold: true,
                                color: GOLD
                            }]);
                        });
                        content.push({
                            table: {
                                headerRows: 1,
                                widths: [30, '*', 90, 90, 55],
                                body: body
                            },
                            layout: 'lightHorizontalLines',
                            fontSize: 9,
                            margin: [0, 0, 0, 12]
                        });
                    }
                    buildPdf(content, 'Final-Standings');
                }

                function downloadGrandPDF() {
                    var content = pdfHeader('GRAND TOTAL', 'All Segments Combined — reference only, not used for placement');
                    if (!TAB.grand || !TAB.grand.length) {
                        content.push({
                            text: 'No scores recorded yet.',
                            italics: true
                        });
                    } else {
                        content.push(simpleRankTable('Grand Total', TAB.grand, ['Rank', 'Candidate', 'Barangay', 'Grand Total', 'Overall Average'], true));
                    }
                    buildPdf(content, 'Grand-Total');
                }

                function downloadFullPDF() {
                    var content = pdfHeader('OFFICIAL TABULATION SHEET', 'Each round scored on its own segment(s) — not cumulative');

                    // Winners (if any)
                    if (TAB.winners && TAB.winners.length) {
                        content.push({
                            text: 'Final Standings & Winners',
                            style: 'h2'
                        });
                        var wbody = [
                            [{
                                text: 'Rank',
                                style: 'th'
                            }, {
                                text: 'Candidate',
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
                        TAB.winners.forEach(function(w, i) {
                            wbody.push([String(i + 1), candidateText(w), barangayText(w), w.place, {
                                text: (w.avg != null ? w.avg : 0).toFixed(2),
                                bold: true,
                                color: GOLD
                            }]);
                        });
                        content.push({
                            table: {
                                headerRows: 1,
                                widths: [30, '*', 90, 90, 55],
                                body: wbody
                            },
                            layout: 'lightHorizontalLines',
                            fontSize: 9,
                            margin: [0, 0, 0, 12]
                        });
                    }

                    // Grand total
                    content.push({
                        text: 'Grand Total — All Segments',
                        style: 'h2'
                    });
                    var gbody = [
                        [{
                            text: 'Rank',
                            style: 'th'
                        }, {
                            text: 'Candidate',
                            style: 'th'
                        }, {
                            text: 'Barangay',
                            style: 'th'
                        }, {
                            text: 'Grand Total',
                            style: 'th'
                        }, {
                            text: 'Overall Average',
                            style: 'th'
                        }]
                    ];
                    TAB.grand.forEach(function(g, i) {
                        gbody.push([String(i + 1), candidateText(g), barangayText(g), {
                            text: g.total.toFixed(2),
                            bold: true,
                            color: GOLD
                        }, {
                            text: (g.avg != null ? g.avg : 0).toFixed(2)
                        }]);
                    });
                    content.push({
                        table: {
                            headerRows: 1,
                            widths: [30, '*', 90, 80, 70],
                            body: gbody
                        },
                        layout: 'lightHorizontalLines',
                        fontSize: 9,
                        margin: [0, 0, 0, 14]
                    });

                    // Each segment summary
                    TAB.segments.forEach(function(seg) {
                        content.push({
                            text: seg.name + '  (' + seg.round + ' • ' + seg.weight + '%)',
                            style: 'h2'
                        });
                        if (!seg.rows.length) {
                            content.push({
                                text: 'No scores.',
                                italics: true,
                                fontSize: 9,
                                margin: [0, 0, 0, 10]
                            });
                        } else {
                            content.push(segmentTable(seg));
                            content.push(signatoryBlock(seg.judges));
                        }
                    });

                    // Verified by
                    content.push({
                        text: '',
                        margin: [0, 6, 0, 0]
                    });
                    content.push(signatoryBlock(TAB.all_judges));

                    buildPdf(content, 'Tabulation-Sheet');
                }

                function downloadExcel() {
                    if (typeof XLSX === 'undefined') {
                        alert('Excel library not loaded.');
                        return;
                    }
                    var wb = XLSX.utils.book_new();
                    wb.Props = {
                        Title: 'Tabulation - ' + TAB.event,
                        Subject: 'Score Sheets',
                        CreatedDate: new Date()
                    };

                    var gtData = [
                        ['Rank', 'Candidate', 'Barangay', 'Grand Total', 'Overall Average']
                    ];
                    TAB.grand.forEach(function(g, i) {
                        gtData.push([i + 1, candidateText(g), barangayText(g), g.total, g.avg != null ? g.avg : 0]);
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gtData), 'Grand Total');

                    if (TAB.winners && TAB.winners.length) {
                        var wData = [
                            ['Rank', 'Candidate', 'Barangay', 'Placement', 'Final Round Score']
                        ];
                        TAB.winners.forEach(function(w, i) {
                            wData.push([i + 1, candidateText(w), barangayText(w), w.place, w.avg != null ? w.avg : 0]);
                        });
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wData), 'Winners');
                    }

                    TAB.segments.forEach(function(seg) {
                        var sData = [
                            ['Rank', 'Candidate', 'Barangay', 'Segment Score', 'Judges']
                        ];
                        seg.rows.forEach(function(r, i) {
                            sData.push([i + 1, candidateText(r), barangayText(r), r.score != null ? r.score : 0, r.judges]);
                        });
                        var name = seg.name.substring(0, 31);
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sData), name);
                    });

                    XLSX.writeFile(wb, 'Tabulation.xlsx');
                }

                async function downloadDocx() {
                    if (typeof docx === 'undefined') {
                        alert('DOCX library not loaded. Please check your internet connection.');
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
                        text: TAB.event,
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER
                    }));
                    children.push(new Paragraph({
                        text: 'Official Tabulation Sheet',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER
                    }));
                    children.push(new Paragraph({
                        text: 'Generated: ' + TAB.generated,
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            after: 200
                        }
                    }));

                    if (TAB.grand && TAB.grand.length) {
                        children.push(new Paragraph({
                            text: 'Grand Total \u2014 All Segments Combined (Weighted)',
                            heading: HeadingLevel.HEADING_2
                        }));
                        var gtRows = [row([cell('Rank', {
                            bold: true,
                            width: 10
                        }), cell('Candidate', {
                            bold: true,
                            width: 30
                        }), cell('Barangay', {
                            bold: true,
                            width: 20
                        }), cell('Grand Total', {
                            bold: true,
                            width: 20
                        }), cell('Overall Average', {
                            bold: true,
                            width: 20
                        })])];
                        TAB.grand.forEach(function(g, i) {
                            gtRows.push(row([cell(String(i + 1)), cell(candidateText(g)), cell(barangayText(g)), cell(String(g.total)), cell((g.avg != null ? g.avg : 0).toFixed(2))]));
                        });
                        children.push(new Table({
                            rows: gtRows,
                            width: {
                                size: 100,
                                type: WidthType.PERCENTAGE
                            }
                        }));
                        children.push(new Paragraph({
                            text: ''
                        }));
                    }
                    if (TAB.winners && TAB.winners.length) {
                        children.push(new Paragraph({
                            text: 'Final Standings & Winners',
                            heading: HeadingLevel.HEADING_2
                        }));
                        var wRows = [row([cell('Rank', {
                            bold: true,
                            width: 10
                        }), cell('Candidate', {
                            bold: true,
                            width: 30
                        }), cell('Barangay', {
                            bold: true,
                            width: 20
                        }), cell('Placement', {
                            bold: true,
                            width: 25
                        }), cell('Final Round Score', {
                            bold: true,
                            width: 15
                        })])];
                        TAB.winners.forEach(function(w, i) {
                            wRows.push(row([cell(String(i + 1)), cell(candidateText(w)), cell(barangayText(w)), cell(w.place), cell((w.avg != null ? w.avg : 0).toFixed(2))]));
                        });
                        children.push(new Table({
                            rows: wRows,
                            width: {
                                size: 100,
                                type: WidthType.PERCENTAGE
                            }
                        }));
                        children.push(new Paragraph({
                            text: ''
                        }));
                    }
                    TAB.segments.forEach(function(seg) {
                        children.push(new Paragraph({
                            text: seg.name + ' (' + seg.round + ' \u2022 Weight ' + seg.weight + '%)',
                            heading: HeadingLevel.HEADING_2
                        }));
                        if (!seg.rows.length) {
                            children.push(new Paragraph({
                                text: 'No scores recorded for this segment.',
                                italics: true
                            }));
                        } else {
                            var sRows = [row([cell('Rank', {
                                bold: true,
                                width: 12
                            }), cell('Candidate', {
                                bold: true,
                                width: 35
                            }), cell('Barangay', {
                                bold: true,
                                width: 20
                            }), cell('Segment Score', {
                                bold: true,
                                width: 18
                            }), cell('Judges', {
                                bold: true,
                                width: 15
                            })])];
                            seg.rows.forEach(function(r, i) {
                                sRows.push(row([cell(String(i + 1)), cell(candidateText(r)), cell(barangayText(r)), cell((r.score != null ? r.score : 0).toFixed(2)), cell(String(r.judges))]));
                            });
                            children.push(new Table({
                                rows: sRows,
                                width: {
                                    size: 100,
                                    type: WidthType.PERCENTAGE
                                }
                            }));
                        }
                        children.push(new Paragraph({
                            text: ''
                        }));
                    });

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
                    a.download = 'Tabulation.docx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
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
            </script>
</body>

</html>