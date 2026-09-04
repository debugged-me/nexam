<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Dashboard</title>
    <link href="<?php echo base_url('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/dashboard.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
    <div class="topbar">
        <div class="logo">nexam</div>
        <div class="user-area">
            <strong><?php echo htmlspecialchars($full_name); ?></strong>
            <span class="sep">&middot;</span>
            <span class="role"><?php echo htmlspecialchars($role); ?></span>
            <a href="<?php echo site_url('logout'); ?>" class="logout-btn">
                <i data-lucide="log-out"></i>
                Logout
            </a>
        </div>
    </div>
    <div class="container">
        <div class="welcome-card">
            <h1>Welcome, <?php echo htmlspecialchars(explode(' ', $full_name)[0]); ?>!</h1>
            <p>You're signed in as <strong><?php echo htmlspecialchars($email); ?></strong>.<br>The exam-builder dashboard modules will appear here.</p>
            <span class="badge">TOS-aligned Exam Builder</span>
            <p class="placeholder">Subjects, Questions, TOS, and Exams modules coming next.</p>
        </div>
    </div>
    <script src="<?php echo base_url('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo base_url('assets/js/modal.js'); ?>"></script>
    <script>lucide.createIcons();</script>
</body>
</html>
