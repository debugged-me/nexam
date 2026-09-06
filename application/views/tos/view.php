<div class="page-content">

    <?php $this->load->view('partials/subject_nav'); ?>

    <div class="page-header">
        <div>
            <h1><?php echo htmlspecialchars($tos->title); ?></h1>
            <?php if (!empty($subject)): ?>
                <a href="<?php echo site_url('subjects/view/' . $subject->id); ?>" class="crumb-link">
                    <i data-lucide="book-open"></i>
                    <?php echo htmlspecialchars($subject->name); ?>
                    <?php if ($subject->code): ?><span class="badge badge-gray ml-1"><?php echo htmlspecialchars($subject->code); ?></span><?php endif; ?>
                </a>
            <?php endif; ?>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('exams/create?tos=' . $tos->id); ?>" class="btn btn-primary btn-sm">
                <i data-lucide="file-text"></i> Generate Exam
            </a>
            <a href="<?php echo site_url('tos/edit/' . $tos->id); ?>" class="btn btn-outline btn-sm"><i data-lucide="pencil"></i> Edit</a>
        </div>
    </div>

    <div class="stats-grid mb-2">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="list-ordered"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo (int) $tos->total_items; ?></div><div class="stat-label">Total Items</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon amber"><i data-lucide="layers"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo count($topics); ?></div><div class="stat-label">Topics</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="clock"></i></div>
            <div class="stat-info">
                <div class="stat-value">
                    <?php
                    $total_hours = 0;
                    foreach ($topics as $tp) { $total_hours += (int) $tp->instructional_hours; }
                    echo $total_hours;
                    ?>
                </div>
                <div class="stat-label">Instructional Hours</div>
            </div>
        </div>
    </div>

    <div class="card mb-2">
        <div class="card-header">
            <span class="card-title">Bloom's Taxonomy Distribution</span>
        </div>
        <div class="card-body">
            <?php
            $bloom_labels = [
                'remember'   => 'Remember',
                'understand' => 'Understand',
                'apply'      => 'Apply',
                'analyze'    => 'Analyze',
                'evaluate'   => 'Evaluate',
                'create'     => 'Create',
            ];
            foreach ($bloom_labels as $key => $label):
                $pct = isset($bloom_weights[$key]) ? (int) $bloom_weights[$key] : 0;
                $item_count = round($pct / 100 * $tos->total_items);
            ?>
                <div class="bloom-bar-row">
                    <div class="bloom-bar-label"><?php echo $label; ?></div>
                    <div class="bloom-bar-track">
                        <div class="bloom-bar-fill" style="width:<?php echo $pct; ?>%"></div>
                    </div>
                    <div class="bloom-bar-meta">
                        <span class="badge badge-gray"><?php echo $pct; ?>%</span>
                        <span class="text-muted meta-xs">~<?php echo $item_count; ?> items</span>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Topics</span>
            <span class="text-muted meta-sm"><?php echo count($topics); ?> topic<?php echo count($topics) === 1 ? '' : 's'; ?></span>
        </div>
        <?php if (empty($topics)): ?>
            <div class="empty-state empty-state-md">
                <i data-lucide="layers"></i>
                <p>No topics added yet. Add topics below to define what this TOS covers.</p>
            </div>
        <?php else: ?>
            <div class="table-wrap table-bare">
                <table class="data-table">
                    <caption class="sr-only">Topics in this Table of Specification</caption>
                    <thead>
                        <tr>
                            <th class="col-num">#</th>
                            <th>Topic</th>
                            <th class="col-medium">Instructional Hours</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($topics as $i => $tp): ?>
                            <tr>
                                <td class="text-muted"><?php echo $i + 1; ?></td>
                                <td class="cell-primary"><?php echo htmlspecialchars($tp->title); ?></td>
                                <td><span class="badge badge-amber"><?php echo (int) $tp->instructional_hours; ?> hrs</span></td>
                                <td>
                                    <div class="action-icons">
                                        <form action="<?php echo site_url('tos/delete_topic/' . $tos->id . '/' . $tp->id); ?>" method="post" class="inline-action-form">
                                            <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                                            <button type="button" class="action-icon danger" aria-label="Remove <?php echo htmlspecialchars($tp->title); ?>"
                                                    data-confirm
                                                    data-confirm-title="Remove topic?" data-confirm-type="delete"
                                                    data-confirm-message="This topic will be removed from the blueprint. This cannot be undone."><i data-lucide="trash-2"></i></button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <div class="card-body card-body-divider">
            <form action="<?php echo site_url('tos/add_topic/' . $tos->id); ?>" method="post">
                <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                <div class="inline-form">
                    <div class="inline-form-grow">
                        <label class="form-label" for="topic_title">Topic Title <span class="req">*</span></label>
                        <input type="text" id="topic_title" name="title" class="form-control" required maxlength="255" placeholder="e.g. Introduction to Algorithms">
                    </div>
                    <div class="inline-form-fixed">
                        <label class="form-label" for="topic_hours">Instructional Hours</label>
                        <input type="number" id="topic_hours" name="instructional_hours" class="form-control" min="0" max="1000" value="0">
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i data-lucide="plus"></i> Add Topic
                    </button>
                </div>
            </form>
        </div>
    </div>

</div>
