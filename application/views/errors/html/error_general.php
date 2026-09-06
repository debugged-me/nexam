<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$status_code = function_exists('http_response_code') ? (int) http_response_code() : 500;
if ($status_code === 403) {
    include __DIR__ . '/error_403.php';
    return;
}

$error_code = $status_code >= 400 ? (string) $status_code : '500';
$error_heading = !empty($heading) && $heading !== 'An Error Was Encountered'
    ? strip_tags((string) $heading)
    : 'Something went wrong';
$plain_message = trim(strip_tags((string) $message));
$error_message = $plain_message !== '' ? $plain_message : 'We could not complete that request. Please try again.';
$error_tone = 'warning';
$error_icon = 'triangle-alert';
include __DIR__ . '/error_page.php';
