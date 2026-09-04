<?php
$page_title = 'Criteria';
$current_page = 'criteria';
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($page_title) ? htmlspecialchars($page_title) . " | " : "" ?>Admin Portal</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#9812;</text></svg>">
    <link href="<?= base_url(); ?>assets/css/bootstrap.min.css" rel="stylesheet">
    <link href="<?= base_url(); ?>assets/css/admin.css?v=7" rel="stylesheet">
    <!-- styles-inlined
        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Regular.ttf") format("truetype");
            font-weight: 400;
            font-display: swap
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Medium.ttf") format("truetype");
            font-weight: 500;
            font-display: swap
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Bold.ttf") format("truetype");
            font-weight: 700;
            font-display: swap
        }

        :root {
            --gold: #B8860B;
            --gold-light: #D4AF37;
            --dark: #1C1C2E;
            --dark2: #2D2B45;
            --bg: #FFFFFF;
            --card: #FFFFFF;
            --text: #111827;
            --muted: #6B7280;
            --border: #E5E7EB;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0
        }

        body {
            font-family: "Karla", sans-serif;
            background: #fff !important;
            color: var(--text);
            min-height: 100vh;
            display: flex
        }

        .sidebar {
            width: 260px;
            background: linear-gradient(160deg, var(--dark) 0%, var(--dark2) 100%);
            color: #fff;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            position: fixed;
            height: 100vh;
            overflow-y: auto
        }

        .sidebar-brand {
            padding: 1.5rem;
            display: flex;
            align-items: center;
            gap: .6rem;
            border-bottom: 1px solid rgba(212, 175, 55, .15)
        }

        .sidebar-brand-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem
        }

        .sidebar-brand-text {
            font-weight: 600;
            font-size: 1.05rem
        }

        .sidebar-brand-text small {
            display: block;
            font-size: .65rem;
            opacity: .6;
            font-weight: 500;
            letter-spacing: .08em
        }

        .sidebar-nav {
            flex: 1;
            padding: 1rem 0;
            display: flex;
            flex-direction: column
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: .8rem;
            padding: .75rem 1.5rem;
            color: rgba(255, 255, 255, .65);
            font-size: .85rem;
            text-decoration: none;
            transition: .2s;
            border-left: 3px solid transparent
        }

        .nav-item:hover,
        .nav-item.active {
            color: #fff;
            border-left-color: var(--gold-light);
            background: rgba(212, 175, 55, .08)
        }

        .nav-item svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            opacity: .7
        }

        .sidebar-footer {
            padding: 1rem 1.5rem;
            border-top: 1px solid rgba(212, 175, 55, .15);
            font-size: .75rem;
            color: rgba(255, 255, 255, .5)
        }

        .main {
            flex: 1;
            margin-left: 260px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background: #fff
        }

        .content {
            background: #fff
        }

        .topbar {
            background: #fff;
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100
        }

        .topbar-title {
            font-size: 1.1rem;
            font-weight: 600
        }

        .topbar-user {
            display: flex;
            align-items: center;
            gap: .6rem;
            font-size: .85rem;
            color: var(--muted)
        }

        .topbar-user-name {
            color: var(--text);
            font-weight: 500
        }

        .topbar-logout {
            color: var(--gold);
            font-size: .78rem;
            text-decoration: none;
            padding: .35rem .8rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            transition: .2s
        }

        .topbar-logout:hover {
            background: var(--gold);
            color: #fff;
            border-color: var(--gold)
        }

        .content {
            flex: 1;
            padding: 2rem
        }

        .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem
        }

        .page-header h1 {
            font-size: 1.3rem;
            font-weight: 600
        }

        .btn-gold {
            padding: .55rem 1.2rem;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: #fff;
            font-size: .78rem;
            font-weight: 500;
            letter-spacing: .05em;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: .2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: .4rem
        }

        .btn-gold:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(184, 134, 11, .3)
        }

        .btn-outline {
            padding: .55rem 1.2rem;
            background: transparent;
            color: var(--gold);
            font-size: .78rem;
            font-weight: 500;
            border: 1.5px solid var(--gold);
            border-radius: 8px;
            cursor: pointer;
            transition: .2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: .4rem
        }

        .btn-outline:hover {
            background: var(--gold);
            color: #fff
        }

        .btn-sm {
            padding: .4rem .9rem;
            font-size: .72rem;
            border-radius: 6px
        }

        .table-wrap {
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: .85rem
        }

        thead th {
            background: #F9FAFB;
            padding: .85rem 1.2rem;
            text-align: left;
            font-weight: 600;
            color: var(--muted);
            font-size: .75rem;
            letter-spacing: .05em;
            text-transform: uppercase;
            border-bottom: 1px solid var(--border)
        }

        tbody td {
            padding: .8rem 1.2rem;
            border-bottom: 1px solid #F3F4F6;
            vertical-align: middle
        }

        tbody tr:last-child td {
            border-bottom: none
        }

        tbody tr:hover {
            background: #F9FAFB;
        }

        .badge {
            display: inline-block;
            padding: .2rem .55rem;
            border-radius: 20px;
            font-size: .7rem;
            font-weight: 500;
            letter-spacing: .03em
        }

        .badge-active {
            background: rgba(34, 197, 94, .1);
            color: #15803d
        }

        .badge-inactive {
            background: rgba(239, 68, 68, .1);
            color: #b91c1c
        }

        .badge-admin {
            background: rgba(184, 134, 11, .1);
            color: var(--gold)
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1.2rem;
            margin-bottom: 2rem
        }

        .stat-card {
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.2rem 1.4rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, .03)
        }

        .stat-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(212, 175, 55, .12), rgba(184, 134, 11, .08));
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gold);
            flex-shrink: 0
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            line-height: 1
        }

        .stat-label {
            font-size: .72rem;
            color: var(--muted);
            margin-top: .2rem;
            letter-spacing: .08em;
            text-transform: uppercase
        }

        .modal-content {
            border-radius: 14px;
            border: 1px solid var(--border);
            overflow: hidden;
            box-shadow: 0 24px 60px rgba(0, 0, 0, .12)
        }

        .modal-header {
            border-bottom: 1px solid var(--border);
            padding: 1.2rem 1.5rem .8rem;
            background: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: space-between
        }

        .modal-header .modal-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -.01em;
            margin: 0
        }

        .modal-header .close,
        .modal-header .btn-close {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: none;
            border: none;
            color: var(--muted);
            font-size: 1.4rem;
            cursor: pointer;
            transition: .2s;
            opacity: 1;
            padding: 0;
            margin: 0
        }

        .modal-header .close:hover,
        .modal-header .btn-close:hover {
            background: rgba(184, 134, 11, .06);
            color: var(--gold)
        }

        .modal-body {
            padding: 1.2rem 1.5rem
        }

        .modal-footer {
            border-top: 1px solid var(--border);
            padding: 1rem 1.5rem;
            background: #FFFFFF;
            display: flex;
            justify-content: flex-end;
            gap: .5rem
        }

        .form-label {
            font-size: .75rem;
            font-weight: 500;
            margin-bottom: .35rem;
            color: var(--muted)
        }

        .form-control,
        .form-select {
            font-size: .85rem;
            padding: .65rem .9rem;
            border: 1.5px solid var(--border);
            border-radius: 8px;
            background: var(--card)
        }

        .form-control:focus,
        .form-select:focus {
            border-color: var(--gold);
            box-shadow: 0 0 0 3px rgba(184, 134, 11, .08)
        }

        .actions {
            display: flex;
            gap: .4rem;
            flex-wrap: wrap
        }

        .modal-backdrop {
            background: transparent !important
        }

        .modal-backdrop.show {
            background: rgba(0, 0, 0, .03) !important;
            opacity: 1 !important
        }

        .modal-open .content,
        .modal-open .topbar,
        .modal-open .sidebar {
            -webkit-filter: none !important;
            filter: none !important
        }

        .modal-content {
            box-shadow: 0 20px 50px rgba(0, 0, 0, .08)
        }

        .modal-dialog {
            max-width: 720px;
            width: 92%
        }

        .modal-content {
            border-radius: 16px;
            border: 1px solid rgba(184, 134, 11, .12);
            overflow: hidden;
            box-shadow: 0 32px 80px rgba(0, 0, 0, .12);
            background: #fff
        }

        .modal-header {
            border-bottom: 1px solid rgba(184, 134, 11, .1);
            padding: 1.4rem 2rem;
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between
        }

        .modal-header .modal-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: #1C1C2E;
            letter-spacing: -.01em;
            margin: 0
        }

        .modal-header .close {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: #f8f6f3;
            border: none;
            color: #6B7280;
            font-size: 1.6rem;
            line-height: 1;
            cursor: pointer;
            transition: .2s;
            opacity: 1;
            padding: 0;
            margin: 0
        }

        .modal-header .close:hover {
            background: rgba(184, 134, 11, .1);
            color: var(--gold)
        }

        .modal-body {
            padding: 2rem
        }

        .modal-footer {
            border-top: 1px solid rgba(184, 134, 11, .1);
            padding: 1.2rem 2rem;
            background: #faf9f7;
            display: flex;
            justify-content: flex-end;
            gap: .75rem
        }

        .modal-form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.2rem 1.5rem
        }

        .modal-form-grid .form-group-full {
            grid-column: 1 / -1
        }

        .modal-form-grid label {
            font-size: .78rem;
            font-weight: 600;
            color: #4b5563;
            margin-bottom: .4rem;
            display: block;
            letter-spacing: .02em
        }

        .modal-form-grid input,
        .modal-form-grid select,
        .modal-form-grid textarea {
            width: 100%;
            padding: .75rem 1rem;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            font-size: .88rem;
            font-family: "Karla", sans-serif;
            background: #fff;
            color: #111827;
            transition: .2s
        }

        .modal-form-grid input:focus,
        .modal-form-grid select:focus,
        .modal-form-grid textarea:focus {
            outline: none;
            border-color: var(--gold);
            box-shadow: 0 0 0 3px rgba(184, 134, 11, .1)
        }

        .modal-form-grid input::placeholder,
        .modal-form-grid textarea::placeholder {
            color: #9ca3af
        }

        .modal-footer .btn-outline {
            padding: .65rem 1.6rem;
            background: #fff;
            color: #6b7280;
            font-family: "Karla", sans-serif;
            font-size: .82rem;
            font-weight: 500;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            cursor: pointer;
            transition: .2s
        }

        .modal-footer .btn-outline:hover {
            border-color: var(--gold);
            color: var(--gold);
            background: rgba(184, 134, 11, .04)
        }

        .modal-footer .btn-gold {
            padding: .65rem 1.8rem;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: #fff;
            font-family: "Karla", sans-serif;
            font-size: .82rem;
            font-weight: 500;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: .2s;
            box-shadow: 0 4px 16px rgba(184, 134, 11, .25)
        }

        .modal-footer .btn-gold:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(184, 134, 11, .35)
        }

        .modal-backdrop {
            background: transparent !important
        }

        .modal-backdrop.show {
            background: rgba(0, 0, 0, .04) !important;
            opacity: 1 !important
        }

        @media(max-width:768px) {
            .sidebar {
                width: 100%;
                position: relative;
                height: auto
            }

            .main {
                margin-left: 0
            }

            .content {
                padding: 1rem
            }

            .stats-grid {
                grid-template-columns: repeat(2, 1fr)
            }
        }

        @media(max-width:600px) {
            .sidebar {
                display: none
            }

            .stats-grid {
                grid-template-columns: 1fr
            }
        }
    end-styles-inlined -->
