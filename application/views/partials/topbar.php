<?php
$bar_user_name = isset($full_name) && $full_name !== '' ? $full_name : 'nexam user';
$bar_initials  = name_initials($bar_user_name);
$bar_avatar    = !empty($avatar_path) ? base_url($avatar_path) : '';

// Section the current page belongs to, for the breadcrumb.
$sections = [
    'dashboard' => 'Dashboard',
    'subjects'  => 'Subjects',
    'questions' => 'Questions',
    'tos'       => 'Blueprints',
    'exams'     => 'Exams',
];
$section_roots = [
    'dashboard' => 'dashboard',
    'subjects'  => 'subjects',
    'questions' => 'questions',
    'tos'       => 'tos',
    'exams'     => 'exams',
];

$nav_key      = isset($active_nav) ? $active_nav : '';
$current_page = isset($page_title) ? $page_title : 'Dashboard';
$section      = isset($sections[$nav_key]) ? $sections[$nav_key] : '';
$section_url  = isset($section_roots[$nav_key]) ? site_url($section_roots[$nav_key]) : '';

$is_section_root = $section !== '' && $section === $current_page;

/** Avatar markup: the uploaded photo when there is one, initials otherwise. */
function nexam_avatar($src, $initials, $id, $class = 'avatar')
{
    if ($src !== '') {
        return '<span class="' . $class . ' has-photo" id="' . $id . '" data-initials="' . htmlspecialchars($initials) . '">'
             . '<img src="' . htmlspecialchars($src) . '" alt="User profile photo">'
             . '</span>';
    }

    return '<span class="' . $class . '" id="' . $id . '" data-initials="' . htmlspecialchars($initials) . '">'
         . htmlspecialchars($initials) . '</span>';
}
?>
<main class="main-content" id="main-content" tabindex="-1">
<header class="topbar">
    <div class="topbar-left">
        <button class="rail-toggle" id="rail-toggle" type="button"
                aria-label="Collapse navigation" aria-controls="sidebar" aria-expanded="true">
            <i data-lucide="menu"></i>
        </button>

        <button class="topbar-back" id="topbar-back" type="button"
                aria-label="Go back" title="Go back">
            <i data-lucide="arrow-left"></i>
        </button>

        <nav class="topbar-heading crumbs" aria-label="Breadcrumb">
            <ol class="crumb-list">
                <li class="crumb-item">
                    <?php if ($is_section_root): ?>
                        <a href="<?= site_url('dashboard') ?>">Workspace</a>
                    <?php elseif ($section_url !== ''): ?>
                        <a href="<?= $section_url ?>"><?= htmlspecialchars($section) ?></a>
                    <?php else: ?>
                        <span>Workspace</span>
                    <?php endif; ?>
                </li>
                <li class="crumb-sep" aria-hidden="true"><i data-lucide="chevron-right"></i></li>
                <li class="crumb-item crumb-current" aria-current="page"><span class="topbar-title"><?= htmlspecialchars($current_page) ?></span></li>
            </ol>
        </nav>
    </div>

    <div class="topbar-right">

        <div class="bell-menu" id="bell-menu">
            <button class="bell-trigger" id="bell-trigger" type="button"
                    aria-haspopup="menu" aria-expanded="false" aria-label="Notifications">
                <i data-lucide="bell"></i>
                <span class="bell-count" id="bell-count" hidden>0</span>
            </button>

            <div class="bell-panel" id="bell-panel" role="menu" aria-labelledby="bell-title" hidden>
                <div class="bell-head">
                    <span class="card-title" id="bell-title">Needs Attention</span>
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

                <form action="<?= site_url('logout') ?>" method="post" class="user-dropdown-form">
                    <input type="hidden" name="<?= htmlspecialchars($csrf_name) ?>" value="<?= htmlspecialchars($csrf_hash) ?>">
                    <button type="submit" class="user-dropdown-item danger" role="menuitem">
                        <i data-lucide="log-out"></i> Log out
                    </button>
                </form>
            </div>
        </div>
    </div>
</header>
