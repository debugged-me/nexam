<div class="page-content">

    <?php if (isset($subject_context)): ?>
        <?php $this->load->view('partials/subject_nav'); ?>
    <?php endif; ?>

    <div class="page-header">
        <div>
            <h1>Materials</h1>
            <p class="page-sub">Instructional content used for AI-assisted question generation.</p>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('materials/upload' . (isset($subject_context) ? '?subject=' . rawurlencode($subject_context->id) : '')); ?>" class="btn btn-primary btn-sm">
                <i data-lucide="plus"></i> Upload Material
            </a>
        </div>
    </div>

    <?php if (empty($materials)): ?>
        <div class="empty-state">
            <i data-lucide="folder-open" aria-hidden="true"></i>
            <h2>No materials yet</h2>
            <p>Upload syllabi, lecture slides, documents, URLs, or YouTube videos to generate questions from.</p>
            <a href="<?php echo site_url('materials/upload'); ?>" class="btn btn-primary">
                <i data-lucide="upload"></i> Upload your first material
            </a>
        </div>
    <?php else: ?>
        <div class="dataset" data-grid="materials">
            <div class="dataset-scroll">
                <table class="grid" style="table-layout: fixed;">
                    <colgroup>
                        <col class="wp-40"><col class="wp-20"><col class="wp-15"><col class="wp-15"><col class="wp-10">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="sorting" tabindex="0">Title</th>
                            <th class="sorting" tabindex="0">Type</th>
                            <th class="sorting" tabindex="0">Status</th>
                            <th class="sorting" tabindex="0">Chunks</th>
                            <th class="wp-shrink"><span class="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($materials as $m): ?>
                            <tr>
                                <td>
                                    <div class="cell-title"><?php echo htmlspecialchars($m['title'], ENT_QUOTES, 'UTF-8'); ?></div>
                                    <?php if (!empty($m['is_syllabus'])): ?>
                                        <span class="badge badge-gray">Syllabus</span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-muted"><?php echo htmlspecialchars(ucfirst($m['source_type']), ENT_QUOTES, 'UTF-8'); ?></td>
                                <td>
                                    <?php
                                    $status = $m['status'];
                                    $icon = ['processed' => 'check-circle', 'pending' => 'clock', 'failed' => 'x-circle'][$status] ?? 'circle';
                                    $cls = ['processed' => 'is-live', 'pending' => 'is-draft', 'failed' => 'is-failed'][$status] ?? '';
                                    ?>
                                    <span class="g-state <?php echo $cls; ?>">
                                        <i data-lucide="<?php echo $icon; ?>"></i>
                                        <?php echo htmlspecialchars(ucfirst($status), ENT_QUOTES, 'UTF-8'); ?>
                                    </span>
                                    <?php if ($status === 'failed' && !empty($m['error'])): ?>
                                        <div class="text-muted text-sm"><?php echo htmlspecialchars(mb_strimwidth($m['error'], 0, 80, '...'), ENT_QUOTES, 'UTF-8'); ?></div>
                                    <?php endif; ?>
                                </td>
                                <td class="text-muted"><?php echo (int) $m['chunk_count']; ?></td>
                                <td>
                                    <div class="row-actions">
                                        <?php if ($status === 'failed'): ?>
                                            <button class="btn btn-outline btn-xs btn-reprocess" data-id="<?php echo htmlspecialchars($m['id'], ENT_QUOTES, 'UTF-8'); ?>" title="Retry">
                                                <i data-lucide="refresh-cw"></i>
                                            </button>
                                        <?php endif; ?>
                                        <form action="<?php echo site_url('materials/delete/' . rawurlencode($m['id'])); ?>" method="post" class="inline-form">
                                            <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                            <button type="submit" class="btn btn-outline btn-xs btn-delete" title="Delete" data-confirm="Delete this material?">
                                                <i data-lucide="trash-2"></i>
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>

</div>
