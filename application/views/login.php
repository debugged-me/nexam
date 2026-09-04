<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Login</title>
    <meta name="theme-color" content="#1B3A5B">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="<?php echo base_url('assets/css/auth.css'); ?>" rel="stylesheet" type="text/css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="auth-page">

    <div class="auth-wrap">
        <!-- Left brand panel -->
        <div class="auth-panel">
            <div class="panel-icon">
                <i data-lucide="graduation-cap"></i>
            </div>
            <div>
                <div class="panel-badge">Portal</div>
                <div class="panel-title">nexam <em>Exam Builder</em></div>
                <p class="panel-tagline">TOS-aligned examination builder for educators.</p>
            </div>
            <div class="panel-footer">Table of Specifications</div>
        </div>

        <!-- Right form panel -->
        <div class="auth-form-wrap">
            <?php if ($this->session->flashdata('error')): ?>
                <div class="error-msg">
                    <i data-lucide="alert-circle"></i>
                    <?php echo htmlspecialchars($this->session->flashdata('error')); ?>
                </div>
            <?php endif; ?>

            <form action="<?php echo site_url('login/authenticate'); ?>" method="post" autocomplete="off">
                <div class="form-group">
                    <label class="form-label" for="email">E-mail Address</label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="mail"></i></span>
                        <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com" required autofocus>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="Enter your password" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn-login">Log In</button>
                <a href="#" class="btn-register">
                    <i data-lucide="user-plus"></i>
                    Register
                </a>
            </form>

            <div class="form-links">
                <a href="#">Forgot password?</a>
            </div>
        </div>
    </div>

    <script src="<?php echo base_url('assets/js/auth.js'); ?>"></script>
</body>
</html>
