<?php
// Admin top navigation bar — loaded by all admin views
// Role-based items can be added here later
?>
<?php
$manilaDate = new DateTime('now', new DateTimeZone('Asia/Manila'));
?>
<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay" onclick="toggleMobileSidebar()"></div>
<header class="topbar">
    <div style="display:flex;align-items:center">
        <button class="mobile-menu-btn" onclick="toggleMobileSidebar()" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
        </button>
        <div class="topbar-title"><?= isset($page_title) ? htmlspecialchars($page_title) : 'Dashboard' ?></div>
    </div>
    <div class="topbar-user" style="gap:1.2rem">
        <span id="live-clock" style="font-family:'Karla',monospace;font-size:.82rem;color:var(--muted);letter-spacing:.02em">
            <span style="color:var(--gold);font-weight:500"><?= $manilaDate->format('h:i:s A') ?></span> <?= $manilaDate->format('M j, Y') ?>
        </span>
        <span style="color:var(--border)">|</span>
        <span class="topbar-user-name"><?= htmlspecialchars($this->session->userdata('admin_name')) ?></span>
        <span style="color:var(--border)">|</span>
        <span><?= ucfirst($this->session->userdata('admin_role')) ?></span>
    </div>
</header>

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

    (function() {
        var clockEl = document.getElementById('live-clock');
        if (!clockEl) return;

        function updateClock() {
            var now = new Date();
            var options = {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            };
            var dateStr = new Intl.DateTimeFormat('en-US', options).format(now);
            var timeOptions = {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            };
            var timeStr = new Intl.DateTimeFormat('en-US', timeOptions).format(now);
            clockEl.innerHTML = '<span style="color:var(--gold);font-weight:500">' + timeStr + '</span> ' + dateStr;
        }
        updateClock();
        setInterval(updateClock, 1000);
    })();
</script>