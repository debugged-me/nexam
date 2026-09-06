<?php
defined('BASEPATH') OR exit('No direct script access allowed');
$error_code = '403';
$error_heading = 'Access denied';
$error_message = 'You do not have permission to access this page.';
$error_tone = 'danger';
$error_icon = 'shield-x';
include __DIR__ . '/error_page.php';
