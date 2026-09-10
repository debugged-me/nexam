<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Forgot Password</title>
    <meta name="theme-color" content="#F8FAFC">
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo nexam_asset('assets/images/favicon-32.png'); ?>">
    <link rel="preload" href="<?php echo nexam_asset('assets/fonts/Google_Sans/static/GoogleSans-Regular.subset.ttf'); ?>" as="font" type="font/ttf" crossorigin>
    <link rel="preload" href="<?php echo nexam_asset('assets/fonts/Inter/static/Inter_18pt-Regular.subset.ttf'); ?>" as="font" type="font/ttf" crossorigin>
    <link href="<?php echo nexam_asset('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo nexam_asset('assets/css/auth.css'); ?>" rel="stylesheet" type="text/css">
    <script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body class="auth-page">
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <main class="auth-wrap" id="main-content" tabindex="-1">
        <!-- Left brand panel -->
        <div class="auth-panel">
            <div class="panel-badge">Account Recovery</div>
            <div class="panel-title">Forgot your <em>password?</em></div>
            <p class="panel-tagline">We will email you a one-time code so you can set a new password.</p>

            <div class="panel-footer">
                <div class="panel-icon">
                    <i data-lucide="key-round"></i>
                </div>
                <div class="panel-org">
                    nexam
                    <small>TOS-aligned examination builder</small>
                </div>
            </div>
        </div>

        <!-- Right form panel -->
        <div class="auth-form-wrap">
            <div class="auth-heading">
                <span class="auth-logo">
                    <span class="logo-mark"><i data-lucide="graduation-cap"></i></span>
                    <span>nexam</span>
                </span>
                <h1 class="gradient-text">Forgot password?</h1>
                <p>Enter your email and we will send a reset code.</p>
            </div>

            <form action="<?php echo site_url('forgot/submit'); ?>" method="post">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <div class="form-group">
                    <label class="form-label" for="email">E-mail Address <span class="req">*</span></label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="mail"></i></span>
                        <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com" value="<?php echo htmlspecialchars((string) $this->session->flashdata('old_email'), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="email" maxlength="255" required autofocus>
                    </div>
                </div>

                <div class="btn-row-stacked">
                    <button type="submit" class="btn-login">
                        <span class="btn-spinner"></span>
                        <span class="btn-label">Send Reset Code</span>
                    </button>
                    <a href="<?php echo site_url('login'); ?>" class="btn-register">
                        <i data-lucide="arrow-left"></i>
                        Back to Login
                    </a>
                </div>
            </form>
        </div>
    </main>

    <script src="<?php echo nexam_asset('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo nexam_asset('assets/js/modal.js'); ?>"></script>
    <script src="<?php echo nexam_asset('assets/js/auth.js'); ?>"></script>
    <?php $toast = $this->session->flashdata('toast'); ?>
    <?php if ($toast): ?>
        <div id="nexam-flash-toast" hidden data-message="<?php echo htmlspecialchars($toast['message'], ENT_QUOTES, 'UTF-8'); ?>" data-type="<?php echo htmlspecialchars($toast['type'], ENT_QUOTES, 'UTF-8'); ?>"></div>
    <?php endif; ?>

</body>
</html>
