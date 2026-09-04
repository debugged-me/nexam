<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $page_title ?> | Binibining Mati</title>
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

        .judge-header-user {
            font-size: .82rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .judge-main {
            padding: 0 1.5rem 2rem;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }

        .judge-welcome {
            margin-bottom: 1.5rem;
        }

        .judge-welcome h1 {
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: .25rem;
        }

        .judge-welcome p {
            color: var(--text-secondary);
            font-size: .9rem;
            margin: 0;
        }

        .segment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.2rem;
        }

        .segment-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 1.4rem;
            transition: box-shadow .2s, transform .2s;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .segment-card:hover {
            box-shadow: 0 8px 30px rgba(0, 0, 0, .06);
            transform: translateY(-2px);
        }

        .segment-card .seg-header {
            display: flex;
            align-items: center;
            gap: .8rem;
            margin-bottom: .8rem;
        }

        .segment-card .seg-icon {
            width: 42px;
            height: 42px;
            background: var(--soft);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gold);
        }

        .segment-card .seg-icon svg {
            width: 20px;
            height: 20px;
        }

        .segment-card .seg-title {
            font-weight: 700;
            font-size: 1rem;
            color: var(--text);
        }

        .segment-card .seg-sub {
            font-size: .78rem;
            color: var(--text-secondary);
        }

        .segment-card .seg-status {
            display: inline-block;
            margin-top: .8rem;
            padding: .35rem .75rem;
            border-radius: 20px;
            font-size: .72rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: .04em;
        }

        .seg-status.open {
            background: #ecfdf5;
            color: #059669;
        }

        .seg-status.pending {
            background: #fff7ed;
            color: #d97706;
        }

        .seg-status.done {
            background: #f1f5f9;
            color: #64748b;
        }

        .seg-status.locked {
            background: #fef2f2;
            color: #b91c1c;
        }

        .progress-bar-wrap {
            margin-top: .8rem;
            height: 6px;
            background: #f1f5f9;
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-bar-fill {
            height: 100%;
            background: var(--gold);
            border-radius: 3px;
            transition: width .4s ease;
        }

        .progress-text {
            font-size: .72rem;
            color: var(--text-secondary);
            margin-top: .4rem;
            text-align: right;
        }

        .nav-links {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .nav-links a {
            padding: .5rem 1rem;
            border-radius: 8px;
            font-size: .82rem;
            font-weight: 600;
            text-decoration: none;
            color: var(--text-secondary);
            background: var(--card);
            border: 1px solid var(--border);
            transition: all .15s;
        }

        .nav-links a:hover,
        .nav-links a.active {
            background: var(--gold);
            color: #fff;
            border-color: var(--gold);
        }

        @media(max-width: 480px) {
            .segment-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body>
    <?php $current_page = 'judge_dashboard'; ?>
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
                    <div class="judge-header-title">Judge Dashboard</div>
                    <div class="judge-header-meta">Binibining Mati 2026</div>
                </div>
            </div>
            <div class="judge-header-user"><?= htmlspecialchars($judge->name ?? '') ?></div>
        </header>
        <main class="judge-main">
            <div class="segment-grid" style="margin-top: .5rem;">
                <?php
                $round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];
                foreach ($categories as $cat):
                    $rl = (int)($cat->round_level ?? 0);
                    $total_candidates = $round_candidate_counts[$cat->id] ?? 0;
                    $scored = isset($category_scores[$cat->id]) ? count($category_scores[$cat->id]) : 0;
                    $pct = $total_candidates > 0 ? round(($scored / $total_candidates) * 100) : 0;
                    $is_done = $total_candidates > 0 && $pct >= 100;
                    // A higher round is "locked" until the admin advances candidates into it.
                    $locked = $rl > 0 && $total_candidates === 0;
                    // Admin can also explicitly lock a segment to close its scoring.
                    // Admins viewing the portal are not blocked by this lock.
                    $admin_locked = !empty($cat->is_locked) && empty($is_admin_view);
                ?>
                    <?php if ($admin_locked): ?>
                        <div class="segment-card" style="cursor:not-allowed;opacity:.65">
                            <div class="seg-header">
                                <div class="seg-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <div>
                                    <div class="seg-title"><?= htmlspecialchars($cat->name) ?></div>
                                    <div class="seg-sub"><?= $round_labels[$rl] ?> &middot; Weight: <?= $cat->weight ?>%</div>
                                </div>
                            </div>
                            <span class="seg-status locked">Locked &mdash; scoring closed</span>
                        </div>
                    <?php elseif ($locked): ?>
                        <div class="segment-card" style="cursor:default;opacity:.7">
                            <div class="seg-header">
                                <div class="seg-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <div>
                                    <div class="seg-title"><?= htmlspecialchars($cat->name) ?></div>
                                    <div class="seg-sub"><?= $round_labels[$rl] ?> &middot; Weight: <?= $cat->weight ?>%</div>
                                </div>
                            </div>
                            <span class="seg-status pending">Locked &mdash; awaiting <?= $rl === 1 ? 'Top 10' : 'Top 5' ?></span>
                        </div>
                    <?php else: ?>
                        <a href="<?= site_url('judgedashboard/score/' . $cat->id) ?>" class="segment-card">
                            <div class="seg-header">
                                <div class="seg-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </div>
                                <div>
                                    <div class="seg-title"><?= htmlspecialchars($cat->name) ?></div>
                                    <div class="seg-sub"><?= $round_labels[$rl] ?> &middot; Weight: <?= $cat->weight ?>%</div>
                                </div>
                            </div>
                            <span class="seg-status <?= $is_done ? 'done' : ($pct > 0 ? 'open' : 'pending') ?>">
                                <?= $is_done ? 'Completed' : ($pct > 0 ? 'In Progress' : 'Pending') ?>
                            </span>
                            <div class="progress-bar-wrap">
                                <div class="progress-bar-fill" style="width:<?= $pct ? $pct : 5 ?>%"></div>
                            </div>
                            <div class="progress-text"><?= $scored ?> / <?= $total_candidates ?> candidates scored</div>
                        </a>
                    <?php endif; ?>
                <?php endforeach; ?>
                <?php if (empty($categories)): ?>
                    <div class="empty-note" style="grid-column:1/-1;color:var(--text-secondary);padding:2rem;text-align:center">No segments assigned to you yet.</div>
                <?php endif; ?>
            </div>
        </main>
    </div>

</body>

</html>