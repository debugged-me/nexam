<div class="page-content page-content--wide">
    <div class="page-header">
        <div>
            <h1>AI Component Evaluation</h1>
            <p class="page-sub">Quality metrics for AI-generated questions, similarity detection, and material extraction.</p>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('analytics'); ?>" class="btn btn-outline btn-sm"><i data-lucide="arrow-left"></i> Back to Analytics</a>
        </div>
    </div>

    <div class="stats-grid mb-3">
        <div class="stat-card">
            <div class="stat-icon green"><i data-lucide="sparkles"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo number_format(($generation['precision'] ?? 0) * 100, 1); ?>%</div>
                <div class="stat-label">Generation Precision</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue"><i data-lucide="check-circle"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo number_format(($generation['approvalRate'] ?? 0) * 100, 1); ?>%</div>
                <div class="stat-label">Approval Rate</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon amber"><i data-lucide="copy-check"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo number_format(($similarity['flagRate'] ?? 0) * 100, 1); ?>%</div>
                <div class="stat-label">Similarity Flag Rate</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple"><i data-lucide="file-search"></i></div>
            <div class="stat-info">
                <div class="stat-value"><?php echo number_format(($extraction['accuracy'] ?? 0) * 100, 1); ?>%</div>
                <div class="stat-label">Extraction Accuracy</div>
            </div>
        </div>
    </div>

    <div class="detail-grid-2 mb-3">
        <div class="card">
            <div class="card-header"><span class="card-title">Question Generation</span></div>
            <div class="card-body">
                <table class="data-table">
                    <tbody>
                        <tr><td>Total Generated</td><td class="text-right"><?php echo (int) ($generation['totalGenerated'] ?? 0); ?></td></tr>
                        <tr><td>Approved</td><td class="text-right"><span class="badge badge-green"><?php echo (int) ($generation['approved'] ?? 0); ?></span></td></tr>
                        <tr><td>Rejected / Pending</td><td class="text-right"><span class="badge badge-amber"><?php echo (int) ($generation['rejected'] ?? 0); ?></span></td></tr>
                        <tr><td>Pending Review</td><td class="text-right"><?php echo (int) ($generation['pending'] ?? 0); ?></td></tr>
                        <tr><td><strong>Precision</strong></td><td class="text-right"><strong><?php echo number_format(($generation['precision'] ?? 0) * 100, 2); ?>%</strong></td></tr>
                        <tr><td><strong>Approval Rate</strong></td><td class="text-right"><strong><?php echo number_format(($generation['approvalRate'] ?? 0) * 100, 2); ?>%</strong></td></tr>
                    </tbody>
                </table>
                <p class="text-muted meta-sm mt-2">Precision = approved / (approved + rejected). A higher precision means the AI generates more usable questions.</p>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">Material Extraction</span></div>
            <div class="card-body">
                <table class="data-table">
                    <tbody>
                        <tr><td>Total Materials</td><td class="text-right"><?php echo (int) ($extraction['totalMaterials'] ?? 0); ?></td></tr>
                        <tr><td>Processed</td><td class="text-right"><span class="badge badge-green"><?php echo (int) ($extraction['processed'] ?? 0); ?></span></td></tr>
                        <tr><td>Failed</td><td class="text-right"><span class="badge badge-red"><?php echo (int) ($extraction['failed'] ?? 0); ?></span></td></tr>
                        <tr><td>Pending</td><td class="text-right"><?php echo (int) ($extraction['pending'] ?? 0); ?></td></tr>
                        <tr><td><strong>Accuracy</strong></td><td class="text-right"><strong><?php echo number_format(($extraction['accuracy'] ?? 0) * 100, 2); ?>%</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="detail-grid-2 mb-3">
        <div class="card">
            <div class="card-header"><span class="card-title">Bloom Level Distribution (AI-generated)</span></div>
            <?php if (empty($bloom_distribution)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="layers" aria-hidden="true"></i><p>No AI-generated questions yet.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <thead><tr><th>Bloom Level</th><th>Count</th></tr></thead>
                        <tbody>
                            <?php foreach ($bloom_distribution as $b): ?>
                                <tr>
                                    <td><span class="g-bloom"><?php echo ucfirst(htmlspecialchars($b->bloom)); ?></span></td>
                                    <td class="text-muted"><?php echo (int) $b->count; ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">Question Type Distribution</span></div>
            <?php if (empty($type_distribution)): ?>
                <div class="empty-state empty-state-md"><i data-lucide="circle-help" aria-hidden="true"></i><p>No AI-generated questions yet.</p></div>
            <?php else: ?>
                <div class="table-wrap table-bare">
                    <table class="data-table">
                        <thead><tr><th>Type</th><th>Count</th></tr></thead>
                        <tbody>
                            <?php foreach ($type_distribution as $t): ?>
                                <tr>
                                    <td><?php echo ucfirst(htmlspecialchars($t->type)); ?></td>
                                    <td class="text-muted"><?php echo (int) $t->count; ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <?php if (!empty($providers)): ?>
    <div class="card">
        <div class="card-header"><span class="card-title">Provider Usage</span></div>
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>Provider</th><th>Model</th><th>Questions Generated</th></tr></thead>
                <tbody>
                    <?php foreach ($providers as $p): ?>
                        <tr>
                            <td><span class="badge badge-gray"><?php echo htmlspecialchars($p->provider ?? 'unknown'); ?></span></td>
                            <td class="text-muted"><?php echo htmlspecialchars($p->model ?? '—'); ?></td>
                            <td><?php echo (int) $p->count; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>
</div>
