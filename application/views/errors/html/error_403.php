<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$resolved_heading = trim((string) $heading);
if ($resolved_heading === '' || $resolved_heading === 'An Error Was Encountered') {
	$resolved_heading = 'Access Denied';
}

$resolved_message = $message;
$plain_message = trim(strip_tags((string) $message));
if ($plain_message === '' || $plain_message === 'Access Denied') {
	$resolved_message = '<p>You do not have permission to access this page.</p>';
}

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo htmlspecialchars($resolved_heading, ENT_QUOTES, 'UTF-8'); ?></title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after { box-sizing:border-box; }
html,body { height:100%; }
body {
	margin:0;
	font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	color:#0f172a;
	background: linear-gradient(135deg, #fff1f2 0%, #fef2f2 50%, #fff7ed 100%);
	min-height:100%;
	display:flex; align-items:center; justify-content:center;
	padding:32px 20px;
	overflow:hidden; position:relative;
	-webkit-font-smoothing:antialiased;
}

.sky { position:absolute; inset:0; pointer-events:none; }
.sky span {
	position:absolute; width:6px; height:6px; border-radius:50%;
	opacity:.4; animation: twinkle 3.4s ease-in-out infinite;
}
.sky span:nth-child(1){ top:12%; left:8%;  background:#ef4444; }
.sky span:nth-child(2){ top:22%; left:88%; background:#fb7185; animation-delay:.6s; width:8px; height:8px; }
.sky span:nth-child(3){ top:68%; left:6%;  background:#f43f5e; animation-delay:1.2s; }
.sky span:nth-child(4){ top:80%; left:84%; background:#fb923c; animation-delay:.4s; width:10px; height:10px; }
.sky span:nth-child(5){ top:38%; left:14%; background:#dc2626; animation-delay:1.8s; width:5px; height:5px; }
.sky span:nth-child(6){ top:54%; left:92%; background:#ef4444; animation-delay:.9s; }
.sky span:nth-child(7){ top:8%;  left:52%; background:#fb7185; animation-delay:1.5s; width:4px; height:4px; }
.sky span:nth-child(8){ top:90%; left:48%; background:#f97316; animation-delay:2.1s; width:5px; height:5px; }

@keyframes twinkle { 0%,100%{opacity:.25; transform:scale(.85);} 50%{opacity:1; transform:scale(1.15);} }

.wrap { position:relative; width:100%; max-width:560px; text-align:center; z-index:1; }

.mascot-stage { position:relative; width:260px; height:280px; margin:0 auto 8px; }
.mascot { width:100%; height:100%; animation: float 4s ease-in-out infinite; transform-origin:center bottom; }
.shadow { animation: shadowPulse 4s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
.lock   { animation: jiggle 1.4s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
.shackle { animation: shackleHop 1.4s ease-in-out infinite; transform-origin:center bottom; transform-box:fill-box; }
.no-sign { animation: pop 2.2s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }

@keyframes float       { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-12px);} }
@keyframes shadowPulse { 0%,100%{transform:scale(1); opacity:.18;} 50%{transform:scale(.82); opacity:.10;} }
@keyframes jiggle      { 0%,100%{transform:rotate(-3deg);} 50%{transform:rotate(3deg);} }
@keyframes shackleHop  { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-3px);} }
@keyframes pop         { 0%,100%{transform:scale(.9); opacity:.85;} 50%{transform:scale(1.05); opacity:1;} }

.code-tag {
	display:inline-flex; align-items:center; gap:8px;
	padding:6px 14px; font-size:12px; font-weight:600;
	letter-spacing:.12em; text-transform:uppercase;
	color:#b91c1c; background:#fef2f2; border:1px solid #fee2e2; border-radius:999px;
	margin-bottom:14px;
}
.code-tag .pulse {
	width:8px; height:8px; border-radius:50%; background:#ef4444;
	box-shadow:0 0 0 0 rgba(239,68,68,.6); animation: ping 1.6s ease-out infinite;
}
@keyframes ping {
	0%   { box-shadow:0 0 0 0   rgba(239,68,68,.55); }
	70%  { box-shadow:0 0 0 10px rgba(239,68,68,0); }
	100% { box-shadow:0 0 0 0   rgba(239,68,68,0); }
}

h1 { font-size:clamp(24px,3.4vw,32px); font-weight:800; margin:0 0 10px; letter-spacing:-.02em; color:#0f172a; }
.msg { font-size:15px; line-height:1.65; color:#475569; margin:0 auto 22px; max-width:440px; }
.msg :is(p,a){ margin:0; }
.msg a { color:#2563eb; text-decoration:none; font-weight:600; }
.msg a:hover { text-decoration:underline; }

.hint {
	display:inline-flex; align-items:center; gap:6px;
	font-size:13px; color:#64748b;
	padding:8px 14px;
	background:#ffffffaa; border:1px solid #e2e8f0; border-radius:999px;
	backdrop-filter: blur(4px);
}
.hint svg { width:14px; height:14px; }

@media (max-width:480px){ .mascot-stage{width:220px; height:240px;} }
</style>
</head>
<body>
	<div class="sky" aria-hidden="true">
		<span></span><span></span><span></span><span></span>
		<span></span><span></span><span></span><span></span>
	</div>

	<main class="wrap">
		<div class="mascot-stage" aria-hidden="true">
			<svg class="mascot" viewBox="0 0 260 280" xmlns="http://www.w3.org/2000/svg">
				<ellipse class="shadow" cx="130" cy="262" rx="68" ry="9" fill="#0f172a"/>

				<!-- floating "no entry" sign -->
				<g class="no-sign" transform="translate(210 100)">
					<circle cx="0" cy="0" r="18" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
					<rect x="-11" y="-3" width="22" height="6" rx="1.5" fill="#ffffff"/>
				</g>

				<!-- body -->
				<g>
					<circle cx="130" cy="170" r="78" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>

					<!-- graduation cap -->
					<rect x="118" y="92" width="24" height="8" rx="2" fill="#0f172a"/>
					<polygon points="70,88 130,62 190,88 130,100" fill="#0f172a"/>
					<path d="M188 92 C 196 100, 198 112, 196 120" stroke="#fbbf24" stroke-width="3" fill="none" stroke-linecap="round"/>
					<circle cx="196" cy="124" r="4" fill="#fbbf24"/>

					<!-- blush -->
					<circle cx="86"  cy="190" r="7" fill="#fecaca" opacity=".75"/>
					<circle cx="174" cy="190" r="7" fill="#fecaca" opacity=".75"/>

					<!-- stern eyes (small dashes) -->
					<g stroke="#0f172a" stroke-width="4" stroke-linecap="round">
						<line x1="96"  y1="166" x2="114" y2="166"/>
						<line x1="146" y1="166" x2="164" y2="166"/>
					</g>

					<!-- firm flat mouth -->
					<line x1="118" y1="206" x2="142" y2="206" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>

					<!-- padlock held in front -->
					<g class="lock" transform="translate(130 232)">
						<g class="shackle">
							<path d="M-12 -2 Q -12 -18, 0 -18 Q 12 -18, 12 -2"
							      stroke="#475569" stroke-width="5" fill="none" stroke-linecap="round"/>
						</g>
						<rect x="-18" y="-2" width="36" height="28" rx="6" fill="#f59e0b" stroke="#b45309" stroke-width="2.5"/>
						<circle cx="0" cy="10" r="3.5" fill="#0f172a"/>
						<rect x="-1.5" y="10" width="3" height="9" rx="1" fill="#0f172a"/>
					</g>
				</g>
			</svg>
		</div>

		<span class="code-tag"><span class="pulse"></span> Access Denied</span>
		<h1><?php echo htmlspecialchars($resolved_heading, ENT_QUOTES, 'UTF-8'); ?></h1>
		<div class="msg"><?php echo $resolved_message; ?></div>

		<span class="hint">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			You don't have permission to view this page.
		</span>
	</main>
</body>
</html>
