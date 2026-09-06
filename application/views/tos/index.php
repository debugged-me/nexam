<div class="page-content page-content--wide">

    <?php $this->load->view('partials/subject_nav'); ?>

    <header class="list-head">
        <div class="list-head-main">
            <h1 class="list-head-title">
                Blueprints
                <?php if (!empty($tos_list)): ?>
                    <span class="list-head-count"><?php echo number_format($total); ?></span>
                <?php endif; ?>
            </h1>
            <p class="list-head-desc">A Table of Specification fixes how many items each topic and Bloom level contributes to a paper.</p>
        </div>
        <div class="list-head-actions">
            <a href="<?php echo site_url('tos/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                <i data-lucide="plus"></i> New blueprint
            </a>
        </div>
    </header>

    <?php if (empty($tos_list)): ?>
        <div class="empty-state">
            <h4><?php echo !empty($subject_context) ? 'No blueprints for this subject' : 'No blueprints yet'; ?></h4>
            <p>Set the item count and Bloom weights once, then generate exams that match it every time.</p>
            <a href="<?php echo site_url('tos/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                <i data-lucide="plus"></i> New blueprint
            </a>
        </div>
    <?php else: ?>
        <?php
        $grid = [
            'key'         => 'blueprints',
            'label'       => 'blueprints',
            'placeholder' => 'Search blueprints…',
            'bulk_url'    => site_url('tos/bulk-delete'),
        ];
        $this->load->view('partials/grid_open', ['grid' => $grid, 'csrf_name' => $csrf_name, 'csrf_hash' => $csrf_hash]);
        ?>

        <table class="grid datatable" data-grid="blueprints" data-grid-label="blueprints">
            <caption class="sr-only">Table of Specification blueprints in your workspace</caption>
            <thead>
                <tr>
                    <th class="col-select wp-4">
                        <label class="ds-check">
                            <input type="checkbox" data-check-all>
                            <span aria-hidden="true"></span>
                            <span class="sr-only">Select all rows on this page</span>
                        </label>
                    </th>
                    <th class="col-primary wp-36" data-name="Blueprint" data-locked>Blueprint</th>
                    <th class="wp-22" data-name="Subject">Subject</th>
                    <th class="is-num wp-10" data-name="Topics">Topics</th>
                    <th class="is-num wp-10" data-name="Items">Items</th>
                    <th class="wp-13" data-name="Updated">Updated</th>
                    <th class="col-actions wp-5"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($tos_list as $t): ?>
                    <?php
                    $topics  = isset($t->topic_count) ? (int) $t->topic_count : 0;
                    $items   = (int) $t->total_items;
                    $touched = !empty($t->updated_at) ? $t->updated_at : $t->created_at;
                    ?>
                    <tr data-id="<?php echo htmlspecialchars($t->id); ?>">
                        <td class="col-select">
                            <label class="ds-check">
                                <input type="checkbox" data-row-check>
                                <span aria-hidden="true"></span>
                                <span class="sr-only">Select <?php echo htmlspecialchars($t->title); ?></span>
                            </label>
                        </td>
                        <td>
                            <span class="g-primary">
                                <a href="<?php echo site_url('tos/view/' . $t->id); ?>" class="g-title"><?php echo htmlspecialchars($t->title); ?></a>
                                <span class="g-meta"><?php
                                    echo $topics
                                        ? $topics . ' ' . ($topics === 1 ? 'topic' : 'topics') . ' · ' . $items . ' items'
                                        : 'No topics defined yet';
                                ?></span>
                            </span>
                        </td>
                        <td data-order="<?php echo htmlspecialchars($t->subject_name ?: ''); ?>" data-filter="<?php echo htmlspecialchars($t->subject_name ?: ''); ?>">
                            <?php if (!empty($t->subject_name)): ?>
                                <a href="<?php echo site_url('subjects/view/' . $t->subject_id); ?>" class="g-link" title="<?php echo htmlspecialchars($t->subject_name); ?>"><?php echo htmlspecialchars($t->subject_name); ?></a>
                            <?php else: ?>
                                <span class="g-mute">—</span>
                            <?php endif; ?>
                        </td>
                        <td class="is-num" data-order="<?php echo $topics; ?>">
                            <span class="g-count<?php echo $topics ? '' : ' is-zero'; ?>"><?php echo $topics ?: '—'; ?></span>
                        </td>
                        <td class="is-num" data-order="<?php echo $items; ?>"><span class="g-count"><?php echo $items; ?></span></td>
                        <td class="g-mute" data-order="<?php echo htmlspecialchars($touched); ?>"><?php echo date('M j, Y', strtotime($touched)); ?></td>
                        <td class="col-actions">
                            <details class="g-menu">
                                <summary class="g-menu-trigger" aria-label="Actions for <?php echo htmlspecialchars($t->title); ?>"><i data-lucide="ellipsis"></i></summary>
                                <div class="g-menu-panel">
                                    <a href="<?php echo site_url('tos/view/' . $t->id); ?>" class="g-menu-item"><i data-lucide="eye"></i> Open</a>
                                    <a href="<?php echo site_url('tos/edit/' . $t->id); ?>" class="g-menu-item"><i data-lucide="pencil"></i> Edit</a>
                                    <a href="<?php echo site_url('exams/create?tos=' . $t->id); ?>" class="g-menu-item"><i data-lucide="file-plus-2"></i> Generate exam</a>
                                    <div class="g-menu-sep"></div>
                                    <form action="<?php echo site_url('tos/delete/' . $t->id); ?>" method="post" class="g-menu-form">
                                        <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                        <button type="button" class="g-menu-item is-danger" data-confirm data-confirm-title="Delete blueprint?" data-confirm-type="delete" data-confirm-message="&ldquo;<?php echo htmlspecialchars($t->title, ENT_QUOTES); ?>&rdquo; and all of its topics will be permanently removed."><i data-lucide="trash-2"></i> Delete</button>
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
