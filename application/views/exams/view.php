<div class="page-content">

    <?php $this->load->view('partials/subject_nav'); ?>

    <div class="page-header">
        <div>
            <h1><?php echo htmlspecialchars($exam->title); ?></h1>
            <?php if (!empty($subject)): ?>
                <span class="badge badge-gray"><?php echo htmlspecialchars($subject->name); ?></span>
            <?php endif; ?>
            <?php if ($exam->status === 'published'): ?>
                <span class="badge badge-green">Published</span>
            <?php else: ?>
                <span class="badge badge-amber">Draft</span>
            <?php endif; ?>
        </div>
        <div class="header-actions">
            <?php if ($exam->status === 'draft'): ?>
                <form action="<?php echo site_url('exams/publish/' . rawurlencode($exam->id)); ?>" method="post" class="inline-action-form">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <button type="button" class="btn btn-primary btn-sm" data-confirm
                            data-confirm-title="Publish exam?" data-confirm-type="warning"
                            data-confirm-message="The exam will be marked as published and ready for use.">
                        <i data-lucide="send"></i> Publish
                    </button>
                </form>
            <?php endif; ?>
            <button type="button" class="btn btn-primary btn-sm" id="btn-generate-pdfs" data-exam-id="<?php echo rawurlencode($exam->id); ?>">
                <i data-lucide="file-text"></i> Generate PDFs
            </button>
            <?php if ($exam->format === 'print'): ?>
                <button type="button" class="btn btn-outline btn-sm" data-print-page>
                    <i data-lucide="printer"></i> Print
                </button>
            <?php endif; ?>
            <a href="<?php echo site_url('exams/edit/' . rawurlencode($exam->id)); ?>" class="btn btn-outline btn-sm"><i data-lucide="pencil"></i> Edit</a>
        </div>
    </div>

    <div class="stats-grid mb-2">
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="file-text"></i></div>
            <div class="stat-info"><div class="stat-value"><?php echo count($questions); ?></div><div class="stat-label">Questions</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon <?php echo $exam->format === 'print' ? 'amber' : 'green'; ?>"><i data-lucide="<?php echo $exam->format === 'print' ? 'printer' : 'monitor'; ?>"></i></div>
            <div class="stat-info"><div class="stat-value stat-value-sm"><?php echo htmlspecialchars($exam->format); ?></div><div class="stat-label">Format</div></div>
        </div>
        <?php if ($exam->duration_minutes): ?>
            <div class="stat-card">
                <div class="stat-icon purple"><i data-lucide="clock"></i></div>
                <div class="stat-info"><div class="stat-value"><?php echo (int) $exam->duration_minutes; ?></div><div class="stat-label">Minutes</div></div>
            </div>
        <?php endif; ?>
    </div>

    <?php if ($exam->instructions): ?>
        <div class="card mb-2">
            <div class="card-header"><span class="card-title">Instructions</span></div>
            <div class="card-body">
                <p class="preserve-lines"><?php echo htmlspecialchars($exam->instructions); ?></p>
            </div>
        </div>
    <?php endif; ?>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Questions</span>
            <?php if (!empty($questions)): ?>
                <span class="text-muted meta-sm"><?php echo count($questions); ?> total</span>
            <?php endif; ?>
        </div>
        <?php if (empty($questions)): ?>
            <div class="empty-state empty-state-lg">
                <div class="empty-icon"><i data-lucide="help-circle" aria-hidden="true"></i></div>
                <h4>No questions in this exam</h4>
                <p>Generate a new exam from a TOS blueprint to populate it.</p>
                <a href="<?php echo site_url('tos'); ?>" class="btn btn-primary btn-sm">
                    <i data-lucide="sparkles"></i> Generate from TOS
                </a>
            </div>
        <?php else: ?>
            <div class="table-wrap table-bare">
                <table class="data-table">
                    <caption class="sr-only">Questions included in <?php echo htmlspecialchars($exam->title); ?></caption>
                    <thead>
                        <tr>
                            <th class="col-num">#</th>
                            <th>Question</th>
                            <th>Type</th>
                            <th>Bloom</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($questions as $i => $q): ?>
                            <tr>
                                <td class="text-muted"><?php echo $i + 1; ?></td>
                                <td class="cell-medium"><?php echo htmlspecialchars(mb_strimwidth($q->stem, 0, 120, '…')); ?></td>
                                <td><span class="badge badge-gray"><?php echo htmlspecialchars(ucfirst($q->type)); ?></span></td>
                                <td><span class="badge badge-purple"><?php echo htmlspecialchars(ucfirst($q->bloom)); ?></span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>

    <div class="card" id="exam-downloads" hidden>
        <div class="card-header">
            <span class="card-title">Downloads</span>
            <span class="text-muted meta-sm">Generated PDFs</span>
        </div>
        <div class="card-body">
            <div id="downloads-content">
                <p class="text-muted">Click "Generate PDFs" to create downloadable exam sets, answer keys, and TOS report.</p>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-title">LMS Export</span>
            <span class="text-muted meta-sm">Moodle & Canvas</span>
        </div>
        <div class="card-body">
            <p class="text-muted mb-2">Export this exam's questions to a learning management system.</p>
            <a href="<?php echo site_url('exams/export/' . rawurlencode($exam->id) . '/gift'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="download"></i> Moodle GIFT
            </a>
            <a href="<?php echo site_url('exams/export/' . rawurlencode($exam->id) . '/xml'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="download"></i> Canvas XML
            </a>
        </div>
    </div>

</div>
