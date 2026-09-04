<?php
defined('BASEPATH') or exit('No direct script access allowed');
$current_page = 'my_results';
$round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];

function mr_candidate_number_text($candidate)
{
    $number = trim((string)($candidate->candidate_number ?? $candidate->no ?? ''));
    return $number !== '' ? '#' . $number : '#-';
}

function mr_candidate_number_html($candidate)
{
    return htmlspecialchars(mr_candidate_number_text($candidate));
}

// ---- Build data payload for client-side PDF generation ----
$pdf = [
    'event' => $event->name ?? 'Binibining Mati 2026',
    'generated' => date('M j, Y g:i A'),
    'judge' => [
        'name' => $judge->name ?? '',
        'judge_id' => $judge->judge_id ?? '',
        // Anonymous panel label ("Judge 1"); falls back to the login ID when unset.
        'identifier' => trim((string)($judge->identifier ?? '')) !== '' ? trim($judge->identifier) : ($judge->judge_id ?? ''),
    ],
    'segments' => [],
];
foreach ($segments as $seg) {
    $s = $sheets[$seg->id];
    $crit = array_map(function ($cr) {
        return ['name' => $cr->name, 'max' => round(floatval($cr->max_score), 2)];
    }, $s['criteria']);

    $rows = [];
    foreach ($s['candidates'] as $c) {
        $cells = [];
        foreach ($s['criteria'] as $cr) {
            $v = $s['scores'][$c->id][$cr->id] ?? null;
            $cells[] = $v === null ? null : round($v, 2);
        }
        $total = $s['totals'][$c->id] ?? null;
        $rows[] = [
            'no'    => $c->candidate_number,
            'cells' => $cells,
            'total' => $total === null ? null : round($total, 2),
        ];
    }

    $pdf['segments'][] = [
        'name'     => $seg->name,
        'round'    => $round_labels[(int)($seg->round_level ?? 0)] ?? 'Preliminary',
        'weight'   => $seg->weight,
        'max'      => round($s['max'], 2),
        'criteria' => $crit,
        'rows'     => $rows,
    ];
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Score Sheet | Binibining Mati</title>
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
            max-width: 1100px;
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

        .judge-badge {
            display: inline-flex;
            align-items: center;
            gap: .5rem;
            margin-top: .5rem;
            padding: .3rem .7rem;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: .78rem;
            font-weight: 600;
            color: var(--text);
        }

        .judge-badge .jb-id {
            color: var(--text-secondary);
            font-weight: 500;
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
            text-decoration: none;
        }

        .btn-pdf:hover {
            background: var(--gold-hover);
            color: #fff;
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

        .tab-table thead th:first-child {
            text-align: left;
        }

        .tab-table thead th .cmax {
            display: block;
            font-size: .58rem;
            font-weight: 600;
            color: #9ca3af;
            text-transform: none;
        }

        .tab-table tbody td {
            padding: .55rem .8rem;
            border-bottom: 1px solid #f1f5f9;
            text-align: center;
        }

        .tab-table tbody td:first-child {
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

        .score-val.total {
            color: var(--gold);
        }

        .col-total {
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

            .judge-badge {
                border: none !important;
                background: transparent !important;
                padding-left: 0 !important;
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

            .col-total {
                background: transparent !important;
            }

            .candidate-num,
            .score-val,
            .score-val.total {
                color: #111 !important;
                font-size: 10pt !important;
            }

            .muted {
                color: #999 !important;
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
                    <div class="judge-header-title">My Score Sheet</div>
                    <div class="judge-header-meta">Binibining Mati 2026</div>
                </div>
            </div>
            <a href="<?= site_url('judgedashboard') ?>" style="font-size:.82rem;color:var(--text-secondary);text-decoration:none;">&larr; Dashboard</a>
        </header>

        <main class="tab-wrap">
            <div class="tab-header">
                <div>
                    <h1>My Score Sheet</h1>
                    <p>Your own ratings for every candidate, broken down by criterion. Candidates shown by number only.</p>
                    <div class="judge-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <?= htmlspecialchars($judge->name ?? '') ?>
                        <span class="jb-id"><?= htmlspecialchars($judge->judge_id ?? '') ?></span>
                    </div>
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
                $s = $sheets[$seg->id];
            ?>
                <div class="section-card">
                    <h2>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <?= htmlspecialchars($seg->name) ?>
                        <span class="round-pill round-<?= $rl ?>" style="margin-left:.4rem"><?= $round_labels[$rl] ?></span>
                        <span class="seg-meta">
                            <span>Out of <?= number_format($s['max'], 2) ?> &middot; Weight <?= $seg->weight ?>%</span>
                            <button class="btn-pdf sm ghost" onclick="downloadSegmentPDF(<?= $idx ?>)">PDF</button>
                        </span>
                    </h2>
                    <?php if (empty($s['candidates']) || empty($s['criteria'])): ?>
                        <div class="empty-note">Nothing to show for this segment yet.</div>
                    <?php else: ?>
                        <div class="table-scroll">
                            <table class="tab-table">
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <?php foreach ($s['criteria'] as $cr): ?>
                                            <th><?= htmlspecialchars($cr->name) ?><span class="cmax">/ <?= number_format(floatval($cr->max_score), 0) ?></span></th>
                                        <?php endforeach; ?>
                                        <th class="col-total">Total<span class="cmax">/ <?= number_format($s['max'], 0) ?></span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($s['candidates'] as $c):
                                        $total = $s['totals'][$c->id] ?? null;
                                    ?>
                                        <tr>
                                            <td><span class="candidate-num"><?= mr_candidate_number_html($c) ?></span></td>
                                            <?php foreach ($s['criteria'] as $cr):
                                                $v = $s['scores'][$c->id][$cr->id] ?? null;
                                            ?>
                                                <td>
                                                    <?php if ($v === null): ?>
                                                        <span class="muted">&mdash;</span>
                                                    <?php else: ?>
                                                        <span class="score-val"><?= number_format($v, 2) ?></span>
                                                    <?php endif; ?>
                                                </td>
                                            <?php endforeach; ?>
                                            <td class="col-total">
                                                <?php if ($total === null): ?>
                                                    <span class="muted">&mdash;</span>
                                                <?php else: ?>
                                                    <span class="score-val total"><?= number_format($total, 2) ?></span>
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
                    <div class="empty-note">You have no segments assigned yet.</div>
                </div>
            <?php endif; ?>

            <!-- Verified by: -->
            <div class="section-card">
                <h2 style="font-size:1rem;font-weight:700;margin:0 0 1rem">Verified by:</h2>
                <div class="sign-grid">
                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <div class="sign-name">Judge's Name &amp; Signature</div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="<?= base_url(); ?>assets/libs/pdfmake/pdfmake.min.js"></script>
    <script src="<?= base_url(); ?>assets/libs/pdfmake/vfs_fonts.js"></script>
    <script src="<?= base_url(); ?>assets/libs/xlsx/xlsx.full.min.js"></script>
    <script src="https://unpkg.com/docx@8.5.0/build/index.umd.js"></script>
    <script>
        var MR = <?= json_encode($pdf, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
        var GOLD = '#b8860b';

        function pdfHeader(title, subtitle) {
            return [{
                    text: MR.event,
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
                    text: MR.judge.identifier,
                    style: 'judge'
                },
                {
                    text: 'Generated: ' + MR.generated + '  •  Candidates shown by number only',
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

        function candidateText(row) {
            if (!row) return '';
            return row.no != null && row.no !== '' ? '#' + row.no : '#-';
        }

        function sheetTable(seg) {
            var header = [{
                text: 'Candidate',
                style: 'th'
            }];
            seg.criteria.forEach(function(cr) {
                header.push({
                    text: cr.name + '\n/' + cr.max,
                    style: 'th'
                });
            });
            header.push({
                text: 'Total\n/' + seg.max,
                style: 'th'
            });

            var body = [header];
            seg.rows.forEach(function(r) {
                var line = [{
                    text: candidateText(r),
                    bold: true
                }];
                r.cells.forEach(function(v) {
                    line.push(v === null ? {
                        text: '—',
                        color: '#bbb'
                    } : v.toFixed(2));
                });
                line.push(r.total === null ? {
                    text: '—',
                    color: '#bbb'
                } : {
                    text: r.total.toFixed(2),
                    bold: true,
                    color: GOLD
                });
                body.push(line);
            });

            var widths = [140];
            for (var i = 0; i < seg.criteria.length; i++) widths.push('*');
            widths.push(46);

            return {
                table: {
                    headerRows: 1,
                    widths: widths,
                    body: body
                },
                layout: 'lightHorizontalLines',
                fontSize: 9,
                margin: [0, 0, 0, 10]
            };
        }

        function signatory() {
            return {
                stack: [{
                        text: '________________________________________',
                        margin: [0, 26, 0, 2]
                    },
                    {
                        text: "Judge's Name & Signature",
                        fontSize: 9,
                        bold: true
                    }
                ],
                margin: [0, 6, 0, 0]
            };
        }

        function segmentContent(seg) {
            var content = [];
            content.push({
                text: seg.name + '  (' + seg.round + ' • Out of ' + seg.max.toFixed(2) + ' • Weight ' + seg.weight + '%)',
                style: 'h2'
            });
            if (!seg.criteria.length || !seg.rows.length) {
                content.push({
                    text: 'Nothing to show for this segment.',
                    italics: true,
                    fontSize: 9,
                    margin: [0, 0, 0, 10]
                });
            } else {
                content.push(sheetTable(seg));
            }
            return content;
        }

        function downloadSegmentPDF(idx) {
            var seg = MR.segments[idx];
            var content = pdfHeader('MY SCORE SHEET', seg.name + '  —  ' + seg.round);
            content = content.concat(segmentContent(seg));
            content.push(signatory());
            buildPdf(content, 'MyScoreSheet-' + seg.name.replace(/[^a-z0-9]+/gi, '_'));
        }

        function downloadAllPDF() {
            var content = pdfHeader('MY SCORE SHEET', 'All assigned segments');
            MR.segments.forEach(function(seg) {
                content = content.concat(segmentContent(seg));
            });
            content.push(signatory());
            buildPdf(content, 'My-Score-Sheet');
        }

        function downloadAllExcel() {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded.');
                return;
            }
            var wb = XLSX.utils.book_new();
            wb.Props = {
                Title: 'My Score Sheet - ' + MR.event,
                CreatedDate: new Date()
            };
            MR.segments.forEach(function(seg) {
                var data = [
                    ['Candidate']
                ];
                seg.criteria.forEach(function(cr) {
                    data[0].push(cr.name);
                });
                data[0].push('Total');
                seg.rows.forEach(function(r) {
                    var row = [candidateText(r)];
                    r.cells.forEach(function(v) {
                        row.push(v === null ? '' : v);
                    });
                    row.push(r.total === null ? '' : r.total);
                    data.push(row);
                });
                var name = seg.name.substring(0, 31);
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
            });
            XLSX.writeFile(wb, 'My-Score-Sheet.xlsx');
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
                text: MR.event,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'My Score Sheet',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: MR.judge.identifier,
                alignment: AlignmentType.CENTER
            }));
            children.push(new Paragraph({
                text: 'Generated: ' + MR.generated,
                alignment: AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));

            MR.segments.forEach(function(seg) {
                children.push(new Paragraph({
                    text: seg.name + ' (' + seg.round + ' \u2022 Weight ' + seg.weight + '%)',
                    heading: HeadingLevel.HEADING_2
                }));
                if (!seg.criteria.length || !seg.rows.length) {
                    children.push(new Paragraph({
                        text: 'Nothing to show for this segment.',
                        italics: true
                    }));
                } else {
                    var hdr = [cell('Candidate', {
                        bold: true,
                        width: 12
                    })];
                    seg.criteria.forEach(function() {
                        hdr.push(cell('Criterion', {
                            bold: true,
                            width: 15
                        }));
                    });
                    hdr.push(cell('Total', {
                        bold: true,
                        width: 13
                    }));
                    var rows = [row(hdr)];
                    seg.rows.forEach(function(r) {
                        var cells = [cell(candidateText(r))];
                        r.cells.forEach(function(v) {
                            cells.push(cell(v === null ? '\u2014' : String(v)));
                        });
                        cells.push(cell(r.total === null ? '\u2014' : String(r.total)));
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

            children.push(new Paragraph({
                text: 'Verified by:',
                heading: HeadingLevel.HEADING_2
            }));
            children.push(new Table({
                rows: [row([cell('________________________________________', {
                    width: 40
                }), cell("Judge's Name & Signature", {
                    width: 60
                })])],
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                }
            }));

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
            a.download = 'My-Score-Sheet.docx';
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
                    judge: {
                        fontSize: 9,
                        bold: true,
                        color: '#333',
                        margin: [0, 4, 0, 0]
                    },
                    meta: {
                        fontSize: 8,
                        color: '#888',
                        margin: [0, 2, 0, 0]
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
