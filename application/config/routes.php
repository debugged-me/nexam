<?php
defined('BASEPATH') or exit('No direct script access allowed');

$route['default_controller'] = 'login';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

// Auth
$route['login']              = 'login';
$route['login/authenticate'] = 'login/authenticate';
$route['logout']             = 'login/logout';

// Temporary dashboard placeholder (replace with real dashboard controller later)
$route['dashboard']          = 'home/dashboard';
