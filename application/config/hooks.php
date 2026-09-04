<?php
defined('BASEPATH') or exit('No direct script access allowed');

/*
| -------------------------------------------------------------------------
| Hooks
| -------------------------------------------------------------------------
| This file lets you define "hooks" to extend CI without hacking the core
| files.  Please see the user guide for info:
|
|	https://codeigniter.com/user_guide/general/hooks.html
|
*/

$config['enable_hooks'] = TRUE;

// Auto-apply idempotent schema deltas (adds missing columns) so production
// never needs a manual ALTER. See application/hooks/SchemaSync.php.
$hook['post_controller_constructor'][] = array(
    'class'    => 'SchemaSync',
    'function' => 'migrate',
    'filename' => 'SchemaSync.php',
    'filepath' => 'hooks',
);

// Temporarily disabled maintenance mode hook
// $hook['pre_controller'] = array(
//     'class'    => 'MaintenanceMode',
//     'function' => 'check_maintenance',
//     'filename' => 'MaintenanceMode.php',
//     'filepath' => 'hooks',
// );

$hook['post_controller_constructor'][] = array(
    'class'    => 'BrowserRequestGuard',
    'function' => 'protect',
    'filename' => 'BrowserRequestGuard.php',
    'filepath' => 'hooks',
);

$hook['post_controller_constructor'][] = array(
    'class'    => 'AcademicOfficerGuard',
    'function' => 'restrict',
    'filename' => 'AcademicOfficerGuard.php',
    'filepath' => 'hooks',
);
