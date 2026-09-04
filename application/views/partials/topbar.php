<?php
$bar_user_name = isset($full_name) && $full_name !== '' ? $full_name : 'nexam user';
$bar_initials  = name_initials($bar_user_name);
$bar_avatar    = !empty($avatar_path) ? base_url($avatar_path) : '';

// Section the current page belongs to, for the breadcrumb.
$sections = [
    'dashboard' => 'Overview',
    'subjects'  => 'Subjects',
    'questions' => 'Question Bank',
    'tos'       => 'TOS Builder',
    'exams'     => 'Exams',
];
$section_roots = [
    'subjects'  => 'subjects',
    'questions' => 'questions',
    'tos'       => 'tos',
    'exams'     => 'exams',
];

$nav_key      = isset($active_nav) ? $active_nav : '';
$current_page = isset($page_title) ? $page_title : 'Dashboard';
$section      = isset($sections[$nav_key]) ? $sections[$nav_key] : '';
$section_url  = isset($section_roots[$nav_key]) ? site_url($section_roots[$nav_key]) : '';

// Only show the crumb when it adds something the title does not already say.
$show_crumb = $section !== '' && $section !== $current_page && $section_url !== '';

/** Avatar markup: the uploaded photo when there is one, initials otherwise. */
function nexam_avatar($src, $initials, $id, $class = 'avatar')
{
    if ($src !== '') {
        return '<span class="' . $class . ' has-photo" id="' . $id . '" data-initials="' . htmlspecialchars($initials) . '">'
             . '<img src="' . htmlspecialchars($src) . '" alt="">'
             . '</span>';
    }

    return '<span class="' . $class . '" id="' . $id . '" data-initials="' . htmlspecialchars($initials) . '">'
         . htmlspecialchars($initials) . '</span>';
}
?>
<div class="main-content">
<header class="topbar">
    <div class="topbar-left">
        <button class="rail-toggle" id="rail-toggle" type="button"
                aria-label="Toggle navigation" aria-controls="sidebar">
            <i data-lucide="menu"></i>
        </button>

        <div class="topbar-heading">
            <?php if ($show_crumb): ?>
                <nav class="crumbs" aria-label="Breadcrumb">
                    <a href="<?= $section_url ?>"><?= htmlspecialchars($section) ?></a>
                    <span class="crumb-sep">/</span>
                </nav>
            <?php endif; ?>
            <div class="topbar-title"><?= htmlspecialchars($current_page) ?></div>
        </div>
    </div>

    <div class="topbar-right">

        <div class="bell-menu" id="bell-menu">
            <button class="bell-trigger" id="bell-trigger" type="button"
                    aria-haspopup="menu" aria-expanded="false" aria-label="Notifications">
                <i data-lucide="bell"></i>
                <span class="bell-count" id="bell-count" hidden>0</span>
            </button>

            <div class="bell-panel" id="bell-panel" role="menu" hidden>
                <div class="bell-head">
                    <span class="card-title">Needs Attention</span>
                    <span class="bell-sub" id="bell-sub">Checking…</span>
                </div>
                <div class="bell-list" id="bell-list"></div>
            </div>
        </div>

        <div class="user-menu" id="user-menu">
            <button class="user-trigger" type="button" id="user-trigger"
                    aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
                <?= nexam_avatar($bar_avatar, $bar_initials, 'user-avatar', 'avatar avatar-sm') ?>
                <i data-lucide="chevron-down"></i>
            </button>

            <div class="user-dropdown" id="user-dropdown" role="menu" hidden>
                <div class="user-dropdown-head">
                    <?= nexam_avatar($bar_avatar, $bar_initials, 'user-avatar-lg', 'avatar') ?>
                    <div class="ud-meta">
                        <div class="ud-name" id="user-display-name"><?= htmlspecialchars($bar_user_name) ?></div>
                        <div class="ud-email"><?= htmlspecialchars(isset($email) ? $email : '') ?></div>
                    </div>
                </div>

                <button type="button" class="user-dropdown-item" role="menuitem" data-account-action="profile">
                    <i data-lucide="user"></i> Change Profile
                </button>
                <button type="button" class="user-dropdown-item" role="menuitem" data-account-action="password">
                    <i data-lucide="lock"></i> Change Password
                </button>

                <div class="user-dropdown-sep"></div>

                <a href="<?= site_url('logout') ?>" class="user-dropdown-item danger" role="menuitem">
                    <i data-lucide="log-out"></i> Log out
                </a>
            </div>
        </div>
    </div>
</header>
