<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($page_title) ? htmlspecialchars($page_title) . ' — ' : '' ?>nexam</title>
    <meta name="theme-color" content="#FFFFFF">
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo nexam_asset('assets/images/favicon-32.png'); ?>">
    <link rel="preload" href="<?php echo nexam_asset('assets/fonts/Google_Sans/static/GoogleSans-Regular.subset.ttf'); ?>" as="font" type="font/ttf" crossorigin>
    <link rel="preload" href="<?php echo nexam_asset('assets/fonts/Inter/static/Inter_18pt-Regular.subset.ttf'); ?>" as="font" type="font/ttf" crossorigin>
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
    <link href="<?php echo nexam_asset('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/layout.css'); ?>" rel="stylesheet" type="text/css">
    <?php if (!empty($page_css)): ?>
        <?php foreach ((array) $page_css as $css): ?>
            <link href="<?php echo nexam_asset('assets/css/' . $css); ?>" rel="stylesheet" type="text/css">
        <?php endforeach; ?>
    <?php endif; ?>
    <?php if (!empty($use_datatables)): ?>
        <link href="<?php echo nexam_asset('assets/libs/datatables/dataTables.bootstrap4-1.13.11.min.css'); ?>" rel="stylesheet" type="text/css">
        <link href="<?php echo nexam_asset('assets/css/datatables.css'); ?>" rel="stylesheet" type="text/css">
    <?php endif; ?>
    <script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body class="app-body">
<script src="<?php echo nexam_asset('assets/js/app-shell-init.js'); ?>"></script>
<a class="skip-link" href="#main-content">Skip to main content</a>
