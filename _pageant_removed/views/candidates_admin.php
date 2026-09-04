<?php
$page_title = 'Candidates';
$current_page = 'candidates';
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

        <?php $this->load->view('includes/top-nav-bar', ['page_title' => $page_title ?? 'Candidates']); ?>

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

            <div class="table-card">
                <div class="table-toolbar" style="display:flex; align-items:center; justify-content:flex-end;">
                    <button type="button" class="btn-gold" data-toggle="modal" data-target="#candidateModal" onclick="resetForm()">
                        + Add Candidate
                    </button>
                </div>

                <div class="table-responsive-custom">
                    <table id="candidatesDataTable" class="events-table display">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Number</th>
                                <th>Barangay</th>
                                <th style="width:130px; text-align:right;">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            <?php foreach ($candidates as $c): ?>
                                <tr>
                                    <td data-label="Name">
                                        <div class="event-name-cell">
                                            <div class="event-avatar">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                </svg>
                                            </div>

                                            <div>
                                                <div class="event-name-text"><?= htmlspecialchars($c->name) ?></div>
                                                <div class="event-code-text">Candidate ID: <?= htmlspecialchars($c->id) ?></div>
                                            </div>
                                        </div>
                                    </td>

                                    <td data-label="Number" data-order="<?= htmlspecialchars($c->candidate_number) ?>">
                                        <span class="status-badge status-completed">#<?= htmlspecialchars($c->candidate_number) ?></span>
                                    </td>

                                    <td data-label="Barangay">
                                        <?= $c->barangay ? htmlspecialchars($c->barangay) : '<span style="color:var(--muted)">—</span>' ?>
                                    </td>

                                    <td data-label="Actions">
                                        <div class="table-actions">
                                            <button
                                                type="button"
                                                class="btn-action btn-action-edit"
                                                title="Edit Candidate"
                                                data-toggle="modal"
                                                data-target="#candidateModal"
                                                onclick='fillForm(<?= json_encode($c) ?>)'>

                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M12 20h9"></path>
                                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                </svg>
                                            </button>

                                            <a
                                                href="<?= site_url('admin/candidate_delete/' . $c->id) ?>"
                                                class="btn-action btn-action-delete"
                                                title="Delete Candidate"
                                                onclick="return confirm('Delete this candidate?')">

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

            <div class="modal fade" id="candidateModal" tabindex="-1" role="dialog" aria-labelledby="candidateModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/candidate_save') ?>" method="post">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Candidate Management</span>
                                    <h5 class="event-modal-title" id="candidateModalTitle">Add Candidate</h5>
                                    <p class="event-modal-subtitle">Create or update candidate details.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="candidate_id">

                                <div class="event-form-group">
                                    <label for="candidate_name">Candidate Name <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="name" id="candidate_name" required placeholder="Enter candidate name">
                                </div>

                                <div class="event-form-group">
                                    <label for="candidate_num">Number <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="candidate_number" id="candidate_num" required placeholder="e.g. 1">
                                </div>

                                <div class="event-form-group">
                                    <label for="candidate_barangay">Barangay</label>
                                    <input type="text" name="barangay" id="candidate_barangay" placeholder="e.g. Barangay Central">
                                </div>
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Candidate</button>
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
        $(document).ready(function() {
            $('#candidatesDataTable').DataTable({
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
                    [1, 'asc']
                ],
                columnDefs: [{
                    targets: 3,
                    orderable: false,
                    searchable: false
                }],
                language: {
                    search: "Search candidates:",
                    lengthMenu: "Show _MENU_ candidates",
                    info: "Showing _START_ to _END_ of _TOTAL_ candidates",
                    infoEmpty: "No candidates available",
                    infoFiltered: "(filtered from _MAX_ total candidates)",
                    emptyTable: "No candidates yet. Add your first candidate to start the pageant.",
                    zeroRecords: "No matching candidates found.",
                    paginate: {
                        previous: "Prev",
                        next: "Next"
                    }
                }
            });
        });

        function resetForm() {
            document.getElementById('candidateModalTitle').innerText = 'Add Candidate';
            document.getElementById('candidate_id').value = '';
            document.getElementById('candidate_num').value = '';
            document.getElementById('candidate_name').value = '';
            document.getElementById('candidate_barangay').value = '';
        }

        function fillForm(data) {
            document.getElementById('candidateModalTitle').innerText = 'Edit Candidate';
            document.getElementById('candidate_id').value = data.id || '';
            document.getElementById('candidate_num').value = data.candidate_number || '';
            document.getElementById('candidate_name').value = data.name || '';
            document.getElementById('candidate_barangay').value = data.barangay || '';
        }
    </script>

</body>

</html>