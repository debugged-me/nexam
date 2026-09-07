<div class="page-content page-content--wide">

    <?php $this->load->view('partials/subject_nav'); ?>

    <header class="list-head">
        <div class="list-head-main">
            <h1 class="list-head-title">
                Exams
                <?php if (!empty($exams)): ?>
                    <span class="list-head-count"><?php echo number_format($total); ?></span>
                <?php endif; ?>
            </h1>
            <p class="list-head-desc">Draft and published papers assembled from your question bank.</p>
        </div>
        <div class="list-head-actions">
            <a href="<?php echo site_url('exams/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                <i data-lucide="plus"></i> New exam
            </a>
        </div>
    </header>

    <?php if (empty($exams)): ?>
        <div class="empty-state">
            <h4><?php echo !empty($subject_context) ? 'No exams for this subject' : 'No exams yet'; ?></h4>
            <p>Start from a blank paper, or generate one from a blueprint so the Bloom spread is decided for you.</p>
            <a href="<?php echo site_url('exams/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                <i data-lucide="plus"></i> New exam
            </a>
        </div>
    <?php else: ?>
        <?php
        $grid = [
            'key'         => 'exams',
            'label'       => 'exams',
            'placeholder' => 'Search exams…',
            'bulk_url'    => site_url('exams/bulk-delete'),
            'facets'      => [
                ['name' => 'Status', 'column' => 4, 'options' => ['Published' => 'Published', 'Draft' => 'Draft']],
                ['name' => 'Format', 'column' => 3, 'options' => ['Print' => 'Print', 'Digital' => 'Digital']],
            ],
        ];
        $this->load->view('partials/grid_open', ['grid' => $grid, 'csrf_name' => $csrf_name, 'csrf_hash' => $csrf_hash]);
        ?>

        <table class="grid datatable" data-grid="exams" data-grid-label="exams">
            <caption class="sr-only">Exams in your workspace</caption>
            <thead>
                <tr>
                    <th class="col-select wp-4">
                        <label class="ds-check">
                            <input type="checkbox" data-check-all>
                            <span aria-hidden="true"></span>
                            <span class="sr-only">Select all rows on this page</span>
                        </label>
                    </th>
                    <th class="col-primary wp-31" data-name="Exam" data-locked>Exam</th>
                    <th class="wp-17" data-name="Subject">Subject</th>
                    <th class="wp-11" data-name="Format">Format</th>
                    <th class="wp-11" data-name="Status">Status</th>
                    <th class="is-num wp-8" data-name="Items">Items</th>
                    <th class="wp-13" data-name="Updated">Updated</th>
                    <th class="col-actions wp-5"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($exams as $e): ?>
                    <?php
                    $count     = isset($e->question_count) ? (int) $e->question_count : 0;
                    $published = $e->status === 'published';
                    $print     = $e->format === 'print';
                    $touched   = !empty($e->updated_at) ? $e->updated_at : $e->created_at;
                    $meta      = [];
                    if (!empty($e->duration_minutes)) $meta[] = (int) $e->duration_minutes . ' min';
                    $meta[] = $count . ' ' . ($count === 1 ? 'item' : 'items');
                    ?>
                    <tr data-id="<?php echo htmlspecialchars($e->id); ?>">
                        <td class="col-select">
                            <label class="ds-check">
                                <input type="checkbox" data-row-check>
                                <span aria-hidden="true"></span>
                                <span class="sr-only">Select <?php echo htmlspecialchars($e->title); ?></span>
                            </label>
                        </td>
                        <td>
                            <span class="g-primary">
                                <a href="<?php echo site_url('exams/view/' . rawurlencode($e->id)); ?>" class="g-title"><?php echo htmlspecialchars($e->title); ?></a>
                                <span class="g-meta"><?php echo htmlspecialchars(implode(' · ', $meta)); ?></span>
                            </span>
                        </td>
                        <td data-order="<?php echo htmlspecialchars($e->subject_name ?: ''); ?>" data-filter="<?php echo htmlspecialchars($e->subject_name ?: ''); ?>">
                            <?php if (!empty($e->subject_name)): ?>
                                <a href="<?php echo site_url('subjects/view/' . rawurlencode($e->subject_id)); ?>" class="g-link" title="<?php echo htmlspecialchars($e->subject_name); ?>"><?php echo htmlspecialchars($e->subject_name); ?></a>
                            <?php else: ?>
                                <span class="g-mute">—</span>
                            <?php endif; ?>
                        </td>
                        <td data-filter="<?php echo $print ? 'Print' : 'Digital'; ?>">
                            <span class="g-inline"><i data-lucide="<?php echo $print ? 'printer' : 'monitor'; ?>"></i><?php echo $print ? 'Print' : 'Digital'; ?></span>
                        </td>
                        <td data-order="<?php echo $published ? 1 : 0; ?>" data-filter="<?php echo $published ? 'Published' : 'Draft'; ?>">
                            <span class="g-state <?php echo $published ? 'is-live' : 'is-draft'; ?>"><?php echo $published ? 'Published' : 'Draft'; ?></span>
                        </td>
                        <td class="is-num" data-order="<?php echo $count; ?>">
                            <span class="g-count<?php echo $count ? '' : ' is-zero'; ?>"><?php echo $count ?: '—'; ?></span>
                        </td>
                        <td class="g-mute" data-order="<?php echo htmlspecialchars($touched); ?>"><?php echo date('M j, Y', strtotime($touched)); ?></td>
                        <td class="col-actions">
                            <details class="g-menu">
                                <summary class="g-menu-trigger" aria-label="Actions for <?php echo htmlspecialchars($e->title); ?>"><i data-lucide="ellipsis"></i></summary>
                                <div class="g-menu-panel">
                                    <a href="<?php echo site_url('exams/view/' . rawurlencode($e->id)); ?>" class="g-menu-item"><i data-lucide="eye"></i> Open</a>
                                    <a href="<?php echo site_url('exams/edit/' . rawurlencode($e->id)); ?>" class="g-menu-item"><i data-lucide="pencil"></i> Edit</a>
                                    <div class="g-menu-sep"></div>
                                    <form action="<?php echo site_url('exams/delete/' . rawurlencode($e->id)); ?>" method="post" class="g-menu-form">
                                        <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                        <button type="button" class="g-menu-item is-danger" data-confirm data-confirm-title="Delete exam?" data-confirm-type="delete" data-confirm-message="&ldquo;<?php echo htmlspecialchars($e->title, ENT_QUOTES); ?>&rdquo; and its selected questions will be permanently removed."><i data-lucide="trash-2"></i> Delete</button>
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
