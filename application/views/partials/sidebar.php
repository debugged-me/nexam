<?php
$currentPage = isset($active_nav) ? $active_nav : '';

$nav_groups = [
    'Overview' => [
        ['label' => 'Dashboard', 'key' => 'dashboard', 'icon' => 'layout-dashboard', 'url' => 'dashboard'],
    ],
    'Content' => [
        ['label' => 'Subjects',      'key' => 'subjects',  'icon' => 'book-open',   'url' => 'subjects'],
        ['label' => 'Question Bank', 'key' => 'questions', 'icon' => 'help-circle', 'url' => 'questions'],
        ['label' => 'TOS Builder',   'key' => 'tos',       'icon' => 'table',       'url' => 'tos'],
        ['label' => 'Exams',         'key' => 'exams',     'icon' => 'file-text',   'url' => 'exams'],
    ],
];
?>
<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <div class="sidebar-brand-icon">
            <i data-lucide="graduation-cap"></i>
        </div>
        <div class="sidebar-brand-text">
            nexam
            <small>Exam Builder</small>
        </div>
        <button class="sidebar-close" data-sidebar-toggle type="button" aria-label="Close menu">
            <i data-lucide="x"></i>
        </button>
    </div>

    <nav class="sidebar-nav">
        <?php foreach ($nav_groups as $group => $items): ?>
            <div class="nav-section"><?= htmlspecialchars($group) ?></div>
            <?php foreach ($items as $item): ?>
                <a href="<?= site_url($item['url']) ?>" class="nav-item <?= $currentPage === $item['key'] ? 'active' : '' ?>">
                    <i data-lucide="<?= $item['icon'] ?>"></i>
                    <span><?= $item['label'] ?></span>
                </a>
            <?php endforeach; ?>
        <?php endforeach; ?>

        <a href="<?= site_url('logout') ?>" class="nav-item logout">
            <i data-lucide="log-out"></i>
            <span>Logout</span>
        </a>
    </nav>

    <div class="sidebar-footer">
        &copy; <?= date('Y') ?> nexam
    </div>
</aside>

<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay"></div>
