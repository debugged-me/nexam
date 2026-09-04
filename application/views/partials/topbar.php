<?php
$manilaDate = new DateTime('now', new DateTimeZone('Asia/Manila'));
?>
<div class="main-content">
<header class="topbar">
    <div class="topbar-left">
        <button class="mobile-menu-btn" onclick="toggleMobileSidebar()" aria-label="Menu">
            <i data-lucide="menu"></i>
        </button>
        <div class="topbar-title"><?= isset($page_title) ? htmlspecialchars($page_title) : 'Dashboard' ?></div>
    </div>
    <div class="topbar-right">
        <span id="live-clock" class="live-clock">
            <span class="clock-time"><?= $manilaDate->format('h:i:s A') ?></span> <?= $manilaDate->format('M j, Y') ?>
        </span>
        <span class="topbar-divider">|</span>
        <span class="topbar-user-name"><?= htmlspecialchars($full_name) ?></span>
        <span class="topbar-divider">|</span>
        <span class="topbar-user-role"><?= htmlspecialchars($role) ?></span>
    </div>
</header>

<script>
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
        clockEl.innerHTML = '<span class="clock-time">' + timeStr + '</span> ' + dateStr;
    }
    updateClock();
    setInterval(updateClock, 1000);
})();
</script>
