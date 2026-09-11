<?php defined('BASEPATH') or exit('No direct script access allowed');

$smtpPassword = getenv('NEXAM_SMTP_PASS');

$config['protocol']       = 'smtp';
$config['smtp_host']      = getenv('NEXAM_SMTP_HOST') ?: 'mail.mati.gov.ph';
$config['smtp_user']      = getenv('NEXAM_SMTP_USER') ?: 'nexam@mati.gov.ph';
$config['smtp_pass']      = $smtpPassword === false ? '' : $smtpPassword;
$config['smtp_port']      = (int) (getenv('NEXAM_SMTP_PORT') ?: 465);
$config['smtp_crypto']    = getenv('NEXAM_SMTP_CRYPTO') ?: 'ssl';
$config['smtp_timeout']   = 30;
$config['smtp_keepalive'] = false;
$config['mailtype']       = 'html';
$config['charset']        = 'utf-8';
$config['newline']        = "\r\n";
$config['crlf']           = "\r\n";
$config['wordwrap']       = true;
$config['validate']       = true;
$config['useragent']      = 'nexam';
