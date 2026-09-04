<?php
$page_title = 'Events';
$current_page = 'events';
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

</head>

<body>

    <?php $this->load->view("includes/sidebar"); ?>

    <div class="main">

        <?php $this->load->view('includes/top-nav-bar', ['page_title' => $page_title ?? 'Events']); ?>

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
                    <button type="button" class="btn-gold" data-toggle="modal" data-target="#eventModal" onclick="resetForm()">
                        + Add Event
                    </button>
                </div>

                <div class="table-responsive-custom">
                    <table id="eventsDataTable" class="events-table display">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th style="width:130px; text-align:right;">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            <?php foreach ($events as $e): ?>
                                <?php
                                $status = strtolower(trim($e->status ?? 'upcoming'));

                                if ($status === 'active') {
                                    $statusClass = 'status-active';
                                } elseif ($status === 'completed') {
                                    $statusClass = 'status-completed';
                                } elseif ($status === 'upcoming') {
                                    $statusClass = 'status-upcoming';
                                } else {
                                    $statusClass = 'status-inactive';
                                }

                                $rawDate = !empty($e->date) ? $e->date : '';
                                $displayDate = !empty($e->date) ? date('M d, Y', strtotime($e->date)) : 'Not set';
                                ?>

                                <tr>
                                    <td data-label="Name">
                                        <div class="event-name-cell">
                                            <div class="event-avatar">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                                </svg>
                                            </div>

                                            <div>
                                                <div class="event-name-text"><?= htmlspecialchars($e->name) ?></div>
                                                <div class="event-code-text">Event ID: <?= htmlspecialchars($e->id) ?></div>
                                            </div>
                                        </div>
                                    </td>

                                    <td data-label="Date" class="date-cell" data-order="<?= htmlspecialchars($rawDate) ?>">
                                        <?= htmlspecialchars($displayDate) ?>
                                    </td>

                                    <td data-label="Status" data-order="<?= htmlspecialchars($status) ?>">
                                        <span class="status-badge <?= $statusClass ?>">
                                            <?= ucfirst(htmlspecialchars($status)) ?>
                                        </span>
                                    </td>

                                    <td data-label="Actions">
                                        <div class="table-actions">
                                            <button
                                                type="button"
                                                class="btn-action btn-action-edit"
                                                title="Edit Event"
                                                data-toggle="modal"
                                                data-target="#eventModal"
                                                onclick='fillForm(<?= json_encode($e) ?>)'>

                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M12 20h9"></path>
                                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                                </svg>
                                            </button>

                                            <a
                                                href="<?= site_url('admin/event_delete/' . $e->id) ?>"
                                                class="btn-action btn-action-delete"
                                                title="Delete Event"
                                                onclick="return confirm('Delete this event?')">

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

            <div class="modal fade" id="eventModal" tabindex="-1" role="dialog" aria-labelledby="eventModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered event-modal-dialog">
                    <div class="modal-content event-modal-content">
                        <form action="<?= site_url('admin/event_save') ?>" method="post">

                            <div class="event-modal-header">
                                <div>
                                    <span class="event-modal-eyebrow">Event Management</span>
                                    <h5 class="event-modal-title" id="eventModalTitle">Add Event</h5>
                                    <p class="event-modal-subtitle">Create or update event details.</p>
                                </div>

                                <button type="button" class="event-modal-close" data-dismiss="modal" aria-label="Close">
                                    &times;
                                </button>
                            </div>

                            <div class="event-modal-body">
                                <input type="hidden" name="id" id="event_id">

                                <div class="event-form-group">
                                    <label for="event_name">Event Name <span class="req-label">REQUIRED</span></label>
                                    <input type="text" name="name" id="event_name" required placeholder="Enter event name">
                                </div>

                                <div class="event-form-row">
                                    <div class="event-form-group">
                                        <label for="event_date">Event Date</label>
                                        <input type="date" name="date" id="event_date">
                                    </div>

                                    <div class="event-form-group">
                                        <label for="event_status">Status</label>
                                        <select name="status" id="event_status">
                                            <option value="upcoming">Upcoming</option>
                                            <option value="active">Active</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="event-modal-footer">
                                <button type="button" class="btn-event-cancel" data-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn-event-save">Save Event</button>
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
            $('#eventsDataTable').DataTable({
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
                    [1, 'desc']
                ],
                columnDefs: [{
                    targets: 3,
                    orderable: false,
                    searchable: false
                }],
                language: {
                    search: "Search events:",
                    lengthMenu: "Show _MENU_ events",
                    info: "Showing _START_ to _END_ of _TOTAL_ events",
                    infoEmpty: "No events available",
                    infoFiltered: "(filtered from _MAX_ total events)",
                    emptyTable: "No events yet. Create your first event to start managing the pageant flow.",
                    zeroRecords: "No matching events found.",
                    paginate: {
                        previous: "Prev",
                        next: "Next"
                    }
                }
            });
        });

        function resetForm() {
            document.getElementById('eventModalTitle').innerText = 'Add Event';
            document.getElementById('event_id').value = '';
            document.getElementById('event_name').value = '';
            document.getElementById('event_date').value = '';
            document.getElementById('event_status').value = 'upcoming';
        }

        function fillForm(data) {
            document.getElementById('eventModalTitle').innerText = 'Edit Event';
            document.getElementById('event_id').value = data.id || '';
            document.getElementById('event_name').value = data.name || '';
            document.getElementById('event_date').value = data.date || '';
            document.getElementById('event_status').value = data.status || 'upcoming';
        }
    </script>

</body>

</html>