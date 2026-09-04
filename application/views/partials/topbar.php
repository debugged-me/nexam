<?php
$manilaDate = new DateTime('now', new DateTimeZone('Asia/Manila'));

$bar_user_name = isset($full_name) && $full_name !== '' ? $full_name : 'nexam user';
$bar_parts = preg_split('/\s+/', trim($bar_user_name));
$bar_initials = strtoupper(substr($bar_parts[0], 0, 1) . (count($bar_parts) > 1 ? substr(end($bar_parts), 0, 1) : ''));
?>
<div class="main-content">
<header class="topbar">
    <div class="topbar-left">
        <button class="mobile-menu-btn" data-sidebar-toggle type="button" aria-label="Menu">
            <i data-lucide="menu"></i>
        </button>
        <div class="topbar-title"><?= isset($page_title) ? htmlspecialchars($page_title) : 'Dashboard' ?></div>
    </div>

    <div class="topbar-right">
        <span id="live-clock" class="live-clock">
            <span class="clock-time"><?= $manilaDate->format('h:i:s A') ?></span>
            <span class="clock-date"><?= $manilaDate->format('M j, Y') ?></span>
        </span>

        <span class="topbar-divider"></span>

        <div class="topbar-user">
            <div class="topbar-user-meta">
                <span class="topbar-user-name"><?= htmlspecialchars($bar_user_name) ?></span>
                <span class="topbar-user-role"><?= htmlspecialchars(isset($role) ? $role : '') ?></span>
            </div>
            <div class="avatar avatar-sm"><?= htmlspecialchars($bar_initials) ?></div>
        </div>
    </div>
</header>
