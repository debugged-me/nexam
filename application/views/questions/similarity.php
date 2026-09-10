<div class="page-content">

    <div class="page-header">
        <div>
            <h1>Similarity Review</h1>
            <p class="page-sub">This question was flagged as a potential duplicate. Compare it with existing questions and decide whether to keep or reject it.</p>
        </div>
        <div class="page-header-actions">
            <a href="<?php echo site_url('questions'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back to Questions
            </a>
        </div>
    </div>

    <div class="card mb-3">
        <div class="card-header">
            <span class="card-title">Flagged Question</span>
            <?php if (!empty($question->similarity_score)): ?>
                <span class="text-muted meta-sm">Highest similarity: <?php echo number_format($question->similarity_score * 100, 1); ?>%</span>
            <?php endif; ?>
        </div>
        <div class="card-body">
            <div class="sim-question">
                <div class="sim-question-meta">
                    <span class="badge badge-gray"><?php echo htmlspecialchars(ucfirst($question->type)); ?></span>
                    <span class="g-bloom" data-level="<?php
                        $bl = ['remember'=>1,'understand'=>2,'apply'=>3,'analyze'=>4,'evaluate'=>5,'create'=>6];
                        echo $bl[$question->bloom] ?? 0;
                    ?>"><?php echo htmlspecialchars(ucfirst($question->bloom)); ?></span>
                    <?php if ($question->topic): ?>
                        <span class="text-muted meta-sm"><?php echo htmlspecialchars($question->topic); ?></span>
                    <?php endif; ?>
                </div>
                <div class="sim-question-stem"><?php echo htmlspecialchars($question->stem); ?></div>
                <?php if ($question->type === 'mcq' && $question->options): ?>
                    <?php $opts = json_decode($question->options, true);
                    if (is_array($opts)): ?>
                        <ul class="sim-question-options">
                            <?php foreach ($opts as $i => $opt): ?>
                                <li class="<?php echo $opt === $question->answer ? 'is-correct' : ''; ?>">
                                    <?php echo chr(65 + $i); ?>. <?php echo htmlspecialchars($opt); ?>
                                    <?php if ($opt === $question->answer): ?> <i data-lucide="check"></i><?php endif; ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php else: ?>
                    <div class="sim-question-answer">
                        <strong>Answer:</strong> <?php echo htmlspecialchars($question->answer); ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <?php if (empty($matches)): ?>
        <div class="card">
            <div class="card-body">
                <div class="empty-state empty-state-md">
                    <i data-lucide="copy-x" aria-hidden="true"></i>
                    <p>No similar questions found in the database. The flag may have been cleared.</p>
                </div>
            </div>
        </div>
    <?php else: ?>
        <div class="card mb-3">
            <div class="card-header">
                <span class="card-title">Similar Questions in the Bank</span>
                <span class="text-muted meta-sm"><?php echo count($matches); ?> match<?php echo count($matches) > 1 ? 'es' : ''; ?></span>
            </div>
            <div class="card-body">
                <div class="sim-matches">
                    <?php foreach ($matches as $m): ?>
                        <div class="sim-match">
                            <div class="sim-match-header">
                                <span class="badge badge-gray"><?php echo htmlspecialchars(ucfirst($m->type)); ?></span>
                                <span class="g-bloom" data-level="<?php
                                    echo $bl[$m->bloom] ?? 0;
                                ?>"><?php echo htmlspecialchars(ucfirst($m->bloom ?? '—')); ?></span>
                                <span class="sim-match-score"><?php echo number_format($m->score * 100, 1); ?>% similar</span>
                                <?php if (!empty($m->decision)): ?>
                                    <span class="badge badge-gray"><?php echo htmlspecialchars(ucfirst($m->decision)); ?></span>
                                <?php endif; ?>
                            </div>
                            <div class="sim-match-stem"><?php echo htmlspecialchars($m->stem ?? '—'); ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <div class="card">
        <div class="card-header">
            <span class="card-title">Decision</span>
        </div>
        <div class="card-body">
            <div class="sim-decision-actions">
                <form action="<?php echo site_url('questions/similarity_decide/' . rawurlencode($question->id)); ?>" method="post" class="inline-form">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <input type="hidden" name="decision" value="keep">
                    <button type="submit" class="btn btn-primary">
                        <i data-lucide="check"></i> Keep — Not a Duplicate
                    </button>
                </form>
                <form action="<?php echo site_url('questions/similarity_decide/' . rawurlencode($question->id)); ?>" method="post" class="inline-form">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <input type="hidden" name="decision" value="reject">
                    <button type="submit" class="btn btn-outline is-danger" data-confirm="Reject this question as a duplicate?">
                        <i data-lucide="trash-2"></i> Reject — It's a Duplicate
                    </button>
                </form>
            </div>
        </div>
    </div>

</div>
