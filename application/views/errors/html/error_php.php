<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<style>
.ci-err {
	font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	background: #ffffff;
	border: 1px solid #fecaca;
	border-left: 4px solid #ef4444;
	border-radius: 12px;
	padding: 18px 22px;
	margin: 16px 0;
	color: #0f172a;
	box-shadow: 0 6px 20px -12px rgba(15,23,42,0.15);
	font-size: 14px;
	line-height: 1.55;
}
.ci-err__title {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #b91c1c;
	background: #fef2f2;
	border: 1px solid #fee2e2;
	border-radius: 999px;
	padding: 4px 10px;
	margin-bottom: 12px;
}
.ci-err h4 {
	margin: 0 0 12px;
	font-size: 17px;
	font-weight: 700;
	color: #0f172a;
}
.ci-err p { margin: 4px 0; color: #334155; }
.ci-err b { color: #0f172a; font-weight: 600; }
.ci-err .ci-trace { margin-top: 10px; padding-left: 14px; border-left: 2px solid #e2e8f0; }
.ci-err code, .ci-err .mono {
	font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
	font-size: 13px;
	color: #1e293b;
}
</style>
<div class="ci-err">
	<span class="ci-err__title">PHP Error</span>
	<h4>A PHP Error was encountered</h4>

	<p><b>Severity:</b> <span class="mono"><?php echo $severity; ?></span></p>
	<p><b>Message:</b> <span class="mono"><?php echo $message; ?></span></p>
	<p><b>Filename:</b> <span class="mono"><?php echo $filepath; ?></span></p>
	<p><b>Line Number:</b> <span class="mono"><?php echo $line; ?></span></p>

	<?php if (defined('SHOW_DEBUG_BACKTRACE') && SHOW_DEBUG_BACKTRACE === TRUE): ?>
		<p style="margin-top:14px;"><b>Backtrace:</b></p>
		<?php foreach (debug_backtrace() as $error): ?>
			<?php if (isset($error['file']) && strpos($error['file'], realpath(BASEPATH)) !== 0): ?>
				<div class="ci-trace">
					<p><b>File:</b> <span class="mono"><?php echo $error['file']; ?></span></p>
					<p><b>Line:</b> <span class="mono"><?php echo $error['line']; ?></span></p>
					<p><b>Function:</b> <span class="mono"><?php echo $error['function']; ?></span></p>
				</div>
			<?php endif ?>
		<?php endforeach ?>
	<?php endif ?>
</div>
