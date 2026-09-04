<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($page_title) ? htmlspecialchars($page_title) . ' — ' : '' ?>nexam</title>
    <meta name="theme-color" content="#FFFFFF">
    <link rel="icon" href="<?php echo base_url('assets/images/favicon.png'); ?>">
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
