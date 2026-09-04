<?php
$page_title = 'Users';
$current_page = 'judges';
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

        .tabs {
            display: flex;
            gap: .5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border)
        }

        .tab {
            padding: .6rem 1.2rem;
            font-size: .85rem;
            font-weight: 500;
            color: var(--muted);
            border-bottom: 2px solid transparent;
            cursor: pointer;
            transition: .2s;
            background: none;
            border-top: none;
            border-left: none;
            border-right: none
        }

        .tab.active {
            color: var(--gold);
            border-bottom-color: var(--gold)
        }

        .tab:hover {
            color: var(--text)
        }

        .tab-panel {
            display: none
        }

        .tab-panel.active {
            display: block
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

        <?php $this->load->view('includes/top-nav-bar', ['page_title' => $page_title ?? 'Users']); ?>

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

            <div class="admin-tabs">
                <button class="admin-tab active" onclick="showTab('judges', this)">Judges</button>
                <button class="admin-tab" onclick="showTab('coadmins', this)">Staff (Co-Admins / Tabulators)</button>
            </div>

            <div id="panel-judges" class="tab-panel active">
                <div class="table-card">
                    <div class="table-toolbar" style="display:flex; align-items:center; justify-content:flex-end;">
                        <button type="button" class="btn-gold" data-toggle="modal" data-target="#judgeModal" onclick="resetJudgeForm()">
                            + Add Judge
                        </button>
                    </div>

                    <div class="table-responsive-custom">
                        <table id="judgesDataTable" class="events-table display">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th style="width:130px; text-align:right;">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <?php foreach ($judges as $j): ?>
                                    <?php $jActive = (int)($j->is_active ?? 1); ?>
                                    <tr>
                                        <td data-label="Name">
                                            <div class="event-name-cell">
                                                <div class="event-avatar">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="9" cy="7" r="4"></circle>
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                    </svg>
                                                </div>

                                                <div>
                                                    <div class="event-name-text">
                                                        <?= htmlspecialchars($j->name) ?>
                                                        <?php if (!empty($j->identifier)): ?>
                                                            <span class="status-badge status-completed" style="margin-left:.4rem"><?= htmlspecialchars($j->identifier) ?></span>
                                                        <?php endif; ?>
                                                    </div>
                                                    <div class="event-code-text">Judge ID: <?= htmlspecialchars($j->judge_id) ?></div>
                                                </div>
                                            </div>
                                        </td>

                                        <td data-label="Email" class="date-cell"><?= htmlspecialchars($j->email ?? '—') ?></td>

                                        <td data-label="Status" data-order="<?= $jActive ? 'active' : 'inactive' ?>">
                                            <span class="status-badge <?= $jActive ? 'status-active' : 'status-inactive' ?>">
                                                <?= $jActive ? 'Active' : 'Inactive' ?>
                                            </span>
                                        </td>

                                        <td data-label="Actions">
                                            <div class="table-actions">
                                                <button
                                                    type="button"
                                                    class="btn-action btn-action-edit"
                                                    title="Edit Judge"
                                                    data-toggle="modal"
                                                    data-target="#judgeModal"
                                                    onclick='fillJudgeForm(<?= json_encode($j) ?>)'>

                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M12 20h9"></path>
                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                    </svg>
                                                </button>

                                                <a
                                                    href="<?= site_url('admin/judge_delete/' . $j->id) ?>"
                                                    class="btn-action btn-action-delete"
                                                    title="Delete Judge"
                                                    onclick="return confirm('Delete this judge?')">

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

            <div id="panel-coadmins" class="tab-panel">
                <div class="table-card">
                    <div class="table-toolbar" style="display:flex; align-items:center; justify-content:flex-end;">
                        <button type="button" class="btn-gold" data-toggle="modal" data-target="#coadminModal" onclick="resetCoForm()">
                            + Add Staff Account
                        </button>
                    </div>

                    <div class="table-responsive-custom">
                        <table id="coadminsDataTable" class="events-table display">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th style="width:130px; text-align:right;">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <?php foreach ($coadmins as $a): ?>
                                    <?php $aActive = (int)($a->is_active ?? 1); ?>
                                    <tr>
                                        <td data-label="Name">
                                            <div class="event-name-cell">
                                                <div class="event-avatar">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                    </svg>
                                                </div>

                                                <div>
                                                    <div class="event-name-text"><?= htmlspecialchars($a->name) ?></div>
                                                    <div class="event-code-text">@<?= htmlspecialchars($a->username) ?></div>
                                                </div>
                                            </div>
                                        </td>

                                        <td data-label="Role" data-order="<?= htmlspecialchars($a->role) ?>">
                                            <span class="status-badge status-completed"><?= ucfirst(htmlspecialchars($a->role)) ?></span>
                                        </td>

                                        <td data-label="Status" data-order="<?= $aActive ? 'active' : 'inactive' ?>">
                                            <span class="status-badge <?= $aActive ? 'status-active' : 'status-inactive' ?>">
                                                <?= $aActive ? 'Active' : 'Inactive' ?>
                                            </span>
                                        </td>

                                        <td data-label="Actions">
                                            <div class="table-actions">
                                                <button
                                                    type="button"
                                                    class="btn-action btn-action-edit"
                                                    title="Edit Account"
                                                    data-toggle="modal"
                                                    data-target="#coadminModal"
                                                    onclick='fillCoForm(<?= json_encode($a) ?>)'>

                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M12 20h9"></path>
                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                    </svg>
                                                </button>

                                                <a
                                                    href="<?= site_url('admin/coadmin_delete/' . $a->id) ?>"
                                                    class="btn-action btn-action-delete"
                                                    title="Delete Account"
                                                    onclick="return confirm('Delete this staff account?')">

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

            <div class="modal fade" id="judgeModal" tabindex="-1" role="dialog" aria-labelledby="judgeModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/judge_save') ?>" method="post" id="judgeForm">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Judge Management</span>
                                    <h5 class="event-modal-title" id="judgeModalTitle">Add Judge</h5>
                                    <p class="event-modal-subtitle">Create or update judge account details.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="judge_id">

                                <div class="event-form-group" id="judge_jid_auto_wrap">
                                    <label>Judge ID</label>
                                    <div class="event-form-control" style="background:var(--soft);color:var(--text-secondary);font-weight:500" id="judge_jid_display">—</div>
                                </div>

                                <div class="event-form-group" style="display:none" id="judge_jid_custom_wrap">
                                    <label for="judge_custom_jid">Manual</label>
                                    <input type="text" name="custom_judge_id" id="judge_custom_jid" placeholder="e.g. JUDGE005">
                                    <small id="judge_custom_jid_msg" style="display:block;margin-top:.35rem;font-size:.75rem;color:var(--text-secondary)"></small>
                                </div>

                                <div class="event-form-group">
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="judge_use_custom" onchange="toggleCustomJudgeId(this.checked)">
                                        <span class="toggle-slider"></span>
                                        <span class="toggle-label">Manual</span>
                                    </label>
                                </div>

                                <div class="event-form-group">
                                    <label for="judge_identifier">Identifier <span style="font-weight:400;color:var(--text-secondary)">&mdash; label on the score &amp; tabulation sheets</span></label>
                                    <input type="text" name="identifier" id="judge_identifier" placeholder="e.g. Judge 1">
                                </div>

                                <div class="event-form-group">
                                    <label for="judge_name">Name <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="name" id="judge_name" required placeholder="Enter judge name">
                                </div>

                                <div class="event-form-row">
                                    <div class="event-form-group">
                                        <label for="judge_email">Email</label>
                                        <input type="email" name="email" id="judge_email" placeholder="name@example.com">
                                    </div>

                                    <div class="event-form-group">
                                        <label for="judge_pw">Password</label>
                                        <div class="pw-input-wrap">
                                            <input type="password" name="password" id="judge_pw" placeholder="Leave blank to keep">
                                            <button type="button" class="pw-toggle-btn" onclick="togglePw('judge_pw', this)" title="Show password">
                                                <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                </svg>
                                                <svg class="eye-closed" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-3.72 1.58A10 10 0 0 1 12 14a3 3 0 0 1-3-3M1 1l22 22"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Judge</button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="coadminModal" tabindex="-1" role="dialog" aria-labelledby="coadminModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/coadmin_save') ?>" method="post">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Staff Account Management</span>
                                    <h5 class="event-modal-title" id="coadminModalTitle">Add Staff Account</h5>
                                    <p class="event-modal-subtitle">Create or update a co-admin or tabulator account.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="coadmin_id">

                                <div class="event-form-group">
                                    <label for="coadmin_role">Account Role <span class="req-label">REQUIRED</span></label>
                                    <select name="role" id="coadmin_role" required>
                                        <option value="co-admin">Co-Admin &mdash; full admin access</option>
                                        <option value="tabulator">Tabulator &mdash; results &amp; rounds only</option>
                                    </select>
                                </div>

                                <div class="event-form-group">
                                    <label for="coadmin_user">Username <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="username" id="coadmin_user" required placeholder="Enter username">
                                </div>

                                <div class="event-form-row">
                                    <div class="event-form-group">
                                        <label for="coadmin_name">Name <span class="req-label">REQUIRED</span></label>
                                        <input type="text" name="name" id="coadmin_name" required placeholder="Enter name">
                                    </div>

                                    <div class="event-form-group">
                                        <label for="coadmin_pw">Password</label>
                                        <input type="text" name="password" id="coadmin_pw" placeholder="Leave blank to keep">
                                    </div>
                                </div>
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Account</button>
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
        var dtJudges, dtCoadmins;

        $(document).ready(function() {
            var baseOptions = {
                dom: '<"dt-controls"lf>rt<"dt-footer"ip>',
                pageLength: 10,
                lengthMenu: [
                    [5, 10, 25, 50, 100, -1],
                    [5, 10, 25, 50, 100, 'All']
                ],
                ordering: true,
                searching: true,
                responsive: false,
                autoWidth: false,
                scrollX: false,
                order: [
                    [0, 'asc']
                ],
                columnDefs: [{
                    targets: 3,
                    orderable: false,
                    searchable: false
                }]
            };

            dtJudges = $('#judgesDataTable').DataTable($.extend(true, {}, baseOptions, {
                language: {
                    search: "Search judges:",
                    lengthMenu: "Show _MENU_ judges",
                    info: "Showing _START_ to _END_ of _TOTAL_ judges",
                    infoEmpty: "No judges available",
                    infoFiltered: "(filtered from _MAX_ total judges)",
                    emptyTable: "No judges yet. Add your first judge to start scoring.",
                    zeroRecords: "No matching judges found.",
                    paginate: {
                        previous: "Prev",
                        next: "Next"
                    }
                }
            }));

            dtCoadmins = $('#coadminsDataTable').DataTable($.extend(true, {}, baseOptions, {
                language: {
                    search: "Search co-admins:",
                    lengthMenu: "Show _MENU_ co-admins",
                    info: "Showing _START_ to _END_ of _TOTAL_ co-admins",
                    infoEmpty: "No co-admins available",
                    infoFiltered: "(filtered from _MAX_ total co-admins)",
                    emptyTable: "No co-admins yet. Add your first co-admin.",
                    zeroRecords: "No matching co-admins found.",
                    paginate: {
                        previous: "Prev",
                        next: "Next"
                    }
                }
            }));
        });

        function showTab(id, btn) {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('panel-' + id).classList.add('active');

            if (id === 'judges' && dtJudges) dtJudges.columns.adjust();
            if (id === 'coadmins' && dtCoadmins) dtCoadmins.columns.adjust();
        }

        var existingJudgeIds = <?= json_encode($all_judge_ids ?? []) ?>;

        function resetJudgeForm() {
            document.getElementById('judgeModalTitle').innerText = 'Add Judge';
            document.getElementById('judge_id').value = '';
            document.getElementById('judge_identifier').value = '';
            document.getElementById('judge_name').value = '';
            document.getElementById('judge_email').value = '';
            document.getElementById('judge_pw').value = '';
            document.getElementById('judge_pw').type = 'password';
            document.getElementById('judge_use_custom').checked = false;
            document.getElementById('judge_use_custom').closest('.event-form-group').style.display = 'block';
            toggleCustomJudgeId(false);
            document.getElementById('judge_jid_display').innerText = <?= json_encode($next_judge_id ?? 'JUDGE001') ?>;
            document.getElementById('judge_jid_auto_wrap').style.display = 'block';
        }

        function fillJudgeForm(d) {
            document.getElementById('judgeModalTitle').innerText = 'Edit Judge';
            document.getElementById('judge_id').value = d.id || '';
            document.getElementById('judge_identifier').value = d.identifier || '';
            document.getElementById('judge_name').value = d.name || '';
            document.getElementById('judge_email').value = d.email || '';
            document.getElementById('judge_pw').value = '';
            document.getElementById('judge_pw').type = 'password';
            document.getElementById('judge_jid_display').innerText = d.judge_id || '—';
            document.getElementById('judge_jid_auto_wrap').style.display = 'block';
            document.getElementById('judge_jid_custom_wrap').style.display = 'none';
            document.getElementById('judge_use_custom').checked = false;
            document.getElementById('judge_use_custom').closest('.event-form-group').style.display = 'none';
        }

        function toggleCustomJudgeId(useCustom) {
            document.getElementById('judge_jid_auto_wrap').style.display = useCustom ? 'none' : 'block';
            document.getElementById('judge_jid_custom_wrap').style.display = useCustom ? 'block' : 'none';
            var customInput = document.getElementById('judge_custom_jid');
            if (useCustom) {
                customInput.required = true;
                customInput.focus();
                validateCustomJudgeId();
            } else {
                customInput.required = false;
                customInput.value = '';
                document.getElementById('judge_custom_jid_msg').innerText = '';
                document.getElementById('judge_custom_jid_msg').style.color = 'var(--text-secondary)';
            }
        }

        function validateCustomJudgeId() {
            var val = document.getElementById('judge_custom_jid').value.trim().toUpperCase();
            var msg = document.getElementById('judge_custom_jid_msg');
            if (!val) {
                msg.innerText = '';
                return;
            }
            if (existingJudgeIds.indexOf(val) !== -1) {
                msg.innerText = 'This Judge ID already exists.';
                msg.style.color = '#ef4444';
            } else {
                msg.innerText = 'Judge ID is available.';
                msg.style.color = '#10b981';
            }
        }

        document.getElementById('judge_custom_jid').addEventListener('input', validateCustomJudgeId);

        document.getElementById('judgeForm').addEventListener('submit', function(e) {
            var id = document.getElementById('judge_id').value;
            if (id) return true;
            if (document.getElementById('judge_use_custom').checked) {
                var val = document.getElementById('judge_custom_jid').value.trim().toUpperCase();
                if (!val) {
                    e.preventDefault();
                    document.getElementById('judge_custom_jid').focus();
                    return false;
                }
                if (existingJudgeIds.indexOf(val) !== -1) {
                    e.preventDefault();
                    document.getElementById('judge_custom_jid_msg').innerText = 'This Judge ID already exists.';
                    document.getElementById('judge_custom_jid_msg').style.color = '#ef4444';
                    document.getElementById('judge_custom_jid').focus();
                    return false;
                }
            }
        });

        function togglePw(inputId, btn) {
            var input = document.getElementById(inputId);
            var isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.querySelector('.eye-open').style.display = isHidden ? 'none' : 'block';
            btn.querySelector('.eye-closed').style.display = isHidden ? 'block' : 'none';
            btn.title = isHidden ? 'Hide password' : 'Show password';
        }

        function resetCoForm() {
            document.getElementById('coadminModalTitle').innerText = 'Add Staff Account';
            document.getElementById('coadmin_id').value = '';
            document.getElementById('coadmin_role').value = 'co-admin';
            document.getElementById('coadmin_user').value = '';
            document.getElementById('coadmin_name').value = '';
            document.getElementById('coadmin_pw').value = '';
        }

        function fillCoForm(d) {
            document.getElementById('coadminModalTitle').innerText = 'Edit Staff Account';
            document.getElementById('coadmin_id').value = d.id || '';
            document.getElementById('coadmin_role').value = d.role || 'co-admin';
            document.getElementById('coadmin_user').value = d.username || '';
            document.getElementById('coadmin_name').value = d.name || '';
            document.getElementById('coadmin_pw').value = '';
        }
    </script>

</body>

</html>