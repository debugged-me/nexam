<div class="page-content">

    <?php $this->load->view('partials/subject_nav'); ?>

    <div class="page-header">
        <div>
            <h1><?php echo htmlspecialchars($subject->name); ?></h1>
            <?php if ($subject->code): ?><span class="badge badge-gray"><?php echo htmlspecialchars($subject->code); ?></span><?php endif; ?>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('subjects/edit/' . rawurlencode($subject->id)); ?>" class="btn btn-outline btn-sm"><i data-lucide="pencil"></i> Edit</a>
        </div>
    </div>

    <?php if ($subject->description): ?>
        <p class="text-muted mb-3"><?php echo htmlspecialchars($subject->description); ?></p>
    <?php endif; ?>

    <div class="stats-grid mb-3">
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="help-circle"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo $question_count; ?></div><div class="stat-label">Questions</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon amber"><i data-lucide="table"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo $tos_count; ?></div><div class="stat-label">TOS Blueprints</div></div>
        </div>
    </div>

    <div class="detail-grid-2">
        <div class="card">
            <div class="card-header">
                <span class="card-title">Questions</span>
                <a href="<?php echo site_url('questions/create?subject=' . rawurlencode($subject->id)); ?>" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> Add</a>
            </div>
            <?php if (empty($questions)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="help-circle" aria-hidden="true"></i><p>No questions yet.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <caption class="sr-only">Recent questions for <?php echo htmlspecialchars($subject->name); ?></caption>
                        <?php foreach (array_slice($questions, 0, 5) as $q): ?>
                            <tr><td class="meta-sm"><?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 60, '...')); ?></td></tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">TOS Blueprints</span>
                <a href="<?php echo site_url('tos/create?subject=' . rawurlencode($subject->id)); ?>" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> Add</a>
            </div>
            <?php if (empty($tos_list)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="table" aria-hidden="true"></i><p>No TOS yet.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <caption class="sr-only">Recent TOS blueprints for <?php echo htmlspecialchars($subject->name); ?></caption>
                        <?php foreach ($tos_list as $t): ?>
                            <tr><td><a href="<?php echo site_url('tos/view/' . rawurlencode($t->id)); ?>" class="cell-title"><?php echo htmlspecialchars($t->title); ?></a></td></tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>

</div>
