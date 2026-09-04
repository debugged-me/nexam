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

            // Maintenance Page with Bootstrap
            echo '
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Maintenance Mode</title>
                <!-- Bootstrap CSS -->
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body {
                        background-color: #f8f9fa;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        text-align: center;
                    }
                    .container {
                        max-width: 500px;
                        background: #ffffff;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
                    }
                    .spinner-border {
                        margin: 20px auto;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="text-danger"><i class="bi bi-tools"></i> Maintenance Mode</h1>
                    <p class="lead">Our website is currently undergoing maintenance. We\'ll be back soon!</p>
                    <div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                 
                </div>

                <!-- Bootstrap Icons & JS -->
                <script src="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>';
            exit;
        }
    }
}
