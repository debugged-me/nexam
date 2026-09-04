<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($page_title) ? htmlspecialchars($page_title) . ' — ' : '' ?>nexam</title>
    <meta name="theme-color" content="#FFFFFF">
    <link rel="icon" href="<?php echo base_url('assets/images/favicon.png'); ?>">
    <?php if (isset($csrf_name)): ?>
        <meta name="csrf-name" content="<?php echo $csrf_name; ?>">
        <meta name="csrf-hash" content="<?php echo $csrf_hash; ?>">
    <?php endif; ?>
    <meta name="account-me-url" content="<?php echo site_url('account/me'); ?>">
    <meta name="account-profile-url" content="<?php echo site_url('account/profile'); ?>">
    <meta name="account-password-url" content="<?php echo site_url('account/password'); ?>">
    <meta name="account-avatar-url" content="<?php echo site_url('account/avatar'); ?>">
    <meta name="account-avatar-remove-url" content="<?php echo site_url('account/avatar/remove'); ?>">
    <meta name="alerts-url" content="<?php echo site_url('alerts'); ?>">
    <link href="<?php echo base_url('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/layout.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <?php if (!empty($page_css)): ?>
        <?php foreach ((array) $page_css as $css): ?>
            <link href="<?php echo base_url('assets/css/' . $css); ?>" rel="stylesheet" type="text/css">
        <?php endforeach; ?>
    <?php endif; ?>
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="app-body">
<script>
    /* Applied before first paint so a collapsed rail never flashes open. */
    try {
        if (localStorage.getItem("nexam:rail-collapsed") === "1" && window.matchMedia("(min-width: 992px)").matches) {
            document.body.classList.add("rail-collapsed");
        }
    } catch (e) {}
</script>
