<div class="page-content page-content--wide">
    <div class="page-header">
        <div>
            <h1>Item Analysis</h1>
            <p class="page-sub">Response distributions and difficulty per question.</p>
        </div>
        <div class="header-actions">
            <a href="<?php echo site_url('analytics/exam/' . rawurlencode($exam_id)); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back to Exam
            </a>
        </div>
    </div>

    <?php if (empty($items)): ?>
        <div class="empty-state">
            <i data-lucide="list-checks" aria-hidden="true"></i>
            <h2>No item data yet</h2>
            <p>Item-level analysis appears once OMR answer sheets have been scanned for this exam.</p>
        </div>
    <?php else: ?>
        <div class="card">
            <div class="card-header">
                <span class="card-title">Question Performance</span>
                <span class="text-muted meta-sm"><?php echo count($items); ?> items</span>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-num">#</th>
                            <th>Correct Answer</th>
                            <th>Correct Rate</th>
                            <th>Difficulty</th>
                            <th>Responses</th>
                            <th>Ambiguous</th>
                            <th>Distribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($items as $item): ?>
                            <tr>
                                <td class="text-muted"><?php echo (int) $item->itemNumber; ?></td>
                                <td><span class="badge badge-gray"><?php echo htmlspecialchars($item->correct_answer ?? '—'); ?></span></td>
                                <td>
                                    <div class="correct-rate-bar">
                                        <div class="correct-rate-fill" style="width:<?php echo $item->correctRate; ?>%"></div>
                                        <span class="correct-rate-text"><?php echo $item->correctRate; ?>%</span>
                                    </div>
                                </td>
                                <td>
                                    <?php
                                    $diff_class = ['easy' => 'green', 'medium' => 'amber', 'hard' => 'red'][$item->difficulty] ?? 'gray';
                                    ?>
                                    <span class="badge badge-<?php echo $diff_class; ?>"><?php echo ucfirst($item->difficulty); ?></span>
                                </td>
                                <td class="text-muted"><?php echo (int) $item->totalResponses; ?></td>
                                <td class="text-muted"><?php echo (int) $item->ambiguousCount; ?></td>
                                <td>
                                    <div class="answer-dist">
                                        <?php foreach ($item->answerDistribution as $ad): ?>
                                            <span class="answer-dist-item" title="<?php echo htmlspecialchars($ad->marked_answer ?? 'blank'); ?>: <?php echo (int) $ad->count; ?>">
                                                <span class="answer-dist-letter"><?php echo htmlspecialchars($ad->marked_answer ?? '—'); ?></span>
                                                <span class="answer-dist-count"><?php echo (int) $ad->count; ?></span>
                                            </span>
                                        <?php endforeach; ?>
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
