<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Register</title>
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
<body class="auth-page auth-page-register">
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <main class="auth-wrap" id="main-content" tabindex="-1">
        <!-- Left brand panel -->
        <div class="auth-panel">
            <div class="panel-badge">Get Started</div>
            <div class="panel-title">Create your <em>nexam account</em></div>
            <p class="panel-tagline">Set up a workspace for your subjects, blueprints and exams.</p>

            <div class="panel-footer">
                <div class="panel-icon">
                    <i data-lucide="user-plus"></i>
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
                <h1 class="gradient-text">Create your account</h1>
                <p>It only takes a minute to get started.</p>
            </div>

            <form action="<?php echo site_url('register/submit'); ?>" method="post">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <?php if (!empty($form_errors)): ?>
                    <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review your details.</strong><span><?php echo htmlspecialchars($form_errors, ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                <?php endif; ?>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="first_name">First Name <span class="req">*</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="first_name" name="first_name" class="form-input" placeholder="Juan" value="<?php echo htmlspecialchars(set_value('first_name'), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="given-name" maxlength="100" required autofocus>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="middle_name">Middle Name <span class="field-optional">(opt.)</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="middle_name" name="middle_name" class="form-input" placeholder="Reyes" value="<?php echo htmlspecialchars(set_value('middle_name'), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="additional-name" maxlength="100">
                        </div>
                    </div>
                </div>

                <div class="form-row form-row-ext">
                    <div class="form-group">
                        <label class="form-label" for="last_name">Last Name <span class="req">*</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="last_name" name="last_name" class="form-input" placeholder="Dela Cruz" value="<?php echo htmlspecialchars(set_value('last_name'), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="family-name" maxlength="100" required>
                        </div>
                    </div>

                    <div class="form-group form-group-ext">
                        <label class="form-label" for="name_ext">Extension</label>
                        <div class="input-wrap input-wrap-select">
                            <select id="name_ext" name="name_ext" class="form-input form-select" autocomplete="honorific-suffix">
                                <option value="">None</option>
                                <?php foreach (['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V'] as $ext): ?>
                                    <option value="<?php echo $ext; ?>" <?php echo set_select('name_ext', $ext); ?>><?php echo $ext; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="email">E-mail Address <span class="req">*</span></label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="mail"></i></span>
                        <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com" value="<?php echo htmlspecialchars(set_value('email'), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="email" maxlength="255" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password <span class="req">*</span></label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="At least 8 characters" autocomplete="new-password" minlength="8" maxlength="128" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirm_password">Confirm Password <span class="req">*</span></label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="confirm_password" name="confirm_password" class="form-input" placeholder="Re-enter your password" autocomplete="new-password" minlength="8" maxlength="128" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <div class="btn-row-stacked">
                    <button type="submit" class="btn-login">
                        <span class="btn-spinner"></span>
                        <span class="btn-label">Create Account</span>
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
