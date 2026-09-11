<?php defined('BASEPATH') or exit('No direct script access allowed');

/*
 * Production should provide NEXAM_SMTP_PASS through the web server/process
 * environment. For local development only, copy the setting below to
 * application/config/development/email.php (which is ignored by Git).
 */
$config['smtp_pass'] = 'nexamcapstone';
