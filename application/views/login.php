<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Login</title>
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

    <main class="auth-wrap">
        <!-- Left brand panel -->
        <div class="auth-panel">
            <div class="panel-badge">Instructor Workspace</div>
            <div class="panel-title">Exam Builder <em>for educators</em></div>
            <p class="panel-tagline">Build Table-of-Specification aligned examinations from your own question bank.</p>

            <div class="panel-footer">
                <div class="panel-icon">
                    <i data-lucide="graduation-cap"></i>
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
                <h1 class="gradient-text">Welcome back</h1>
                <p>Sign in to continue to your exam builder.</p>
            </div>

            <form action="<?php echo site_url('login/authenticate'); ?>" method="post">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <div class="form-group">
                    <label class="form-label" for="email">E-mail Address <span class="req">*</span></label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="mail"></i></span>
                        <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com"
                               value="<?php echo htmlspecialchars((string) $this->session->flashdata('old_email'), ENT_QUOTES, 'UTF-8'); ?>"
                               autocomplete="email" maxlength="255" required autofocus>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password <span class="req">*</span></label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="Enter your password" autocomplete="current-password" maxlength="128" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn-login">
                    <span class="btn-spinner"></span>
                    <span class="btn-label">Log In</span>
                </button>
                <a href="<?php echo site_url('register'); ?>" class="btn-register">
                    <i data-lucide="user-plus"></i>
                    Register
                </a>
            </form>

            <div class="form-links">
                <a href="<?php echo site_url('forgot'); ?>">Forgot password?</a>
            </div>
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
