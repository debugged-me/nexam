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
                                    <td><span class="g-bloom" data-level="<?php
                                        $bl = ['remember'=>1,'understand'=>2,'apply'=>3,'analyze'=>4,'evaluate'=>5,'create'=>6];
                                        echo $bl[$b['bloom']] ?? 0;
                                    ?>"><?php echo ucfirst(htmlspecialchars($b['bloom'])); ?></span></td>
                                    <td class="text-muted"><?php echo (int) $b['count']; ?></td>
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
                            <?php
                            $type_labels = [
                                'mcq' => 'Multiple choice',
                                'true_false' => 'True / false',
                                'matching' => 'Matching type',
                                'identification' => 'Identification',
                            ];
                            foreach ($type_distribution as $t): ?>
                                <tr>
                                    <td><?php echo htmlspecialchars($type_labels[$t['type']] ?? ucfirst($t['type'])); ?></td>
                                    <td class="text-muted"><?php echo (int) $t['count']; ?></td>
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
                            <td><span class="badge badge-gray"><?php echo htmlspecialchars($p['provider'] ?? 'unknown'); ?></span></td>
                            <td class="text-muted"><?php echo htmlspecialchars($p['model'] ?? '—'); ?></td>
                            <td><?php echo (int) $p['count']; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

    <?php if (!empty($confusion_matrix) && !empty($confusion_matrix['sampleSize'])): ?>
    <?php $cm = $confusion_matrix; ?>
    <div class="card mb-3">
        <div class="card-header">
            <span class="card-title">Bloom's Taxonomy Classification — Confusion Matrix</span>
            <span class="text-muted meta-sm">Sample size: <?php echo (int) $cm['sampleSize']; ?> reviewed questions</span>
        </div>
        <div class="card-body">
            <div class="stats-grid mb-3">
                <div class="stat-card">
                    <div class="stat-icon green"><i data-lucide="target"></i></div>
                    <div class="stat-info">
                        <div class="stat-value"><?php echo number_format(($cm['overall']['accuracy'] ?? 0) * 100, 1); ?>%</div>
                        <div class="stat-label">Accuracy</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue"><i data-lucide="crosshair"></i></div>
                    <div class="stat-info">
                        <div class="stat-value"><?php echo number_format(($cm['overall']['precision'] ?? 0) * 100, 1); ?>%</div>
                        <div class="stat-label">Precision</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon amber"><i data-lucide="search"></i></div>
                    <div class="stat-info">
                        <div class="stat-value"><?php echo number_format(($cm['overall']['recall'] ?? 0) * 100, 1); ?>%</div>
                        <div class="stat-label">Recall</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i data-lucide="git-merge"></i></div>
                    <div class="stat-info">
                        <div class="stat-value"><?php echo number_format(($cm['overall']['f1'] ?? 0) * 100, 1); ?>%</div>
                        <div class="stat-label">F1-Score</div>
                    </div>
                </div>
            </div>

            <p class="text-muted meta-sm mb-2">
                Compares the AI's predicted Bloom level against the instructor's confirmed Bloom level for each reviewed question.
                Diagonal cells (highlighted) are correct predictions; off-diagonal cells are misclassifications.
            </p>

            <?php $classes = $cm['classes'] ?? []; ?>
            <?php if (!empty($classes)): ?>
            <div class="table-wrap">
                <table class="data-table confusion-matrix-table">
                    <thead>
                        <tr>
                            <th rowspan="2" class="cm-axis-label">AI Predicted &darr;</th>
                            <th colspan="<?php echo count($classes); ?>">Instructor Confirmed &rarr;</th>
                        </tr>
                        <tr>
                            <?php foreach ($classes as $cls): ?>
                                <th class="cm-col-header"><?php echo ucfirst(htmlspecialchars($cls)); ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($classes as $predicted): ?>
                        <tr>
                            <td class="cm-row-header"><?php echo ucfirst(htmlspecialchars($predicted)); ?></td>
                            <?php foreach ($classes as $actual): ?>
                                <?php
                                $cell = (int)($cm['matrix'][$predicted][$actual] ?? 0);
                                $isDiagonal = ($predicted === $actual);
                                $cellClass = $isDiagonal ? 'cm-cell cm-diagonal' : 'cm-cell';
                                if ($cell === 0) $cellClass .= ' cm-zero';
                                ?>
                                <td class="<?php echo $cellClass; ?>"><?php echo $cell > 0 ? $cell : '·'; ?></td>
                            <?php endforeach; ?>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>

            <?php if (!empty($cm['perClass'])): ?>
            <h3 class="mt-3 mb-1">Per-Class Metrics</h3>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Bloom Level</th>
                            <th>TP</th>
                            <th>FP</th>
                            <th>FN</th>
                            <th>TN</th>
                            <th>Accuracy</th>
                            <th>Precision</th>
                            <th>Recall</th>
                            <th>F1-Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($cm['perClass'] as $pc): ?>
                        <tr>
                            <td><span class="g-bloom" data-level="<?php
                                $bl = ['remember'=>1,'understand'=>2,'apply'=>3,'analyze'=>4,'evaluate'=>5,'create'=>6];
                                echo $bl[$pc['bloom']] ?? 0;
                            ?>"><?php echo ucfirst(htmlspecialchars($pc['bloom'])); ?></span></td>
                            <td class="text-right"><?php echo (int) $pc['tp']; ?></td>
                            <td class="text-right"><?php echo (int) $pc['fp']; ?></td>
                            <td class="text-right"><?php echo (int) $pc['fn']; ?></td>
                            <td class="text-right"><?php echo (int) $pc['tn']; ?></td>
                            <td class="text-right"><?php echo number_format($pc['accuracy'] * 100, 2); ?>%</td>
                            <td class="text-right"><?php echo number_format($pc['precision'] * 100, 2); ?>%</td>
                            <td class="text-right"><?php echo number_format($pc['recall'] * 100, 2); ?>%</td>
                            <td class="text-right"><strong><?php echo number_format($pc['f1'] * 100, 2); ?>%</strong></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>
        </div>
    </div>
    <?php else: ?>
    <div class="card mb-3">
        <div class="card-header"><span class="card-title">Bloom's Taxonomy Classification — Confusion Matrix</span></div>
        <div class="card-body">
            <div class="empty-state empty-state-md">
                <i data-lucide="grid-3x3" aria-hidden="true"></i>
                <p>No reviewed AI questions yet. The confusion matrix will appear once instructors review and approve or reject AI-generated questions, confirming or correcting the AI's Bloom level assignment.</p>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>