</head>

<body>

    <?php $this->load->view("includes/sidebar"); ?>

    <div class="main">

        <?php $this->load->view('includes/top-nav-bar', ['page_title' => $page_title ?? 'Criteria']); ?>

        <main class="content">

            <style>
                .round-pill {
                    display: inline-block;
                    padding: .2rem .6rem;
                    border-radius: 20px;
                    font-size: .7rem;
                    font-weight: 600;
                    white-space: nowrap;
                }
                .round-pill.round-0 { background: #eef2ff; color: #4338ca; }
                .round-pill.round-1 { background: #fef3c7; color: #92400e; }
                .round-pill.round-2 { background: #fce7f3; color: #9d174d; }
                .crit-group { margin-bottom: 1.75rem; }
                .crit-group-header {
                    display: flex;
                    align-items: center;
                    gap: .6rem;
                    flex-wrap: wrap;
                    margin: 0 .15rem .6rem;
                }
                .crit-group-header .crit-group-title {
                    font-size: .95rem;
                    font-weight: 700;
                    color: var(--text, #111827);
                }
                .crit-group-header .crit-group-meta {
                    font-size: .72rem;
                    color: #9ca3af;
                    font-weight: 500;
                }
                .crit-group-header .crit-group-meta.warn { color: #b91c1c; }
            </style>

            <?php if ($this->session->flashdata("success")): ?>
                <div class="alert-custom alert-custom-success">
                    <?= htmlspecialchars($this->session->flashdata("success")) ?>
                </div>
            <?php endif; ?>

            <?php if ($this->session->flashdata("error")): ?>
                <div class="alert-custom alert-custom-danger">
                    <?= htmlspecialchars($this->session->flashdata("error")) ?>
                </div>
            <?php endif; ?>

            <div class="table-toolbar" style="display:flex; align-items:center; justify-content:flex-end; margin-bottom:1rem;">
                <button type="button" class="btn-gold" data-toggle="modal" data-target="#criteriaModal" onclick="resetForm()">
                    + Add Criteria
                </button>
            </div>

            <?php
            $round_labels = [0 => 'Preliminary', 1 => 'Top 10 round', 2 => 'Top 5 round'];
            // Group criteria under their category. The controller orders by
            // round_level, category order, then criteria order, so groups come
            // out in sequence.
            $groups = [];
            foreach ($criteria as $c) {
                $cid = $c->category_id;
                if (!isset($groups[$cid])) {
                    $groups[$cid] = [
                        'name' => $c->category_name ?? '—',
                        'round_level' => (int)($c->round_level ?? 0),
                        'items' => [],
                    ];
                }
                $groups[$cid]['items'][] = $c;
            }
            ?>

            <?php if (empty($criteria)): ?>
                <div class="table-card" style="padding:2.5rem 1.5rem;text-align:center;color:#9ca3af">
                    No criteria yet. Add criteria to a category to start scoring.
                </div>
            <?php endif; ?>

            <?php foreach ($groups as $cid => $g):
                $total_max = 0;
                foreach ($g['items'] as $it) $total_max += floatval($it->max_score);
                $total_str = rtrim(rtrim(number_format($total_max, 2), '0'), '.');
            ?>
                <div class="crit-group">
                    <div class="crit-group-header">
                        <span class="crit-group-title"><?= htmlspecialchars($g['name']) ?></span>
                        <span class="round-pill round-<?= $g['round_level'] ?>"><?= $round_labels[$g['round_level']] ?? 'Preliminary' ?></span>
                        <span class="crit-group-meta<?= abs($total_max - 100) > 0.001 ? ' warn' : '' ?>">
                            <?= count($g['items']) ?> criteri<?= count($g['items']) === 1 ? 'on' : 'a' ?> &middot; total <?= $total_str ?><?= abs($total_max - 100) > 0.001 ? ' (should be 100)' : '' ?>
                        </span>
                    </div>

                    <div class="table-card">
                        <div class="table-responsive-custom">
                            <table class="events-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Max Score</th>
                                        <th style="width:130px; text-align:right;">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <?php foreach ($g['items'] as $c): ?>
                                        <tr>
                                            <td data-label="Name">
                                                <div class="event-name-cell">
                                                    <div class="event-avatar">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                            <polyline points="14 2 14 8 20 8"></polyline>
                                                        </svg>
                                                    </div>

                                                    <div>
                                                        <div class="event-name-text"><?= htmlspecialchars($c->name) ?></div>
                                                        <div class="event-code-text">Criteria ID: <?= htmlspecialchars($c->id) ?></div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td data-label="Max Score" class="date-cell">
                                                <?= htmlspecialchars($c->max_score) ?>
                                            </td>

                                            <td data-label="Actions">
                                                <div class="table-actions">
                                                    <button
                                                        type="button"
                                                        class="btn-action btn-action-edit"
                                                        title="Edit Criteria"
                                                        data-toggle="modal"
                                                        data-target="#criteriaModal"
                                                        onclick='fillForm(<?= json_encode($c) ?>)'>

                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <path d="M12 20h9"></path>
                                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                        </svg>
                                                    </button>

                                                    <a
                                                        href="<?= site_url('admin/criteria_delete/' . $c->id) ?>"
                                                        class="btn-action btn-action-delete"
                                                        title="Delete Criteria"
                                                        onclick="return confirm('Delete this criteria?')">

                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6l-1 14H6L5 6"></path>
                                                            <path d="M10 11v6"></path>
                                                            <path d="M14 11v6"></path>
                                                            <path d="M9 6V4h6v2"></path>
                                                        </svg>
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>

            <div class="modal fade" id="criteriaModal" tabindex="-1" role="dialog" aria-labelledby="criteriaModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/criteria_save') ?>" method="post">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Criteria Management</span>
                                    <h5 class="event-modal-title" id="criteriaModalTitle">Add Criteria</h5>
                                    <p class="event-modal-subtitle">Create or update scoring criteria details.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="criteria_id">

                                <div class="event-form-group">
                                    <label for="criteria_name">Criteria Name <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="name" id="criteria_name" required placeholder="Enter criteria name">
                                </div>

                                <div class="event-form-row">
                                    <div class="event-form-group">
                                        <label for="criteria_category">Category <span class="req-label">REQUIRED</span></label>
                                        <select name="category_id" id="criteria_category" required>
                                            <?php foreach ($categories as $cat): ?>
                                                <option value="<?= $cat->id ?>"><?= htmlspecialchars($cat->name) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    </div>

                                    <div class="event-form-group">
                                        <label for="criteria_max">Max Score</label>
                                        <input type="number" step="0.01" name="max_score" id="criteria_max" value="10">
                                    </div>
                                </div>
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Criteria</button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>

        </main>
    </div>

    <script src="<?= base_url(); ?>assets/js/jquery-3.6.0.min.js"></script>
    <script src="<?= base_url(); ?>assets/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="<?= base_url(); ?>assets/libs/datatables/jquery.dataTables.min.js"></script>

    <script>
        function resetForm() {
            document.getElementById('criteriaModalTitle').innerText = 'Add Criteria';
            document.getElementById('criteria_id').value = '';
            document.getElementById('criteria_name').value = '';
            document.getElementById('criteria_max').value = '10';
            var cat = document.getElementById('criteria_category');
            if (cat) cat.selectedIndex = 0;
        }

        function fillForm(data) {
            document.getElementById('criteriaModalTitle').innerText = 'Edit Criteria';
            document.getElementById('criteria_id').value = data.id || '';
            document.getElementById('criteria_category').value = data.category_id || '';
            document.getElementById('criteria_name').value = data.name || '';
            document.getElementById('criteria_max').value = data.max_score || '';
        }
    </script>

</body>

</html>