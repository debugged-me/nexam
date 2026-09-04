<?php
defined('BASEPATH') or exit('No direct script access allowed');


$route['default_controller'] = 'Login';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

$route['leaderboard'] = 'login/leaderboard';
$route['leaderboard/data'] = 'login/leaderboard_data';

$route['dashboard'] = 'judgedashboard';
$route['judgedashboard'] = 'judgedashboard';
$route['judgedashboard/score/(:num)'] = 'judgedashboard/score/$1';
$route['judgedashboard/submit_score'] = 'judgedashboard/submit_score';
$route['judgedashboard/tabulation'] = 'judgedashboard/tabulation';
$route['judgedashboard/judge_results'] = 'judgedashboard/judge_results';
$route['judgedashboard/my_results'] = 'judgedashboard/my_results';
$route['judgedashboard/logout'] = 'judgedashboard/logout';
