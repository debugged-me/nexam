<?php
defined('BASEPATH') or exit('No direct script access allowed');
$current_page = 'judge_results';
$round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];

/** Average of a candidate's present judge scores (ignores un-scored cells). */
function row_avg($cells)
{
    $vals = array_filter($cells, function ($v) {
        return $v !== null;
    });
    if (empty($vals)) return null;
    return array_sum($vals) / count($vals);
}

function jr_candidate_label_text($candidate)
{
    $number = trim((string)($candidate->candidate_number ?? $candidate->no ?? ''));
    $name = trim((string)($candidate->name ?? ''));
    $label = $number !== '' ? '#' . $number : '#-';
    if ($name !== '') {
        $label .= ' - ' . $name;
    }
    return $label;
}

function jr_candidate_label_html($candidate)
{
    return htmlspecialchars(jr_candidate_label_text($candidate));
}

function jr_barangay_text($candidate)
{
    $barangay = trim((string)($candidate->barangay ?? ''));
    return $barangay !== '' ? $barangay : '—';
}

function jr_barangay_html($candidate)
{
    return htmlspecialchars(jr_barangay_text($candidate));
}

// ---- Build data payload for client-side PDF generation ----
$pdf = [
    'event' => $event->name ?? 'Binibining Mati 2026',
    'generated' => date('M j, Y g:i A'),
    'segments' => [],
];
foreach ($segments as $seg) {
    $m = $matrices[$seg->id];
    $judge_names = array_map(function ($j) {
        return $j->name;
    }, $m['judges']);

    $rows = [];
    foreach ($m['candidates'] as $c) {
        $cells = [];
        foreach ($m['judges'] as $j) {
            $val = $m['matrix'][$c->id][$j->judge_id] ?? null;
            $cells[] = $val;
        }
        $avg = row_avg($cells);
        $rows[] = [
            'no'    => $c->candidate_number,
            'name'  => $c->name ?? '',
            'barangay' => $c->barangay ?? '',
            'candidate' => jr_candidate_label_text($c),
            'cells' => array_map(function ($v) {
                return $v === null ? null : round($v, 2);
            }, $cells),
            'avg'   => $avg === null ? null : round($avg, 2),
        ];
    }

    $pdf['segments'][] = [
        'name'   => $seg->name,
        'round'  => $round_labels[(int)($seg->round_level ?? 0)] ?? 'Preliminary',
        'weight' => $seg->weight,
        'max'    => round($m['max'], 2),
        'judges' => array_values($judge_names),
        'rows'   => $rows,
    ];
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Per-Judge Results | Binibining Mati</title>
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
            flex-wrap: wrap;
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

        .table-scroll {
            overflow-x: auto;
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

        .tab-table thead th:first-child,
        .tab-table thead th:nth-child(2) {
            text-align: left;
        }

        .tab-table thead th .jid {
            display: block;
            font-size: .58rem;
            font-weight: 600;
            color: #9ca3af;
            letter-spacing: .02em;
            text-transform: none;
        }

        .tab-table tbody td {
            padding: .55rem .8rem;
            border-bottom: 1px solid #f1f5f9;
            text-align: center;
        }

        .tab-table tbody td:first-child,
        .tab-table tbody td:nth-child(2) {
            text-align: left;
        }

        .candidate-num {
            font-weight: 700;
            color: var(--text);
        }

        .score-val {
            font-variant-numeric: tabular-nums;
            font-weight: 600;
        }

        .score-val.avg {
            color: var(--gold);
        }

        .col-avg {
            background: #fffdf5;
        }

        .muted {
            color: #cbd0d8;
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

            .sidebar,
            .top-nav-bar,
            .mobile-menu-btn,
            .btn-pdf,
            .judge-header a,
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
                white-space: normal !important;
            }

            .tab-table tbody td {
                border-bottom: 1px solid #ddd !important;
                padding: .35rem .5rem !important;
                font-size: 10pt !important;
            }

            .tab-table tbody td:first-child {
                text-align: left !important;
            }

            .tab-table tbody td {
                text-align: center !important;
            }

            .col-avg {
                background: transparent !important;
            }

            .candidate-num,
            .score-val,
            .score-val.avg {
                color: #111 !important;
                font-size: 10pt !important;
            }

            .muted {
                color: #999 !important;
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

            .table-scroll {
                overflow: visible !important;
            }
        }
    </style>
</head>

<body>
    <?php $this->load->view("includes/sidebar"); ?>

    <div class="main">
        <?php if (!empty($is_admin)): ?>
            <?php $this->load->view('includes/top-nav-bar', ['page_title' => 'Per-Judge Results']); ?>
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
                        <div class="judge-header-title">Per-Judge Results</div>
                        <div class="judge-header-meta">Binibining Mati 2026</div>
                    </div>
                </div>
            </header>
        <?php endif; ?>

        <main class="tab-wrap">
            <div class="tab-header">
                <div>
                    <h1>Per-Judge Results</h1>
                    <p>Each judge's individual rating of every candidate, per segment (raw scores). Barangay is shown in its own column.</p>
                </div>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
                    <button class="btn-pdf" onclick="downloadAllPDF()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        PDF
                    </button>
                    <button class="btn-pdf ghost" onclick="downloadAllExcel()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        Excel
                    </button>
                    <button class="btn-pdf ghost" onclick="downloadAllDocx()">
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

            <?php foreach ($segments as $idx => $seg):
                $rl = (int)($seg->round_level ?? 0);
                $m = $matrices[$seg->id];
            ?>
                <div class="section-card">
                    <h2>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <?= htmlspecialchars($seg->name) ?>
                        <span class="round-pill round-<?= $rl ?>" style="margin-left:.4rem"><?= $round_labels[$rl] ?></span>
                        <span class="seg-meta">
                            <span>Out of <?= number_format($m['max'], 2) ?> &middot; Weight <?= $seg->weight ?>%</span>
                            <button class="btn-pdf sm ghost" onclick="downloadSegmentPDF(<?= $idx ?>)">PDF</button>
                        </span>
                    </h2>
                    <?php if (empty($m['candidates']) || empty($m['judges'])): ?>
                        <div class="empty-note">No candidates or judges in scope for this segment yet.</div>
                    <?php else: ?>
                        <div class="table-scroll">
                            <table class="tab-table">
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <th>Barangay</th>
                                        <?php foreach ($m['judges'] as $j): ?>
                                            <th><?= htmlspecialchars($j->name) ?><span class="jid"><?= htmlspecialchars($j->judge_id) ?></span></th>
                                        <?php endforeach; ?>
                                        <th class="col-avg">Average</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($m['candidates'] as $c):
                                        $cells = [];
                                        foreach ($m['judges'] as $j) {
                                            $cells[] = $m['matrix'][$c->id][$j->judge_id] ?? null;
                                        }
                                        $avg = row_avg($cells);
                                    ?>
                                        <tr>
                                            <td><span class="candidate-num"><?= jr_candidate_label_html($c) ?></span></td>
                                            <td><?= jr_barangay_html($c) ?></td>
                                            <?php foreach ($cells as $v): ?>
                                                <td>
                                                    <?php if ($v === null): ?>
                                                        <span class="muted">&mdash;</span>
                                                    <?php else: ?>
                                                        <span class="score-val"><?= number_format($v, 2) ?></span>
                                                    <?php endif; ?>
                                                </td>
                                            <?php endforeach; ?>
                                            <td class="col-avg">
                                                <?php if ($avg === null): ?>
                                                    <span class="muted">&mdash;</span>
                                                <?php else: ?>
                                                    <span class="score-val avg"><?= number_format($avg, 2) ?></span>
                                                <?php endif; ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>

            <?php if (empty($segments)): ?>
                <div class="section-card">
                    <div class="empty-note">No active segments to report on yet.</div>
                </div>
            <?php endif; ?>

            <!-- Verified by: Board of Judges -->
            <div class="section-card">
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
    <script>
        var JR = <?= json_encode($pdf, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
        var GOLD = '#b8860b';

        function pdfHeader(title, subtitle, width) {
            return [{
                    text: JR.event,
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
                    text: 'Generated: ' + JR.generated + '  •  Barangay shown in a separate column',
                    style: 'meta'
                },
                {
                    canvas: [{
                        type: 'line',
                        x1: 0,
                        y1: 5,
                        x2: width,
                        y2: 5,
                        lineWidth: 1,
                        lineColor: GOLD
                    }],
                    margin: [0, 4, 0, 12]
                }
            ];
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

        function matrixTable(seg) {
            // Header row: Candidate | judge names... | Average
            var header = [{
                text: 'Candidate',
                style: 'th'
            }, {
                text: 'Barangay',
                style: 'th'
            }];
            seg.judges.forEach(function(n) {
                header.push({
                    text: n,
                    style: 'th'
                });
            });
            header.push({
                text: 'Avg',
                style: 'th'
            });

            var body = [header];
            seg.rows.forEach(function(r) {
                var line = [{
                    text: candidateText(r),
                    bold: true
                }, {
                    text: barangayText(r)
                }];
                r.cells.forEach(function(v) {
                    line.push(v === null ? {
                        text: '—',
                        color: '#bbb'
                    } : v.toFixed(2));
                });
                line.push(r.avg === null ? {
                    text: '—',
                    color: '#bbb'
                } : {
                    text: r.avg.toFixed(2),
                    bold: true,
                    color: GOLD
                });
                body.push(line);
            });

            // Candidate col fixed, judge + avg columns share the rest.
            var widths = [150, 90];
            for (var i = 0; i < seg.judges.length; i++) widths.push('*');
            widths.push(40);

            return {
                table: {
                    headerRows: 1,
                    widths: widths,
                    body: body
                },
                layout: 'lightHorizontalLines',
                fontSize: 8,
                margin: [0, 0, 0, 10]
            };
        }

        function segmentContent(seg) {
            var content = [];
            content.push({
                text: seg.name + '  (' + seg.round + ' • Out of ' + seg.max.toFixed(2) + ' • Weight ' + seg.weight + '%)',
                style: 'h2'
            });
            if (!seg.judges.length || !seg.rows.length) {
                content.push({
                    text: 'No candidates or judges in scope for this segment.',
                    italics: true,
                    fontSize: 9,
                    margin: [0, 0, 0, 10]
                });
            } else {
                content.push(matrixTable(seg));
            }
            return content;
        }

        function downloadSegmentPDF(idx) {
            var seg = JR.segments[idx];
            var content = pdfHeader('PER-JUDGE SCORE SHEET', seg.name + '  —  ' + seg.round, 760);
            content = content.concat(segmentContent(seg));
            buildPdf(content, 'PerJudge-' + seg.name.replace(/[^a-z0-9]+/gi, '_'));
        }

        function downloadAllPDF() {
            var content = pdfHeader('PER-JUDGE RESULTS', 'Individual judge ratings — all segments', 760);
            JR.segments.forEach(function(seg) {
                content = content.concat(segmentContent(seg));
            });
            content.push(signatoryBlock(JR.judges));
            buildPdf(content, 'Per-Judge-Results');
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

        function downloadAllExcel() {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded.');
                return;
            }
            var wb = XLSX.utils.book_new();
            wb.Props = {
                Title: 'Per-Judge Results - ' + JR.event,
                CreatedDate: new Date()
            };
            JR.segments.forEach(function(seg) {
                var data = [
                    ['Candidate', 'Barangay'].concat(seg.judges, ['Average'])
                ];
                seg.rows.forEach(function(r) {
                    var row = [candidateText(r), barangayText(r)];
                    r.cells.forEach(function(v) {
                        row.push(v === null ? '' : v);
                    });
                    row.push(r.avg === null ? '' : r.avg);
                    data.push(row);
                });
                var name = seg.name.substring(0, 31);
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
            });
            XLSX.writeFile(wb, 'Per-Judge-Results.xlsx');
        }

        async function downloadAllDocx() {
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
                text: JR.event,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Per-Judge Results',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Generated: ' + JR.generated,
                alignment: AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));

            JR.segments.forEach(function(seg) {
                children.push(new Paragraph({
                    text: seg.name + ' (' + seg.round + ' \u2022 Weight ' + seg.weight + '%)',
                    heading: HeadingLevel.HEADING_2
                }));
                if (!seg.judges.length || !seg.rows.length) {
                    children.push(new Paragraph({
                        text: 'No candidates or judges in scope for this segment.',
                        italics: true
                    }));
                } else {
                    var hdr = [cell('Candidate', {
                        bold: true,
                        width: 12
                    }), cell('Barangay', {
                        bold: true,
                        width: 12
                    })];
                    seg.judges.forEach(function() {
                        hdr.push(cell('Judge', {
                            bold: true,
                            width: 15
                        }));
                    });
                    hdr.push(cell('Avg', {
                        bold: true,
                        width: 13
                    }));
                    var rows = [row(hdr)];
                    seg.rows.forEach(function(r) {
                        var cells = [cell(candidateText(r)), cell(barangayText(r))];
                        r.cells.forEach(function(v) {
                            cells.push(cell(v === null ? '\u2014' : String(v)));
                        });
                        cells.push(cell(r.avg === null ? '\u2014' : String(r.avg)));
                        rows.push(row(cells));
                    });
                    children.push(new Table({
                        rows: rows,
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

            if (JR.judges && JR.judges.length) {
                children.push(new Paragraph({
                    text: 'Verified by:',
                    heading: HeadingLevel.HEADING_2
                }));
                var srows = [];
                JR.judges.forEach(function(j) {
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
            a.download = 'Per-Judge-Results.docx';
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
                pageOrientation: 'landscape',
                pageMargins: [40, 40, 40, 40],
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
