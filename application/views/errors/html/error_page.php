<?php
defined('BASEPATH') OR exit('No direct script access allowed');
$asset_root = function_exists('base_url') ? base_url('assets/') : '/nexam/assets/';
$home_url = function_exists('site_url') ? site_url('dashboard') : '/nexam/';
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title><?php echo htmlspecialchars($error_code . ' — ' . $error_heading, ENT_QUOTES, 'UTF-8'); ?></title>
    <link rel="icon" type="image/png" href="<?php echo htmlspecialchars($asset_root . 'images/favicon-32.png', ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="preload" href="<?php echo htmlspecialchars($asset_root . 'fonts/Google_Sans/static/GoogleSans-Regular.subset.ttf', ENT_QUOTES, 'UTF-8'); ?>" as="font" type="font/ttf" crossorigin>
    <link rel="preload" href="<?php echo htmlspecialchars($asset_root . 'fonts/Inter/static/Inter_18pt-Regular.subset.ttf', ENT_QUOTES, 'UTF-8'); ?>" as="font" type="font/ttf" crossorigin>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($asset_root . 'css/fonts.css', ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="stylesheet" href="<?php echo htmlspecialchars($asset_root . 'css/error.css', ENT_QUOTES, 'UTF-8'); ?>">
    <script src="https://unpkg.com/lucide@latest" defer></script>
    <script src="<?php echo htmlspecialchars($asset_root . 'js/error.js', ENT_QUOTES, 'UTF-8'); ?>" defer></script>
</head>
<body class="error-page error-page--<?php echo htmlspecialchars($error_tone, ENT_QUOTES, 'UTF-8'); ?>">
    <main class="error-card" aria-labelledby="error-title">
        <div class="error-mark" aria-hidden="true"><i data-lucide="<?php echo htmlspecialchars($error_icon, ENT_QUOTES, 'UTF-8'); ?>"></i></div>
        <div class="error-code">Error <?php echo htmlspecialchars($error_code, ENT_QUOTES, 'UTF-8'); ?></div>
        <h1 id="error-title"><?php echo htmlspecialchars($error_heading, ENT_QUOTES, 'UTF-8'); ?></h1>
        <p><?php echo htmlspecialchars($error_message, ENT_QUOTES, 'UTF-8'); ?></p>
        <div class="error-actions">
            <a class="error-button error-button--primary" href="<?php echo htmlspecialchars($home_url, ENT_QUOTES, 'UTF-8'); ?>">
                <i data-lucide="house"></i> Go to dashboard
            </a>
            <button class="error-button" type="button" data-error-back>
                <i data-lucide="arrow-left"></i> Go back
            </button>
        </div>
    </main>
</body>
</html>
