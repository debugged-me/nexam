<?php
$currentPage = isset($current_page) ? $current_page : '';
$baseUrl = base_url();
$isAdmin = $this->session->userdata('admin_logged_in');
$isJudge = $this->session->userdata('judge_id');
$adminRole = $this->session->userdata('admin_role');
$isTabulator = $isAdmin && $adminRole === 'tabulator';
$isFullAdmin = $isAdmin && !$isTabulator; // admin or co-admin
?>

<aside class="sidebar">
    <div class="sidebar-brand">
        <div class="sidebar-brand-icon">&#9812;</div>
        <div class="sidebar-brand-text">
            <?php if ($isTabulator): ?>Tabulator Portal<?php elseif ($isFullAdmin): ?>Admin Portal<?php elseif ($isJudge): ?>Judge Portal<?php endif; ?>
            <small>Binibining Mati</small>
        </div>
    </div>
    <nav class="sidebar-nav">
        <?php if ($isTabulator): ?>
            <a href="<?= site_url('admin/dashboard') ?>" class="nav-item <?= $currentPage === 'dashboard' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
            </a>
            <a href="<?= site_url('admin/rounds') ?>" class="nav-item <?= $currentPage === 'rounds' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                Rounds
            </a>
            <a href="<?= site_url('judgedashboard/tabulation') ?>" class="nav-item <?= $currentPage === 'tabulation' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                </svg>
                Tabulation
            </a>
            <a href="<?= site_url('judgedashboard/judge_results') ?>" class="nav-item <?= $currentPage === 'judge_results' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11H3v10h6V11Z" />
                    <path d="M15 7H9v14h6V7Z" />
                    <path d="M21 3h-6v18h6V3Z" />
                </svg>
                Per-Judge Results
            </a>
            <a href="<?= site_url('admin/logout') ?>" class="nav-item" style="margin-top:auto;border-top:1px solid rgba(212,175,55,.15);color:rgba(239,68,68,.8)" onmouseover="this.style.color='#ef4444';this.style.background='rgba(239,68,68,.08)'" onmouseout="this.style.color='rgba(239,68,68,.8)';this.style.background='transparent'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
            </a>
        <?php elseif ($isFullAdmin): ?>
            <a href="<?= site_url('admin/dashboard') ?>" class="nav-item <?= $currentPage === 'dashboard' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
            </a>
            <a href="<?= site_url('admin/events') ?>" class="nav-item <?= $currentPage === 'events' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Events
            </a>
            <a href="<?= site_url('admin/categories') ?>" class="nav-item <?= $currentPage === 'categories' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Categories
            </a>
            <a href="<?= site_url('admin/criteria') ?>" class="nav-item <?= $currentPage === 'criteria' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                Criteria
            </a>
            <a href="<?= site_url('admin/candidates') ?>" class="nav-item <?= $currentPage === 'candidates' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
                Candidates
            </a>
            <a href="<?= site_url('admin/judges') ?>" class="nav-item <?= $currentPage === 'judges' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Users
            </a>
            <a href="<?= site_url('admin/rounds') ?>" class="nav-item <?= $currentPage === 'rounds' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                Rounds
            </a>
            <a href="<?= site_url('judgedashboard/tabulation') ?>" class="nav-item <?= $currentPage === 'tabulation' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                </svg>
                Tabulation
            </a>
            <a href="<?= site_url('judgedashboard/judge_results') ?>" class="nav-item <?= $currentPage === 'judge_results' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11H3v10h6V11Z" />
                    <path d="M15 7H9v14h6V7Z" />
                    <path d="M21 3h-6v18h6V3Z" />
                </svg>
                Per-Judge Results
            </a>
            <a href="<?= site_url('admin/logout') ?>" class="nav-item" style="margin-top:auto;border-top:1px solid rgba(212,175,55,.15);color:rgba(239,68,68,.8)" onmouseover="this.style.color='#ef4444';this.style.background='rgba(239,68,68,.08)'" onmouseout="this.style.color='rgba(239,68,68,.8)';this.style.background='transparent'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
            </a>
        <?php elseif ($isJudge): ?>
            <a href="<?= site_url('judgedashboard') ?>" class="nav-item <?= ($currentPage === 'judge_dashboard' || $currentPage === 'judge_score') ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Score Entry
            </a>
            <a href="<?= site_url('judgedashboard/my_results') ?>" class="nav-item <?= $currentPage === 'my_results' ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                My Score Sheet
            </a>
            <a href="<?= site_url('judgedashboard/logout') ?>" class="nav-item" style="margin-top:auto;border-top:1px solid rgba(212,175,55,.15);color:rgba(239,68,68,.8)" onmouseover="this.style.color='#ef4444';this.style.background='rgba(239,68,68,.08)'" onmouseout="this.style.color='rgba(239,68,68,.8)';this.style.background='transparent'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
            </a>
        <?php endif; ?>
    </nav>
    <div class="sidebar-footer">
        &copy; <?= date('Y') ?> Binibining Mati
    </div>
</aside>

<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay" onclick="toggleMobileSidebar()"></div>

<script>
    function toggleMobileSidebar() {
        var sb = document.querySelector('.sidebar');
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
</script>

<script>
    (function() {
        var sb = document.querySelector('.sidebar');
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