<?php
defined('BASEPATH') or exit('No direct script access allowed');

$route['default_controller'] = 'login';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

// Auth
$route['login']              = 'login';
$route['login/authenticate'] = 'login/authenticate';
$route['logout']             = 'login/logout';

// Registration
$route['register']           = 'login/register';
$route['register/submit']    = 'login/register_submit';

// OTP verification
$route['verify']             = 'login/verify';
$route['verify/submit']      = 'login/verify_submit';
$route['verify/resend']      = 'login/resend_otp';

// Forgot / reset password
$route['forgot']             = 'login/forgot';
$route['forgot/submit']      = 'login/forgot_submit';
$route['reset']              = 'login/reset';
$route['reset/submit']       = 'login/reset_submit';

// Dashboard
$route['dashboard']          = 'dashboard';

// Account (topbar user menu — JSON endpoints)
$route['account/me']         = 'account/me';
$route['account/profile']    = 'account/profile';
$route['account/password']   = 'account/password';
$route['account/avatar']     = 'account/avatar';
$route['account/avatar/remove'] = 'account/avatar_remove';

// Topbar notification bell (derived, read-only)
$route['alerts']             = 'notifications/index';

// Subjects
$route['subjects']                = 'subjects';
$route['subjects/create']         = 'subjects/create';
$route['subjects/edit/(:any)']    = 'subjects/edit/$1';
$route['subjects/delete/(:any)']  = 'subjects/delete/$1';
$route['subjects/view/(:any)']    = 'subjects/view/$1';

// Questions
$route['questions']                = 'questions';
$route['questions/create']         = 'questions/create';
$route['questions/edit/(:any)']    = 'questions/edit/$1';
$route['questions/delete/(:any)']  = 'questions/delete/$1';

// TOS Builder
$route['tos']                     = 'tos';
$route['tos/create']              = 'tos/create';
$route['tos/edit/(:any)']         = 'tos/edit/$1';
$route['tos/view/(:any)']         = 'tos/view/$1';
$route['tos/delete/(:any)']       = 'tos/delete/$1';
$route['tos/(:any)/add-topic']    = 'tos/add_topic/$1';
$route['tos/(:any)/delete-topic/(:any)'] = 'tos/delete_topic/$1/$2';

// Exams
$route['exams']                   = 'exams';
$route['exams/create']            = 'exams/create';
$route['exams/view/(:any)']       = 'exams/view/$1';
$route['exams/edit/(:any)']       = 'exams/edit/$1';
$route['exams/delete/(:any)']     = 'exams/delete/$1';
$route['exams/publish/(:any)']    = 'exams/publish/$1';
