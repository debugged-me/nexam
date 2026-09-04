<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $page_title ?> | <?= htmlspecialchars($category->name ?? '') ?> | Binibining Mati</title>
    <link rel="icon" type="image/svg+xml" href="<?= base_url(); ?>assets/images/favicon.svg">
    <link href="<?= base_url(); ?>assets/css/bootstrap.min.css" rel="stylesheet">
    <link href="<?= base_url(); ?>assets/css/admin.css?v=8" rel="stylesheet">
    <style>
        :root {
            --bg: #f3f0eb;
            --card: #ffffff;
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

        .judge-main {
            padding: 1.5rem 1.5rem 2rem;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
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

        .score-hint {
            font-size: .82rem;
            color: var(--text-secondary);
            margin: 0 0 1rem;
        }

        .score-table-wrap {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow-x: auto;
            margin-bottom: 1.5rem;
        }

        .score-table {
            width: 100%;
            border-collapse: collapse;
            font-size: .88rem;
            min-width: 640px;
        }

        .score-table thead th {
            background: var(--soft);
            padding: .8rem 1rem;
            font-size: .72rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: .04em;
            border-bottom: 1px solid var(--border);
            text-align: center;
            vertical-align: bottom;
        }

        .score-table thead th:first-child {
            text-align: left;
        }

        /* Criterion header: name on top, "Max: X" stacked underneath. */
        .crit-th-name {
            display: block;
        }

        .crit-th-max {
            display: block;
            margin-top: .25rem;
            font-size: .66rem;
            font-weight: 600;
            color: #9ca3af;
            text-transform: none;
            letter-spacing: 0;
        }

        .score-table tbody td {
            padding: .55rem 1rem;
            border-bottom: 1px solid #f1f5f9;
            text-align: center;
            vertical-align: middle;
        }

        .score-table tbody td:first-child {
            text-align: left;
        }

        .score-table tbody tr:last-child td {
            border-bottom: none;
        }

        .score-row {
            cursor: pointer;
            transition: background .15s;
        }

        .score-row:hover {
            background: #fbf8f1;
        }

        .candidate-num {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            background: #1a1a2e;
            color: #fff;
            font-weight: 700;
            font-size: .9rem;
            border-radius: 10px;
        }

        .score-cell {
            font-weight: 600;
            color: var(--text);
            min-width: 54px;
        }

        .score-cell.empty {
            color: #cbd5e1;
            font-weight: 500;
        }

        .score-total-cell {
            font-weight: 700;
            color: var(--gold);
            min-width: 56px;
        }

        .rank-cell {
            font-weight: 700;
            color: var(--text);
            min-width: 46px;
        }

        .rank-cell.empty {
            color: #cbd5e1;
            font-weight: 500;
        }

        .rank-cell .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 26px;
            height: 26px;
            padding: 0 .4rem;
            border-radius: 7px;
        }

        .rank-cell.top .rank-badge {
            background: linear-gradient(135deg, #f3d27a, var(--gold));
            color: #fff;
        }

        .row-status {
            display: inline-block;
            padding: .2rem .6rem;
            border-radius: 20px;
            font-size: .68rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: .04em;
        }

        .row-status.scored {
            background: #ecfdf5;
            color: #059669;
        }

        .row-status.pending {
            background: #fff7ed;
            color: #d97706;
        }

        /* ---------- scoring modal ---------- */
        .score-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(17, 24, 39, .45);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            z-index: 1000;
        }

        .score-modal-overlay[hidden] {
            display: none;
        }

        .score-modal {
            background: #fff;
            width: 100%;
            max-width: 460px;
            border-radius: 16px;
            box-shadow: 0 32px 80px rgba(0, 0, 0, .25);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 90vh;
        }

        .score-modal-header {
            padding: 1.2rem 1.4rem;
            background: linear-gradient(160deg, #1c1c2e, #2d2b45);
            color: #fff;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
        }

        .score-modal-eyebrow {
            font-size: .68rem;
            letter-spacing: .08em;
            text-transform: uppercase;
            color: var(--gold);
            font-weight: 700;
        }

        .score-modal-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin: .15rem 0 0;
            color: #fff;
        }

        .score-modal-close {
            background: rgba(255, 255, 255, .1);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            font-size: 1.4rem;
            line-height: 1;
            cursor: pointer;
        }

        .score-modal-close:hover {
            background: rgba(255, 255, 255, .2);
        }

        .score-modal-body {
            padding: 1.2rem 1.4rem;
            overflow-y: auto;
        }

        .sm-row {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: .65rem 0;
            border-bottom: 1px dashed var(--border);
        }

        .sm-row:last-child {
            border-bottom: none;
        }

        .sm-row label {
            flex: 1;
            font-size: .86rem;
            color: var(--text);
            font-weight: 500;
        }

        .sm-row .sm-max {
            display: block;
            font-size: .7rem;
            color: var(--text-secondary);
            font-weight: 400;
            margin-top: .15rem;
        }

        .sm-input {
            width: 84px;
            padding: .55rem .5rem;
            border: 1.5px solid var(--border);
            border-radius: 10px;
            text-align: center;
            font-size: .95rem;
            font-weight: 600;
            color: var(--text);
            flex-shrink: 0;
        }

        .sm-input:focus {
            outline: none;
            border-color: var(--gold);
            box-shadow: 0 0 0 3px rgba(184, 134, 11, .12);
        }

        /* Clean number inputs (no spinner arrows); judges type the value. */
        .sm-input::-webkit-outer-spin-button,
        .sm-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        .sm-input {
            -moz-appearance: textfield;
            appearance: textfield;
        }

        .score-modal-footer {
            padding: 1rem 1.4rem;
            border-top: 1px solid var(--border);
            background: var(--soft);
            display: flex;
            align-items: center;
            gap: .75rem;
        }

        .sm-total {
            margin-right: auto;
            font-size: .9rem;
            font-weight: 700;
            color: var(--text);
        }

        .sm-total span {
            color: var(--gold);
        }

        .btn-ghost {
            padding: .6rem 1.1rem;
            border: 1.5px solid var(--border);
            background: #fff;
            color: var(--text-secondary);
            border-radius: 10px;
            font-size: .85rem;
            font-weight: 600;
            cursor: pointer;
        }

        .btn-gold {
            padding: .6rem 1.4rem;
            background: var(--gold);
            color: #fff;
            border: none;
            border-radius: 10px;
            font-size: .85rem;
            font-weight: 600;
            cursor: pointer;
            transition: background .2s;
        }

        .btn-gold:hover {
            background: var(--gold-hover);
        }

        .btn-gold:disabled {
            opacity: .6;
            cursor: default;
        }

        .toast-msg {
            position: fixed;
            bottom: 1.5rem;
            left: 50%;
            transform: translateX(-50%);
            background: #1a1a2e;
            color: #fff;
            padding: .7rem 1.3rem;
            border-radius: 10px;
            font-size: .85rem;
            font-weight: 500;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
            z-index: 1100;
            opacity: 0;
            transition: opacity .25s, transform .25s;
            pointer-events: none;
        }

        .toast-msg.show {
            opacity: 1;
            transform: translateX(-50%) translateY(-4px);
        }

        .toast-msg.error {
            background: #b91c1c;
        }

        /* ---------- tablet (iPad) ---------- */
        @media (max-width: 1024px) {
            .judge-main {
                padding: 1.2rem 1rem 2rem;
            }
        }

        /* ---------- phones ---------- */
        @media (max-width: 640px) {
            .judge-header {
                padding: 1rem;
            }

            .judge-main {
                padding: 1rem .8rem 2rem;
            }

            .score-hint {
                font-size: .8rem;
            }

            /* Drop the per-criterion columns; scores are entered/seen in the
               modal. The list stays a clean Candidate / Total / Status view. */
            .score-table {
                min-width: 0;
            }

            .score-table .crit-col {
                display: none;
            }

            .score-table thead th,
            .score-table tbody td {
                padding: .7rem .6rem;
            }

            .candidate-num {
                width: 34px;
                height: 34px;
                font-size: .82rem;
            }

            /* Modal fills the screen comfortably with larger touch targets. */
            .score-modal-overlay {
                padding: 0;
                align-items: flex-end;
            }

            .score-modal {
                max-width: 100%;
                max-height: 92vh;
                border-radius: 18px 18px 0 0;
            }

            .score-modal-header {
                padding: 1.1rem 1.2rem;
            }

            .score-modal-body {
                padding: 1rem 1.2rem;
            }

            .sm-row {
                padding: .8rem 0;
            }

            .sm-row label {
                font-size: .9rem;
            }

            .sm-input {
                width: 92px;
                padding: .7rem .5rem;
                font-size: 1.05rem;
            }

            .score-modal-footer {
                flex-wrap: wrap;
                padding: 1rem 1.2rem calc(1rem + env(safe-area-inset-bottom));
            }

            .sm-total {
                width: 100%;
                margin: 0 0 .25rem;
            }

            .score-modal-footer .btn-ghost,
            .score-modal-footer .btn-gold {
                flex: 1;
                padding: .8rem 1rem;
                font-size: .9rem;
            }
        }
    </style>
</head>

<body>
    <?php $current_page = 'judge_score'; ?>
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
                    <div class="judge-header-title"><?= htmlspecialchars($category->name ?? '') ?></div>
                    <div class="judge-header-meta">Score Entry — <?= htmlspecialchars($judge->name ?? '') ?></div>
                </div>
            </div>
            <a href="<?= site_url('judgedashboard') ?>" style="font-size:.82rem;color:var(--text-secondary);text-decoration:none;">&larr; Back</a>
        </header>
        <main class="judge-main">
            <?php if (empty($candidates)): ?>
                <div style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:2.5rem 1.5rem;text-align:center">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#b8860b" stroke-width="1.6" style="margin-bottom:.6rem">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <h2 style="font-size:1.05rem;font-weight:700;margin:0 0 .4rem">This round isn't open yet</h2>
                    <p style="color:var(--text-secondary);font-size:.9rem;margin:0 auto;max-width:420px">
                        <?= (int)($round_level ?? 0) === 1 ? 'Scoring opens once the admin has selected the Top 10 for this round.' : 'Scoring opens once the admin has selected the Top 5 for this round.' ?>
                    </p>
                    <a href="<?= site_url('judgedashboard') ?>" style="display:inline-block;margin-top:1.2rem;font-size:.85rem;color:var(--gold);text-decoration:none">&larr; Back to dashboard</a>
                </div>
            <?php else: ?>
                <p class="score-hint">Tap a candidate to enter or edit their scores.</p>

                <div class="score-table-wrap">
                    <table class="score-table">
                        <thead>
                            <tr>
                                <th>Candidate</th>
                                <th>Total</th>
                                <th>Rank</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($candidates as $cand):
                                $has_scores = !empty($existing_scores[$cand->id]);
                                $cand_total = 0;
                                foreach ($criteria as $c) {
                                    $cand_total += floatval($existing_scores[$cand->id][$c->id] ?? 0);
                                }
                            ?>
                                <tr class="score-row" id="row-<?= $cand->id ?>" onclick="openScoreModal(<?= $cand->id ?>)">
                                    <td>
                                        <span class="candidate-num">#<?= htmlspecialchars($cand->candidate_number) ?></span>
                                    </td>
                                    <td class="score-total-cell" id="rowtotal-<?= $cand->id ?>"><?= number_format($cand_total, 2) ?></td>
                                    <td class="rank-cell" id="rank-<?= $cand->id ?>">—</td>
                                    <td>
                                        <span class="row-status <?= $has_scores ? 'scored' : 'pending' ?>" id="status-<?= $cand->id ?>">
                                            <?= $has_scores ? 'Scored' : 'Pending' ?>
                                        </span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </main>
    </div>

    <!-- Scoring modal -->
    <div class="score-modal-overlay" id="scoreModal" hidden>
        <div class="score-modal" role="dialog" aria-modal="true">
            <div class="score-modal-header">
                <div>
                    <div class="score-modal-eyebrow"><?= htmlspecialchars($category->name ?? '') ?></div>
                    <h3 class="score-modal-title">Candidate #<span id="sm-cand-num"></span></h3>
                </div>
                <button class="score-modal-close" type="button" onclick="closeScoreModal()" aria-label="Close">&times;</button>
            </div>
            <div class="score-modal-body">
                <?php foreach (($criteria ?? []) as $c): ?>
                    <div class="sm-row">
                        <label>
                            <?= htmlspecialchars($c->name) ?>
                            <span class="sm-max">Max: <?= number_format($c->max_score, 2) ?></span>
                        </label>
                        <input type="number" class="sm-input" inputmode="decimal" step="0.01" min="0"
                            max="<?= $c->max_score ?>" data-crit="<?= $c->id ?>" data-max="<?= $c->max_score ?>"
                            placeholder="0" oninput="onScoreInput(this)">
                    </div>
                <?php endforeach; ?>
            </div>
            <div class="score-modal-footer">
                <div class="sm-total">Total: <span id="sm-total">0.00</span></div>
                <button type="button" class="btn-ghost" onclick="closeScoreModal()">Cancel</button>
                <button type="button" class="btn-gold" id="sm-save" onclick="saveCandidateScore()">Save</button>
            </div>
        </div>
    </div>

    <div class="toast-msg" id="toast"></div>

    <script src="<?= base_url(); ?>assets/js/jquery-3.6.0.min.js"></script>
    <script>
        var SAVE_URL = "<?= site_url('judgedashboard/save_candidate_score') ?>";
        var CATEGORY_ID = <?= (int) ($category->id ?? 0) ?>;
        var CRITERIA = <?= json_encode(array_map(function ($c) {
                            return ['id' => (int) $c->id, 'max' => floatval($c->max_score)];
                        }, $criteria ?? [])) ?>;
        var EXISTING = <?= json_encode($existing_scores ?: new stdClass()) ?>;
        var CANDNUM = <?= json_encode(array_reduce($candidates ?? [], function ($m, $cand) {
                            $m[(int) $cand->id] = $cand->candidate_number;
                            return $m;
                        }, [])) ?: '{}' ?>;

        var currentCand = null;

        function fmt(n) {
            return (Math.round((parseFloat(n) || 0) * 100) / 100).toFixed(2);
        }

        function modalInputs() {
            return Array.prototype.slice.call(document.querySelectorAll('#scoreModal .sm-input'));
        }

        function recalcModalTotal() {
            var t = 0;
            modalInputs().forEach(function (inp) {
                t += parseFloat(inp.value) || 0;
            });
            document.getElementById('sm-total').innerText = fmt(t);
        }

        function onScoreInput(inp) {
            var max = parseFloat(inp.getAttribute('data-max'));
            var val = parseFloat(inp.value);
            if (!isNaN(val)) {
                if (val > max) inp.value = max;
                if (val < 0) inp.value = 0;
            }
            recalcModalTotal();
        }

        function openScoreModal(candId) {
            currentCand = candId;
            document.getElementById('sm-cand-num').innerText = CANDNUM[candId] || candId;
            var saved = EXISTING[candId] || {};
            modalInputs().forEach(function (inp) {
                var cid = inp.getAttribute('data-crit');
                inp.value = (saved[cid] !== undefined && saved[cid] !== null) ? parseFloat(saved[cid]) : '';
            });
            recalcModalTotal();
            document.getElementById('scoreModal').hidden = false;
            var first = modalInputs()[0];
            if (first) first.focus();
        }

        function closeScoreModal() {
            document.getElementById('scoreModal').hidden = true;
            currentCand = null;
        }

        // Close when clicking the dark backdrop (but not the dialog itself).
        document.getElementById('scoreModal').addEventListener('click', function (e) {
            if (e.target === this) closeScoreModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !document.getElementById('scoreModal').hidden) closeScoreModal();
        });

        function showToast(msg, isError) {
            var t = document.getElementById('toast');
            t.innerText = msg;
            t.className = 'toast-msg show' + (isError ? ' error' : '');
            setTimeout(function () {
                t.className = 'toast-msg' + (isError ? ' error' : '');
            }, 2200);
        }

        function saveCandidateScore() {
            if (!currentCand) return;
            var candId = currentCand;
            var btn = document.getElementById('sm-save');
            btn.disabled = true;
            btn.innerText = 'Saving…';

            var body = 'category_id=' + encodeURIComponent(CATEGORY_ID) +
                '&candidate_id=' + encodeURIComponent(candId);
            modalInputs().forEach(function (inp) {
                var cid = inp.getAttribute('data-crit');
                var v = inp.value === '' ? 0 : inp.value;
                body += '&scores[' + encodeURIComponent(cid) + ']=' + encodeURIComponent(v);
            });

            fetch(SAVE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            }).then(function (r) {
                return r.json();
            }).then(function (data) {
                btn.disabled = false;
                btn.innerText = 'Save';
                if (!data || !data.success) {
                    showToast((data && data.message) || 'Could not save scores.', true);
                    return;
                }
                EXISTING[candId] = data.scores;
                updateRowDisplay(candId, data.scores, data.total);
                closeScoreModal();
                showToast('Saved candidate #' + (CANDNUM[candId] || candId));
            }).catch(function () {
                btn.disabled = false;
                btn.innerText = 'Save';
                showToast('Network error — scores not saved.', true);
            });
        }

        function updateRowDisplay(candId, scores, total) {
            CRITERIA.forEach(function (c) {
                var cell = document.getElementById('cell-' + candId + '-' + c.id);
                if (!cell) return;
                var v = scores[c.id];
                cell.innerText = fmt(v);
                cell.classList.remove('empty');
            });
            var totalCell = document.getElementById('rowtotal-' + candId);
            if (totalCell) totalCell.innerText = fmt(total);
            var status = document.getElementById('status-' + candId);
            if (status) {
                status.className = 'row-status scored';
                status.innerText = 'Scored';
            }
            recomputeRanks();
        }

        function setRank(candId, val, isTop) {
            var cell = document.getElementById('rank-' + candId);
            if (!cell) return;
            if (val === null) {
                cell.className = 'rank-cell empty';
                cell.innerText = '—';
            } else {
                cell.className = 'rank-cell' + (isTop ? ' top' : '');
                cell.innerHTML = '<span class="rank-badge">' + val + '</span>';
            }
        }

        // Auto-rank candidates by this judge's total for the segment (highest = 1).
        // Only scored candidates are ranked; ties share a rank.
        function recomputeRanks() {
            var scored = [];
            var rows = Array.prototype.slice.call(document.querySelectorAll('.score-row'));
            rows.forEach(function (tr) {
                var candId = tr.id.replace('row-', '');
                if (EXISTING[candId] === undefined) {
                    setRank(candId, null);
                    return;
                }
                var totalEl = document.getElementById('rowtotal-' + candId);
                scored.push({ candId: candId, total: totalEl ? (parseFloat(totalEl.innerText) || 0) : 0 });
            });

            scored.sort(function (a, b) { return b.total - a.total; });

            var rank = 0, count = 0, prevTotal = null;
            scored.forEach(function (r) {
                count++;
                if (prevTotal === null || r.total !== prevTotal) {
                    rank = count;
                    prevTotal = r.total;
                }
                setRank(r.candId, rank, rank === 1);
            });
        }

        recomputeRanks();
    </script>

</body>

</html>
