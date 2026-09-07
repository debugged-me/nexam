<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<link rel="stylesheet" href="<?php echo function_exists('base_url') ? base_url('assets/css/debug-error.css') : '/nexam/assets/css/debug-error.css'; ?>">
<div class="ci-err">
	<span class="ci-err__title">Exception</span>
	<h4>An uncaught Exception was encountered</h4>

	<p><b>Type:</b> <span class="mono"><?php echo htmlspecialchars(get_class($exception), ENT_QUOTES, 'UTF-8'); ?></span></p>
	<p><b>Message:</b> <span class="mono"><?php echo htmlspecialchars((string) $message, ENT_QUOTES, 'UTF-8'); ?></span></p>
	<p><b>Filename:</b> <span class="mono"><?php echo htmlspecialchars($exception->getFile(), ENT_QUOTES, 'UTF-8'); ?></span></p>
	<p><b>Line Number:</b> <span class="mono"><?php echo htmlspecialchars((string) $exception->getLine(), ENT_QUOTES, 'UTF-8'); ?></span></p>

	<?php if (defined('SHOW_DEBUG_BACKTRACE') && SHOW_DEBUG_BACKTRACE === TRUE): ?>
		<p class="ci-trace-title"><b>Backtrace:</b></p>
		<?php foreach ($exception->getTrace() as $error): ?>
			<?php if (isset($error['file']) && strpos($error['file'], realpath(BASEPATH)) !== 0): ?>
				<div class="ci-trace">
					<p><b>File:</b> <span class="mono"><?php echo htmlspecialchars((string) $error['file'], ENT_QUOTES, 'UTF-8'); ?></span></p>
					<p><b>Line:</b> <span class="mono"><?php echo htmlspecialchars((string) $error['line'], ENT_QUOTES, 'UTF-8'); ?></span></p>
					<p><b>Function:</b> <span class="mono"><?php echo htmlspecialchars((string) $error['function'], ENT_QUOTES, 'UTF-8'); ?></span></p>
				</div>
			<?php endif ?>
		<?php endforeach ?>
	<?php endif ?>
</div>
