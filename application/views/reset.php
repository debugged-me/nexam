<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Reset Password</title>
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
            <div class="panel-title">Set a new <em>password</em></div>
            <p class="panel-tagline">Enter the code we emailed you, then choose a new password.</p>

            <div class="panel-footer">
                <div class="panel-icon">
                    <i data-lucide="lock-keyhole"></i>
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
                <h1 class="gradient-text">Set a new password</h1>
                <p>Enter the code we emailed you.</p>
            </div>

            <p class="verify-email-line">
                A reset code was sent to <strong><?php echo htmlspecialchars($email); ?></strong>
            </p>

            <form action="<?php echo site_url('reset/submit'); ?>" method="post">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <?php if (!empty($form_errors)): ?>
                    <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review the form.</strong><span><?php echo htmlspecialchars($form_errors, ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                <?php endif; ?>
                <div class="form-group">
                    <label class="form-label" for="code">Verification Code</label>
                    <div class="input-wrap">
                        <input type="text" id="code" name="code" class="form-input code-input" placeholder="000000" value="<?php echo htmlspecialchars(set_value('code'), ENT_QUOTES, 'UTF-8'); ?>" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required autofocus>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">New Password</label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="At least 8 characters" autocomplete="new-password" minlength="8" maxlength="128" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirm_password">Confirm Password</label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="confirm_password" name="confirm_password" class="form-input" placeholder="Re-enter new password" autocomplete="new-password" minlength="8" maxlength="128" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <div class="btn-row-stacked">
                    <button type="submit" class="btn-login">
                        <span class="btn-spinner"></span>
                        <span class="btn-label">Reset Password</span>
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
