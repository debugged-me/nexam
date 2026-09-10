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

$rail_name     = isset($full_name) && $full_name !== '' ? $full_name : 'nexam user';
$rail_initials = name_initials($rail_name);
$rail_avatar   = !empty($avatar_path) ? base_url($avatar_path) : '';
$rail_role     = isset($role) && $role !== '' ? ucfirst($role) : 'Instructor';
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

    <div class="sidebar-footer">
        <button type="button" class="sidebar-user" data-account-action="profile">
            <?php if ($rail_avatar !== ''): ?>
                <span class="avatar avatar-sm has-photo"><img src="<?= htmlspecialchars($rail_avatar) ?>" alt="User profile photo"></span>
            <?php else: ?>
                <span class="avatar avatar-sm"><?= htmlspecialchars($rail_initials) ?></span>
            <?php endif; ?>
            <span class="sidebar-user-meta">
                <strong><?= htmlspecialchars($rail_name) ?></strong>
                <small><?= htmlspecialchars($rail_role) ?></small>
            </span>
            <i data-lucide="settings-2" aria-hidden="true"></i>
            <span class="sr-only">Open account settings</span>
        </button>
    </div>
</aside>

<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay"></div>
