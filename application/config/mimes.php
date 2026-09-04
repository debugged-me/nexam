<?php
defined('BASEPATH') or exit('No direct script access allowed');

/*
| -------------------------------------------------------------------
| MIME TYPES
| -------------------------------------------------------------------
| This file contains an array of mime types.  It is used by the
| Upload class to help identify allowed file types.
|
*/

return array(
	'hqx'   => array('application/mac-binhex40', 'application/mac-binhex', 'application/x-binhex40', 'application/x-mac-binhex40'),
	'cpt'   => 'application/mac-compactpro',
	'csv'   => array('text/x-comma-separated-values', 'text/comma-separated-values', 'application/octet-stream', 'application/vnd.ms-excel', 'application/x-csv', 'text/x-csv', 'text/csv', 'application/csv', 'application/excel', 'application/vnd.msexcel', 'text/plain'),
	'bin'   => array('application/macbinary', 'application/mac-binary', 'application/octet-stream', 'application/x-binary', 'application/x-macbinary'),
	'dms'   => 'application/octet-stream',
	'lha'   => 'application/octet-stream',
	'lzh'   => 'application/octet-stream',
	'exe'   => array('application/octet-stream', 'application/x-msdownload'),
	'class' => 'application/octet-stream',
	'psd'   => array('application/x-photoshop', 'image/vnd.adobe.photoshop'),
	'so'    => 'application/octet-stream',
	'sea'   => 'application/octet-stream',
	'dll'   => 'application/octet-stream',
	'oda'   => 'application/oda',

	// === FIXED PDF ===
	'pdf'   => array('application/pdf', 'application/force-download', 'application/x-download', 'binary/octet-stream', 'application/x-pdf', 'application/acrobat', 'applications/vnd.pdf', 'text/pdf', 'text/x-pdf'),

	'ai'    => array('application/pdf', 'application/postscript'),
	'eps'   => 'application/postscript',
	'ps'    => 'application/postscript',

	// === IMAGES ===
	'bmp'   => array('image/bmp', 'image/x-bmp', 'image/x-bitmap', 'image/x-xbitmap', 'image/x-win-bitmap', 'image/x-windows-bmp', 'image/ms-bmp', 'image/x-ms-bmp', 'application/bmp', 'application/x-bmp', 'application/x-win-bitmap'),
	'gif'   => 'image/gif',

	// ✅ JPEG / JPG (expanded with image/jpg)
	'jpeg'  => array('image/jpeg', 'image/pjpeg', 'image/jpg'),
	'jpg'   => array('image/jpeg', 'image/pjpeg', 'image/jpg'),
	'jpe'   => array('image/jpeg', 'image/pjpeg', 'image/jpg'),

	// PNG
	'png'   => array('image/png', 'image/x-png'),

	'tiff'  => 'image/tiff',
	'tif'   => 'image/tiff',
	'ico'   => array('image/x-icon', 'image/x-ico', 'image/vnd.microsoft.icon'),
	'svg'   => array('image/svg+xml', 'application/xml', 'text/xml'),

	// === AUDIO / VIDEO (kept for completeness) ===
	'wav'   => array('audio/x-wav', 'audio/wave', 'audio/wav'),
	'mp3'   => array('audio/mpeg', 'audio/mpg', 'audio/mpeg3', 'audio/mp3'),
	'mp4'   => 'video/mp4',
	'avi'   => array('video/x-msvideo', 'video/msvideo', 'video/avi', 'application/x-troff-msvideo'),
	'mov'   => 'video/quicktime',
	'qt'    => 'video/quicktime',
	'wmv'   => array('video/x-ms-wmv', 'video/x-ms-asf'),
	'flv'   => 'video/x-flv',
	'webm'  => 'video/webm',

	// === TEXT / DOCS (common office formats) ===
	'doc'   => array('application/msword', 'application/vnd.ms-office'),
	'docx'  => array('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/msword', 'application/x-zip'),
	'xls'   => array('application/vnd.ms-excel', 'application/msexcel', 'application/x-msexcel', 'application/x-ms-excel', 'application/x-excel', 'application/x-dos_ms_excel', 'application/xls', 'application/x-xls', 'application/excel', 'application/download', 'application/vnd.ms-office', 'application/msword'),
	'xlsx'  => array('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/vnd.ms-excel', 'application/msword', 'application/x-zip'),
	'ppt'   => array('application/powerpoint', 'application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/msword'),
	'pptx'  => array('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/x-zip', 'application/zip'),

	'txt'   => 'text/plain',
	'text'  => 'text/plain',
	'html'  => array('text/html', 'text/plain'),
	'htm'   => array('text/html', 'text/plain'),
	'css'   => array('text/css', 'text/plain'),
	'json'  => array('application/json', 'text/json'),
	'xml'   => array('application/xml', 'text/xml', 'text/plain'),
	'xsl'   => array('application/xml', 'text/xsl', 'text/xml'),

	// you can keep the rest of your original mappings for rar, zip, etc.
);
