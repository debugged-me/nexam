<?php
defined('BASEPATH') or exit('No direct script access allowed');

class MaintenanceMode
{
    public function check_maintenance()
    {
        // Load the config file manually
        include(APPPATH . 'config/config.php');

        // Check if maintenance mode is enabled
        if (isset($config['maintenance_mode']) && $config['maintenance_mode'] === TRUE) {
            header('HTTP/1.1 503 Service Temporarily Unavailable');
            header('Retry-After: 3600'); // Suggest retry after 1 hour

            // Maintenance page — uses the nexam design system (local fonts,
            // shared tokens, Lucide icons). Relative paths because hooks run
            // before CI is fully bootstrapped (no base_url() available).
            echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Maintenance</title>
    <meta name="theme-color" content="#1A2942">
    <link href="assets/css/fonts.css" rel="stylesheet">
    <link href="assets/css/maintenance.css" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="maintenance-body">
    <div class="maintenance-card">
        <div class="maintenance-icon"><i data-lucide="wrench"></i></div>
        <h1 class="maintenance-title">Maintenance Mode</h1>
        <p class="maintenance-text">nexam is currently undergoing maintenance. We\'ll be back soon.</p>
        <div class="maintenance-spinner" role="status" aria-label="Loading"></div>
    </div>
    <script>lucide.createIcons();</script>
</body>
</html>';
            exit;
        }
    }
}
