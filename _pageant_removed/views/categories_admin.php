<?php
$page_title = 'Categories';
$current_page = 'categories';
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

        <?php $this->load->view('includes/top-nav-bar', ['page_title' => $page_title ?? 'Categories']); ?>

        <main class="content">

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

            <style>
                .round-pill {
                    display: inline-block;
                    padding: .2rem .6rem;
                    border-radius: 20px;
                    font-size: .7rem;
                    font-weight: 600;
                    white-space: nowrap;
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

                .lock-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: .25rem;
                    margin-left: .5rem;
                    padding: .12rem .5rem;
                    border-radius: 20px;
                    background: rgba(239, 68, 68, .1);
                    color: #b91c1c;
                    font-size: .65rem;
                    font-weight: 700;
                    letter-spacing: .04em;
                    text-transform: uppercase;
                    vertical-align: middle;
                }

                .lock-badge svg {
                    width: 11px;
                    height: 11px;
                }

                .btn-action-locked {
                    color: #b91c1c;
                    background: rgba(239, 68, 68, .08);
                    border-color: rgba(239, 68, 68, .25);
                }

                .btn-action-locked:hover {
                    background: rgba(239, 68, 68, .15);
                    color: #991b1b;
                }

                .btn-action-unlocked:hover {
                    color: var(--gold, #b8860b);
                    background: rgba(184, 134, 11, .08);
                }

                .round-group {
                    margin-bottom: 1.75rem;
                }

                .round-group-header {
                    display: flex;
                    align-items: center;
                    gap: .6rem;
                    margin: 0 .15rem .6rem;
                }

                .round-group-header .round-group-count {
                    font-size: .72rem;
                    color: #9ca3af;
                    font-weight: 500;
                }

                .judge-cell-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: .4rem;
                    padding: .35rem .7rem;
                    border: 1px solid var(--border, #e5e7eb);
                    border-radius: 20px;
                    background: #fff;
                    color: var(--text, #111827);
                    font-size: .78rem;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    transition: .15s;
                }

                .judge-cell-btn svg {
                    width: 14px;
                    height: 14px;
                    opacity: .6;
                }

                .judge-cell-btn:hover {
                    border-color: var(--gold, #b8860b);
                    color: var(--gold, #b8860b);
                    background: rgba(184, 134, 11, .04);
                }

                .judge-cell-btn.is-all {
                    color: #9ca3af;
                }

                .judge-checklist {
                    max-height: 180px;
                    overflow-y: auto;
                    border: 1px solid var(--border, #e5e7eb);
                    border-radius: 8px;
                    padding: .5rem .7rem;
                    display: grid;
                    gap: .35rem;
                }

                /* Specificity here intentionally beats admin.css's
                   `.event-form-group label/input` rules, which would otherwise
                   make the label display:block and stretch the checkbox to 100%. */
                .judge-checklist .judge-check {
                    display: flex;
                    align-items: center;
                    gap: .55rem;
                    font-size: .85rem;
                    cursor: pointer;
                    margin: 0;
                    font-weight: 500;
                    text-transform: none;
                    letter-spacing: normal;
                    color: var(--text, #111827);
                }

                .judge-checklist .judge-check input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    min-width: 0;
                    min-height: 0;
                    padding: 0;
                    margin: 0;
                    border-radius: 4px;
                    flex-shrink: 0;
                    accent-color: var(--gold, #b8860b);
                }

                .judge-checklist .judge-check span {
                    line-height: 1.2;
                }

                /* Specificity beats admin.css's .event-form-group label/input. */
                .event-form-group .apply-round-check {
                    display: flex;
                    align-items: center;
                    gap: .55rem;
                    margin: .7rem 0 0;
                    font-size: .82rem;
                    font-weight: 500;
                    text-transform: none;
                    letter-spacing: normal;
                    color: var(--text, #111827);
                    cursor: pointer;
                }

                .event-form-group .apply-round-check input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    min-width: 0;
                    min-height: 0;
                    padding: 0;
                    margin: 0;
                    border-radius: 4px;
                    flex-shrink: 0;
                    accent-color: var(--gold, #b8860b);
                }

                .event-form-group .apply-round-check strong {
                    font-weight: 700;
                }
            </style>

            <div class="table-toolbar" style="display:flex; align-items:center; justify-content:flex-end; margin-bottom:1rem;">
                <button type="button" class="btn-gold" data-toggle="modal" data-target="#categoryModal" onclick="resetForm()">
                    + Add Category
                </button>
            </div>

            <?php
            $round_labels = [0 => 'Preliminary — all candidates', 1 => 'Top 10 round', 2 => 'Top 5 round'];
            // Group categories by round so the list stays uniform. Controller already
            // orders by round_level then order_num, so groups come out in sequence.
            $groups = [];
            foreach ($categories as $c) {
                $groups[(int)($c->round_level ?? 0)][] = $c;
            }
            ksort($groups);
            ?>

            <?php if (empty($categories)): ?>
                <div class="table-card" style="padding:2.5rem 1.5rem;text-align:center;color:#9ca3af">
                    No categories yet. Create your first category to start scoring.
                </div>
            <?php endif; ?>

            <?php foreach ($groups as $rl => $cats): ?>
                <div class="round-group">
                    <div class="round-group-header">
                        <span class="round-pill round-<?= $rl ?>"><?= $round_labels[$rl] ?? 'Preliminary' ?></span>
                        <span class="round-group-count"><?= count($cats) ?> categor<?= count($cats) === 1 ? 'y' : 'ies' ?></span>
                    </div>

                    <div class="table-card">
                        <div class="table-responsive-custom">
                            <table class="events-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Weight</th>
                                        <th>Judges</th>
                                        <th style="width:130px; text-align:right;">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <?php foreach ($cats as $c): $assigned_ids = $assigned[$c->id] ?? []; ?>
                                        <tr>
                                            <td data-label="Name">
                                                <div class="event-name-cell">
                                                    <div class="event-avatar">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                        </svg>
                                                    </div>

                                                    <div>
                                                        <div class="event-name-text">
                                                            <?= htmlspecialchars($c->name) ?>
                                                            <?php if (!empty($c->is_locked)): ?>
                                                                <span class="lock-badge" title="Locked — judges cannot score this segment">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                                    </svg>
                                                                    Locked
                                                                </span>
                                                            <?php endif; ?>
                                                        </div>
                                                        <div class="event-code-text">Category ID: <?= htmlspecialchars($c->id) ?><?= !empty($c->segment_date) ? ' &middot; ' . htmlspecialchars(date('M j', strtotime($c->segment_date))) : '' ?></div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td data-label="Weight" class="date-cell">
                                                <?= htmlspecialchars($c->weight) ?>%
                                            </td>

                                            <td data-label="Judges">
                                                <button
                                                    type="button"
                                                    class="judge-cell-btn <?= empty($assigned_ids) ? 'is-all' : '' ?>"
                                                    title="Assign judges to this category"
                                                    data-toggle="modal"
                                                    data-target="#categoryModal"
                                                    onclick='fillForm(<?= json_encode($c) ?>)'>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="9" cy="7" r="4"></circle>
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                    </svg>
                                                    <?= empty($assigned_ids) ? 'All judges' : count($assigned_ids) . ' assigned' ?>
                                                </button>
                                            </td>

                                            <td data-label="Actions">
                                                <div class="table-actions">
                                                    <a
                                                        href="<?= site_url('admin/category_lock_toggle/' . $c->id) ?>"
                                                        class="btn-action <?= !empty($c->is_locked) ? 'btn-action-locked' : 'btn-action-unlocked' ?>"
                                                        title="<?= !empty($c->is_locked) ? 'Unlock — let judges score this segment' : 'Lock — stop judges from scoring this segment' ?>"
                                                        onclick="return confirm('<?= !empty($c->is_locked) ? 'Unlock this category so judges can score it again?' : 'Lock this category? Judges will no longer be able to open or modify its scores.' ?>')">
                                                        <?php if (!empty($c->is_locked)): ?>
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                                <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                                            </svg>
                                                        <?php else: ?>
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                            </svg>
                                                        <?php endif; ?>
                                                    </a>

                                                    <button
                                                        type="button"
                                                        class="btn-action btn-action-edit"
                                                        title="Edit Category"
                                                        data-toggle="modal"
                                                        data-target="#categoryModal"
                                                        onclick='fillForm(<?= json_encode($c) ?>)'>

                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <path d="M12 20h9"></path>
                                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                        </svg>
                                                    </button>

                                                    <a
                                                        href="<?= site_url('admin/category_delete/' . $c->id) ?>"
                                                        class="btn-action btn-action-delete"
                                                        title="Delete Category"
                                                        onclick="return confirm('Delete this category?')">

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

            <div class="modal fade" id="categoryModal" tabindex="-1" role="dialog" aria-labelledby="categoryModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/category_save') ?>" method="post">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Category Management</span>
                                    <h5 class="event-modal-title" id="categoryModalTitle">Add Category</h5>
                                    <p class="event-modal-subtitle">Create or update scoring category details.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="category_id">

                                <div class="event-form-group">
                                    <label for="category_name">Category Name <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="name" id="category_name" required placeholder="e.g. Swimsuit, Evening Gown, Prelim Q&A">
                                </div>

                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                                    <div class="event-form-group">
                                        <label for="category_round">Round</label>
                                        <select name="round_level" id="category_round">
                                            <option value="0">Preliminary &mdash; all candidates</option>
                                            <option value="1">Top 10 round (e.g. Prelim Q&amp;A)</option>
                                            <option value="2">Top 5 round (e.g. Final Q&amp;A)</option>
                                        </select>
                                    </div>
                                    <div class="event-form-group">
                                        <label for="category_weight">Weight (%)</label>
                                        <input type="number" step="0.01" name="weight" id="category_weight" value="100">
                                    </div>
                                </div>

                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                                    <div class="event-form-group">
                                        <label for="category_date">Segment Date</label>
                                        <input type="date" name="segment_date" id="category_date">
                                    </div>
                                    <div class="event-form-group">
                                        <label for="category_order">Display Order</label>
                                        <input type="number" name="order_num" id="category_order" value="0">
                                    </div>
                                </div>

                                <div class="event-form-group">
                                    <label>Judge Panel <span style="font-weight:400;color:#9ca3af">&mdash; leave all unchecked to allow every judge</span></label>
                                    <div class="judge-checklist">
                                        <?php foreach ($judges as $j): ?>
                                            <label class="judge-check">
                                                <input type="checkbox" class="cat-judge" name="judges[]" value="<?= htmlspecialchars($j->judge_id) ?>">
                                                <span><?= htmlspecialchars($j->name) ?> <small style="color:#9ca3af">(<?= htmlspecialchars($j->judge_id) ?>)</small></span>
                                            </label>
                                        <?php endforeach; ?>
                                        <?php if (empty($judges)): ?>
                                            <div style="color:#9ca3af;font-size:.85rem">No judges yet. Add judges under Users first.</div>
                                        <?php endif; ?>
                                    </div>

                                    <label class="apply-round-check">
                                        <input type="checkbox" name="apply_to_round" id="apply_to_round" value="1">
                                        <span>Apply this same panel to <strong>all segments in this round</strong></span>
                                    </label>
                                </div>
                                <!-- hidden marker so an empty panel still posts (clears assignments) -->
                                <input type="hidden" name="judges[]" value="">
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Category</button>
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
        // category_id => [assigned judge_id, ...]
        var CATEGORY_JUDGES = <?= json_encode($assigned ?? new stdClass()) ?>;

        function setJudgeChecks(ids) {
            ids = ids || [];
            document.querySelectorAll('.cat-judge').forEach(function(cb) {
                cb.checked = ids.indexOf(cb.value) !== -1;
            });
            // "Apply to all in round" is a one-time action — never pre-checked.
            var applyAll = document.getElementById('apply_to_round');
            if (applyAll) applyAll.checked = false;
        }

        function resetForm() {
            document.getElementById('categoryModalTitle').innerText = 'Add Category';
            document.getElementById('category_id').value = '';
            document.getElementById('category_name').value = '';
            document.getElementById('category_weight').value = '100';
            document.getElementById('category_round').value = '0';
            document.getElementById('category_date').value = '';
            document.getElementById('category_order').value = '0';
            setJudgeChecks([]);
        }

        function fillForm(data) {
            document.getElementById('categoryModalTitle').innerText = 'Edit Category';
            document.getElementById('category_id').value = data.id || '';
            document.getElementById('category_name').value = data.name || '';
            document.getElementById('category_weight').value = data.weight || '';
            document.getElementById('category_round').value = (data.round_level != null ? data.round_level : 0);
            document.getElementById('category_date').value = data.segment_date || '';
            document.getElementById('category_order').value = (data.order_num != null ? data.order_num : 0);
            setJudgeChecks(CATEGORY_JUDGES[data.id] || []);
        }
    </script>

</body>

</html>