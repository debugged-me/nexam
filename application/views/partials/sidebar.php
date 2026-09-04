<?php
$currentPage = isset($active_nav) ? $active_nav : '';
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
        <button class="sidebar-close" onclick="toggleMobileSidebar()" aria-label="Close menu">
            <i data-lucide="x"></i>
        </button>
    </div>

    <nav class="sidebar-nav">
        <a href="<?= site_url('dashboard') ?>" class="nav-item <?= $currentPage === 'dashboard' ? 'active' : '' ?>">
            <i data-lucide="layout-dashboard"></i>
            <span>Dashboard</span>
        </a>
        <a href="<?= site_url('subjects') ?>" class="nav-item <?= $currentPage === 'subjects' ? 'active' : '' ?>">
            <i data-lucide="book-open"></i>
            <span>Subjects</span>
        </a>
        <a href="<?= site_url('questions') ?>" class="nav-item <?= $currentPage === 'questions' ? 'active' : '' ?>">
            <i data-lucide="help-circle"></i>
            <span>Question Bank</span>
        </a>
        <a href="<?= site_url('tos') ?>" class="nav-item <?= $currentPage === 'tos' ? 'active' : '' ?>">
            <i data-lucide="table"></i>
            <span>TOS Builder</span>
        </a>
        <a href="<?= site_url('exams') ?>" class="nav-item <?= $currentPage === 'exams' ? 'active' : '' ?>">
            <i data-lucide="file-text"></i>
            <span>Exams</span>
        </a>
        <a href="<?= site_url('logout') ?>" class="nav-item logout">
            <i data-lucide="log-out"></i>
            <span>Logout</span>
        </a>
    </nav>

    <div class="sidebar-footer">
        &copy; <?= date('Y') ?> nexam
    </div>
</aside>

<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay" onclick="toggleMobileSidebar()"></div>

<script>
function toggleMobileSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('mobileSidebarOverlay');
    if (!sb) return;
    var isOpen = sb.classList.contains('mobile-open');
    if (isOpen) {
        sb.classList.remove('mobile-open');
        if (ov) ov.classList.remove('show');
        document.body.style.overflow = '';
    } else {
        sb.classList.add('mobile-open');
        if (ov) ov.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

(function() {
    var sb = document.getElementById('sidebar');
    if (!sb) return;
    sb.querySelectorAll('a.nav-item').forEach(function(link) {
        link.addEventListener('click', function() {
            if (sb.classList.contains('mobile-open')) {
                sb.classList.remove('mobile-open');
                var ov = document.getElementById('mobileSidebarOverlay');
                if (ov) ov.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    });
})();
</script>
