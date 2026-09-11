<?php defined('BASEPATH') or exit('No direct script access allowed');

$config['protocol']     = 'smtp';
$config['smtp_host']    = 'mail.mati.gov.ph';
$config['smtp_user']    = 'nexam@mati.gov.ph';
$config['smtp_pass']    = getenv('NEXAM_SMTP_PASS') ?: 'nexamcapstone';
$config['smtp_port']    = 465;
$config['smtp_crypto']  = 'ssl';
$config['smtp_timeout'] = 10;
$config['mailtype']     = 'html';
$config['charset']      = 'utf-8';
$config['newline']      = "\r\n";
$config['crlf']         = "\r\n";
$config['wordwrap']     = true;
$config['from_email']   = 'nexam@mati.gov.ph';
$config['from_name']    = 'nexam';
