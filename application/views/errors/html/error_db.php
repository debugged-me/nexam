<?php
defined('BASEPATH') OR exit('No direct script access allowed');
$heading = !empty($heading) ? $heading : 'Database error';
$message = !empty($message) ? $message : 'The service is temporarily unavailable. Please try again.';
include __DIR__ . '/error_general.php';
