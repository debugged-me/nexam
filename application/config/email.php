<?php defined('BASEPATH') or exit('No direct script access allowed');


$config['protocol']     = 'smtp';
$config['smtp_host']    = 'mail.srmsportal.com';
$config['smtp_user']    = 'tagumdoc@srmsportal.com';
// Set SRMS_SMTP_PASS in the server environment. The literal below is only a
// last-resort fallback and is rejected by the mail server (535), so a wrong or
// missing value shows up as a visible send failure rather than silent loss.
$config['smtp_pass']    = getenv('SRMS_SMTP_PASS') ?: 'moth34board';
$config['smtp_port']    = 465;
$config['smtp_crypto']  = 'ssl';

$config['smtp_timeout'] = 10;
$config['mailtype']     = 'html';
$config['charset']      = 'utf-8';
$config['newline']      = "\r\n";
$config['crlf']         = "\r\n";
$config['wordwrap']     = true;

// Default "From" address used for all outgoing nexam emails.
$config['from_email']   = 'tagumdoc@srmsportal.com';
$config['from_name']    = 'nexam';
