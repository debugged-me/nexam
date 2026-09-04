<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo htmlspecialchars($heading, ENT_QUOTES, 'UTF-8'); ?></title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after { box-sizing: border-box; }
html,body { height: 100%; }
body {
	margin: 0;
	font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	color: #0f172a;
	background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #ecfeff 100%);
	min-height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 32px 20px;
	overflow: hidden;
	position: relative;
	-webkit-font-smoothing: antialiased;
}

/* twinkling background dots */
.sky { position: absolute; inset: 0; pointer-events: none; }
.sky span {
	position: absolute;
	width: 6px; height: 6px;
	background: #93c5fd;
	border-radius: 50%;
	opacity: .4;
	animation: twinkle 3.4s ease-in-out infinite;
}
.sky span:nth-child(1){ top: 12%; left: 8%;  background:#60a5fa; animation-delay:.0s; }
.sky span:nth-child(2){ top: 22%; left: 88%; background:#a78bfa; animation-delay:.6s; width:8px; height:8px; }
.sky span:nth-child(3){ top: 68%; left: 6%;  background:#f472b6; animation-delay:1.2s; }
.sky span:nth-child(4){ top: 80%; left: 84%; background:#34d399; animation-delay:.4s; width:10px; height:10px; }
.sky span:nth-child(5){ top: 38%; left: 14%; background:#fbbf24; animation-delay:1.8s; width:5px; height:5px; }
.sky span:nth-child(6){ top: 54%; left: 92%; background:#60a5fa; animation-delay:.9s; }
.sky span:nth-child(7){ top: 8%;  left: 52%; background:#a78bfa; animation-delay:1.5s; width:4px; height:4px; }
.sky span:nth-child(8){ top: 90%; left: 48%; background:#34d399; animation-delay:2.1s; width:5px; height:5px; }

@keyframes twinkle {
	0%,100% { opacity:.25; transform: scale(.85); }
	50%     { opacity: 1;  transform: scale(1.15); }
}

.wrap {
	position: relative;
	width: 100%;
	max-width: 560px;
	text-align: center;
	z-index: 1;
}

/* mascot */
.mascot-stage {
	position: relative;
	width: 260px;
	height: 280px;
	margin: 0 auto 8px;
}
.mascot {
	width: 100%;
	height: 100%;
	animation: float 4s ease-in-out infinite;
	transform-origin: center bottom;
}
.shadow {
	animation: shadowPulse 4s ease-in-out infinite;
	transform-origin: center;
	transform-box: fill-box;
}
.eyes ellipse { transform-origin: center; transform-box: fill-box; }
.eyes { animation: blink 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

.q { animation: drift 4.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.q1 { animation-delay:  .0s; }
.q2 { animation-delay:  .9s; }
.q3 { animation-delay: 1.6s; }

@keyframes float {
	0%,100% { transform: translateY(0); }
	50%     { transform: translateY(-14px); }
}
@keyframes shadowPulse {
	0%,100% { transform: scale(1);   opacity: .18; }
	50%     { transform: scale(.82); opacity: .10; }
}
@keyframes blink {
	0%, 92%, 100% { transform: scaleY(1); }
	95%, 97%      { transform: scaleY(.1); }
}
@keyframes drift {
	0%,100% { transform: translateY(0)    rotate(-6deg); opacity:.85; }
	50%     { transform: translateY(-10px) rotate(6deg);  opacity:1;   }
}

/* content */
.code-tag {
	display: inline-flex; align-items: center; gap: 8px;
	padding: 6px 14px;
	font-size: 12px; font-weight: 600;
	letter-spacing: .12em; text-transform: uppercase;
	color: #1d4ed8;
	background: #dbeafe;
	border: 1px solid #bfdbfe;
	border-radius: 999px;
	margin-bottom: 14px;
}
.code-tag .pulse {
	width: 8px; height: 8px; border-radius: 50%;
	background: #3b82f6;
	box-shadow: 0 0 0 0 rgba(59,130,246,.6);
	animation: ping 1.6s ease-out infinite;
}
@keyframes ping {
	0%   { box-shadow: 0 0 0 0   rgba(59,130,246,.55); }
	70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
	100% { box-shadow: 0 0 0 0   rgba(59,130,246,0); }
}

h1 {
	font-size: clamp(24px, 3.4vw, 32px);
	font-weight: 800;
	margin: 0 0 10px;
	letter-spacing: -.02em;
	color: #0f172a;
}
.msg {
	font-size: 15px;
	line-height: 1.65;
	color: #475569;
	margin: 0 auto;
	max-width: 420px;
}
.msg :is(p,a) { margin: 0; }
.msg a { color: #2563eb; text-decoration: none; font-weight: 600; }
.msg a:hover { text-decoration: underline; }

@media (max-width: 480px) {
	.mascot-stage { width: 220px; height: 240px; }
}
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
				<!-- shadow -->
				<ellipse class="shadow" cx="130" cy="262" rx="68" ry="9" fill="#0f172a"/>

				<!-- floating question marks -->
				<text class="q q1" x="28"  y="78"  font-family="Inter, sans-serif" font-size="44" font-weight="900" fill="#3b82f6">?</text>
				<text class="q q2" x="220" y="60"  font-family="Inter, sans-serif" font-size="30" font-weight="900" fill="#a78bfa">?</text>
				<text class="q q3" x="210" y="120" font-family="Inter, sans-serif" font-size="22" font-weight="900" fill="#60a5fa">?</text>

				<!-- body (blob) -->
				<g>
					<circle cx="130" cy="170" r="78" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>

					<!-- graduation cap -->
					<g>
						<rect x="118" y="92"  width="24" height="8" rx="2" fill="#0f172a"/>
						<polygon points="70,88 130,62 190,88 130,100" fill="#0f172a"/>
						<polygon points="70,88 130,62 190,88 130,100" fill="url(#capShine)" opacity=".25"/>
						<!-- tassel -->
						<path d="M188 92 C 196 100, 198 112, 196 120" stroke="#fbbf24" stroke-width="3" fill="none" stroke-linecap="round"/>
						<circle cx="196" cy="124" r="4" fill="#fbbf24"/>
					</g>

					<!-- blush -->
					<circle cx="86"  cy="190" r="7" fill="#fecaca" opacity=".75"/>
					<circle cx="174" cy="190" r="7" fill="#fecaca" opacity=".75"/>

					<!-- eyes -->
					<g class="eyes">
						<ellipse cx="105" cy="165" rx="7" ry="11" fill="#0f172a"/>
						<ellipse cx="155" cy="165" rx="7" ry="11" fill="#0f172a"/>
						<circle  cx="107" cy="161" r="2.2" fill="#ffffff"/>
						<circle  cx="157" cy="161" r="2.2" fill="#ffffff"/>
					</g>

					<!-- mouth (small oh — confused) -->
					<ellipse cx="130" cy="205" rx="6" ry="8" fill="#0f172a"/>
				</g>

				<defs>
					<linearGradient id="capShine" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0"   stop-color="#ffffff"/>
						<stop offset="1"   stop-color="#ffffff" stop-opacity="0"/>
					</linearGradient>
				</defs>
			</svg>
		</div>

		<span class="code-tag"><span class="pulse"></span> Error 404</span>
		<h1><?php echo htmlspecialchars($heading, ENT_QUOTES, 'UTF-8'); ?></h1>
		<div class="msg"><?php echo $message; ?></div>
	</main>
</body>
</html>
