<?php
$currentPage = isset($active_nav) ? $active_nav : '';

/**
 * The rail is grouped by the order the work actually happens in: you look at
 * the overview, you build content, then you assess with it. Five flat items
 * said nothing about how the product fits together.
 */
$nav_groups = [
    [
        'label' => 'Overview',
        'items' => [
            ['label' => 'Dashboard', 'key' => 'dashboard', 'icon' => 'layout-dashboard', 'url' => 'dashboard'],
        ],
    ],
    [
        'label' => 'Content',
        'items' => [
            ['label' => 'Subjects',  'key' => 'subjects',  'icon' => 'book-open',   'url' => 'subjects'],
            ['label' => 'Materials', 'key' => 'materials', 'icon' => 'folder-open',  'url' => 'materials'],
            ['label' => 'Questions', 'key' => 'questions', 'icon' => 'circle-help', 'url' => 'questions'],
        ],
    ],
    [
        'label' => 'Assessment',
        'items' => [
            ['label' => 'Blueprints (TOS)', 'key' => 'tos',   'icon' => 'panels-top-left', 'url' => 'tos'],
            ['label' => 'Exams',      'key' => 'exams', 'icon' => 'file-text',       'url' => 'exams'],
            ['label' => 'Analytics',  'key' => 'analytics', 'icon' => 'bar-chart-3', 'url' => 'analytics'],
        ],
    ],
];

?>
<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <span class="sidebar-mark"><i data-lucide="graduation-cap"></i></span>
        <span class="sidebar-wordmark">
            nexam
            <small>Exam workspace</small>
        </span>
        <button class="sidebar-close" data-sidebar-toggle type="button" aria-label="Close menu">
            <i data-lucide="x"></i>
        </button>
    </div>

    <nav class="sidebar-nav" aria-label="Primary navigation">
        <?php foreach ($nav_groups as $group): ?>
            <div class="nav-group">
                <div class="nav-section" aria-hidden="true"><?= htmlspecialchars($group['label']) ?></div>
                <?php foreach ($group['items'] as $item): ?>
                    <?php $is_active = $currentPage === $item['key']; ?>
                    <a href="<?= site_url($item['url']) ?>"
                       class="nav-item<?= $is_active ? ' active' : '' ?>"
                       <?= $is_active ? 'aria-current="page"' : '' ?>
                       data-label="<?= htmlspecialchars($item['label']) ?>">
                        <i data-lucide="<?= $item['icon'] ?>"></i>
                        <span><?= htmlspecialchars($item['label']) ?></span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endforeach; ?>
    </nav>
</aside>

<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay"></div>
