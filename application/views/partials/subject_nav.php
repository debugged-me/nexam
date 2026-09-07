<?php if (!empty($subject_context)): ?>
    <?php
    $subject_links = [
        'overview'  => ['label' => 'Overview',   'url' => site_url('subjects/view/' . rawurlencode($subject_context->id))],
        'questions' => ['label' => 'Questions',  'url' => site_url('questions?subject_id=' . rawurlencode($subject_context->id))],
        'tos'       => ['label' => 'Blueprints', 'url' => site_url('tos?subject_id=' . rawurlencode($subject_context->id))],
        'exams'     => ['label' => 'Exams',      'url' => site_url('exams?subject_id=' . rawurlencode($subject_context->id))],
    ];
    ?>
    <nav class="subject-nav" aria-label="<?php echo htmlspecialchars($subject_context->name); ?> workspace">
        <div class="subject-nav-context">
            <span class="subject-nav-icon"><i data-lucide="book-open"></i></span>
            <span><small>Subject workspace</small><strong><?php echo htmlspecialchars($subject_context->name); ?></strong></span>
        </div>
        <div class="subject-nav-links">
            <?php foreach ($subject_links as $key => $link): ?>
                <a href="<?php echo $link['url']; ?>" class="subject-nav-link<?php echo isset($subject_tab) && $subject_tab === $key ? ' active' : ''; ?>"<?php echo isset($subject_tab) && $subject_tab === $key ? ' aria-current="page"' : ''; ?>><?php echo $link['label']; ?></a>
            <?php endforeach; ?>
        </div>
    </nav>
<?php endif; ?>
