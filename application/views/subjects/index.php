<div class="page-content page-content--wide">

    <header class="list-head">
        <div class="list-head-main">
            <h1 class="list-head-title">
                Subjects
                <?php if (!empty($subjects)): ?>
                    <span class="list-head-count"><?php echo number_format($total); ?></span>
                <?php endif; ?>
            </h1>
            <details class="list-head-info">
                <summary aria-label="What are subjects?"><i data-lucide="info"></i></summary>
                <p>Courses you teach. Each subject owns its own question bank, blueprints and exams.</p>
            </details>
        </div>
    </header>

    <?php if (empty($subjects)): ?>
        <div class="empty-state">
            <h4>No subjects yet</h4>
            <p>A subject is the container for everything else — create one and the question bank, blueprints and exams follow.</p>
            <button type="button" class="btn btn-primary" id="new-subject-btn-empty">
                <i data-lucide="plus"></i> New Subject
            </button>
        </div>
    <?php else: ?>
        <?php
        $grid = [
            'key'         => 'subjects',
            'label'       => 'subjects',
            'placeholder' => 'Search by name or code…',
            'bulk_url'    => site_url('subjects/bulk-delete'),
            'action'      => '<button type="button" class="btn btn-primary btn-sm" id="new-subject-btn"><i data-lucide="plus"></i> New Subject</button>',
        ];
        $this->load->view('partials/grid_open', ['grid' => $grid, 'csrf_name' => $csrf_name, 'csrf_hash' => $csrf_hash]);
        ?>

        <table class="grid datatable" data-grid="subjects" data-grid-label="subjects">
            <caption class="sr-only">Subjects in your workspace</caption>
            <thead>
                <tr>
                    <th class="col-select wp-4">
                        <label class="ds-check">
                            <input type="checkbox" data-check-all>
                            <span aria-hidden="true"></span>
                            <span class="sr-only">Select all rows on this page</span>
                        </label>
                    </th>
                    <th class="col-primary wp-33" data-name="Subject" data-locked>Subject</th>
                    <th class="wp-12" data-name="Code">Code</th>
                    <th class="is-num wp-12" data-name="Questions">Questions</th>
                    <th class="is-num wp-12" data-name="Blueprints">Blueprints</th>
                    <th class="is-num wp-10" data-name="Exams">Exams</th>
                    <th class="wp-12" data-name="Created">Created</th>
                    <th class="col-actions wp-5"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($subjects as $s): ?>
                    <?php
                    $q_count = isset($question_counts[$s->id]) ? (int) $question_counts[$s->id] : 0;
                    $t_count = isset($tos_counts[$s->id]) ? (int) $tos_counts[$s->id] : 0;
                    $e_count = isset($exam_counts[$s->id]) ? (int) $exam_counts[$s->id] : 0;
                    ?>
                    <tr data-id="<?php echo htmlspecialchars($s->id); ?>">
                        <td class="col-select">
                            <label class="ds-check">
                                <input type="checkbox" data-row-check>
                                <span aria-hidden="true"></span>
                                <span class="sr-only">Select <?php echo htmlspecialchars($s->name); ?></span>
                            </label>
                        </td>
                        <td>
                            <span class="g-primary">
                                <a href="<?php echo site_url('subjects/view/' . rawurlencode($s->id)); ?>" class="g-title"><?php echo htmlspecialchars($s->name); ?></a>
                                <span class="g-meta"<?php echo !empty($s->description) ? ' title="' . htmlspecialchars(mb_strimwidth(trim(preg_replace('/\s+/', ' ', $s->description)), 0, 200)) . '"' : ''; ?>><?php
                                    echo !empty($s->description)
                                        ? htmlspecialchars(mb_strimwidth(trim(preg_replace('/\s+/', ' ', $s->description)), 0, 90, '…'))
                                        : 'No description';
                                ?></span>
                            </span>
                        </td>
                        <td><?php echo $s->code
                                ? '<span class="g-code">' . htmlspecialchars($s->code) . '</span>'
                                : '<span class="g-mute">—</span>'; ?></td>
                        <td class="is-num" data-order="<?php echo $q_count; ?>">
                            <span class="g-count<?php echo $q_count ? '' : ' is-zero'; ?>"><?php echo $q_count ?: '—'; ?></span>
                        </td>
                        <td class="is-num" data-order="<?php echo $t_count; ?>">
                            <span class="g-count<?php echo $t_count ? '' : ' is-zero'; ?>"><?php echo $t_count ?: '—'; ?></span>
                        </td>
                        <td class="is-num" data-order="<?php echo $e_count; ?>">
                            <span class="g-count<?php echo $e_count ? '' : ' is-zero'; ?>"><?php echo $e_count ?: '—'; ?></span>
                        </td>
                        <td class="g-mute" data-order="<?php echo htmlspecialchars($s->created_at); ?>"><?php echo date('M j, Y', strtotime($s->created_at)); ?></td>
                        <td class="col-actions">
                            <details class="g-menu">
                                <summary class="g-menu-trigger" aria-label="Actions for <?php echo htmlspecialchars($s->name); ?>"><i data-lucide="ellipsis"></i></summary>
                                <div class="g-menu-panel">
                                    <a href="<?php echo site_url('subjects/view/' . rawurlencode($s->id)); ?>" class="g-menu-item"><i data-lucide="eye"></i> Open</a>
                                    <button type="button" class="g-menu-item" data-edit-subject="<?php echo rawurlencode($s->id); ?>"><i data-lucide="pencil"></i> Edit</button>
                                    <a href="<?php echo site_url('questions?subject_id=' . rawurlencode($s->id)); ?>" class="g-menu-item"><i data-lucide="circle-help"></i> Questions</a>
                                    <div class="g-menu-sep"></div>
                                    <form action="<?php echo site_url('subjects/delete/' . rawurlencode($s->id)); ?>" method="post" class="g-menu-form">
                                        <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                        <button type="button" class="g-menu-item is-danger" data-confirm data-confirm-title="Delete subject?" data-confirm-type="delete" data-confirm-message="Deleting &ldquo;<?php echo htmlspecialchars($s->name, ENT_QUOTES); ?>&rdquo; also removes its questions, blueprints and exams. This cannot be undone."><i data-lucide="trash-2"></i> Delete</button>
                                    </form>
                                </div>
                            </details>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <?php $this->load->view('partials/grid_close'); ?>
    <?php endif; ?>

</div>

<script id="subjects-config" type="application/json"><?php
    echo json_encode([
        'storeUrl'   => site_url('subjects/store'),
        'updateUrl'  => site_url('subjects/update'),
        'csrfName'   => $csrf_name,
        'csrfHash'   => $csrf_hash,
        'subjects'   => isset($subjects_json) ? json_decode($subjects_json, true) : [],
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?></script>
