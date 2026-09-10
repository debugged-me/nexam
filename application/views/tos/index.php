<div class="page-content page-content--wide">


    <header class="list-head">
        <div class="list-head-main">
            <h1 class="list-head-title">
                Blueprints (TOS)
                <?php if (!empty($tos_list)): ?>
                    <span class="list-head-count"><?php echo number_format($total); ?></span>
                <?php endif; ?>
            </h1>
            <p class="list-head-desc">A Table of Specification (TOS) defines how many items each topic and Bloom level contributes to an exam. Upload a syllabus and auto-generate one, or create it manually.</p>
        </div>
        <div class="list-head-actions">
            <a href="<?php echo site_url('tos/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                <i data-lucide="plus"></i> New Blueprint
            </a>
        </div>
    </header>

    <?php if (empty($tos_list)): ?>
        <div class="empty-state">
            <h4><?php echo !empty($subject_context) ? 'No blueprints for this subject' : 'No blueprints yet'; ?></h4>
            <p>Upload a syllabus and click "Auto-generate Blueprint" to create one automatically, or create one manually and set the item count and Bloom weights yourself.</p>
            <div class="empty-state-actions">
                <a href="<?php echo site_url('materials/upload'); ?>" class="btn btn-outline">
                    <i data-lucide="upload"></i> Upload Syllabus
                </a>
                <a href="<?php echo site_url('tos/create' . (!empty($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary">
                    <i data-lucide="plus"></i> New Blueprint
                </a>
            </div>
        </div>
    <?php else: ?>
        <?php
        $grid = [
            'key'         => 'blueprints',
            'label'       => 'blueprints',
            'placeholder' => 'Search blueprints…',
        ];
        $this->load->view('partials/grid_open', ['grid' => $grid, 'csrf_name' => $csrf_name, 'csrf_hash' => $csrf_hash]);
        ?>

        <table class="grid datatable" data-grid="blueprints" data-grid-label="blueprints">
            <caption class="sr-only">Table of Specification blueprints in your workspace</caption>
            <thead>
                <tr>
                    <th class="col-primary wp-40" data-name="Blueprint" data-locked>Blueprint</th>
                    <th class="wp-25" data-name="Subject">Subject</th>
                    <th class="is-num wp-10" data-name="Topics">Topics</th>
                    <th class="is-num wp-10" data-name="Items">Items</th>
                    <th class="wp-15" data-name="Updated">Updated</th>
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
                        <td>
                            <span class="g-primary">
                                <a href="<?php echo site_url('tos/view/' . rawurlencode($t->id)); ?>" class="g-title"><?php echo htmlspecialchars($t->title); ?></a>
                                <span class="g-meta"><?php
                                    echo $topics
                                        ? $topics . ' ' . ($topics === 1 ? 'topic' : 'topics') . ' · ' . $items . ' items'
                                        : 'No topics defined yet';
                                ?></span>
                            </span>
                        </td>
                        <td data-order="<?php echo htmlspecialchars($t->subject_name ?: ''); ?>" data-filter="<?php echo htmlspecialchars($t->subject_name ?: ''); ?>">
                            <?php if (!empty($t->subject_name)): ?>
                                <a href="<?php echo site_url('subjects/view/' . rawurlencode($t->subject_id)); ?>" class="g-link" title="<?php echo htmlspecialchars($t->subject_name); ?>"><?php echo htmlspecialchars($t->subject_name); ?></a>
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
                                    <a href="<?php echo site_url('tos/view/' . rawurlencode($t->id)); ?>" class="g-menu-item"><i data-lucide="eye"></i> Open</a>
                                    <a href="<?php echo site_url('tos/edit/' . rawurlencode($t->id)); ?>" class="g-menu-item"><i data-lucide="pencil"></i> Edit</a>
                                    <a href="<?php echo site_url('exams/create?tos=' . rawurlencode($t->id)); ?>" class="g-menu-item"><i data-lucide="file-plus-2"></i> Build exam</a>
                                    <div class="g-menu-sep"></div>
                                    <form action="<?php echo site_url('tos/delete/' . rawurlencode($t->id)); ?>" method="post" class="g-menu-form">
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
