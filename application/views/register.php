<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Register</title>
    <meta name="theme-color" content="#1A2942">
    <link href="<?php echo base_url('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/auth.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="auth-page auth-page-register">

    <div class="auth-wrap">
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

            <form action="<?php echo site_url('register/submit'); ?>" method="post" autocomplete="off">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="first_name">First Name <span class="req">*</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="first_name" name="first_name" class="form-input" placeholder="Juan" required autofocus>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="middle_name">Middle Name <span class="field-optional">(opt.)</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="middle_name" name="middle_name" class="form-input" placeholder="Reyes">
                        </div>
                    </div>
                </div>

                <div class="form-row form-row-ext">
                    <div class="form-group">
                        <label class="form-label" for="last_name">Last Name <span class="req">*</span></label>
                        <div class="input-wrap">
                            <span class="input-icon"><i data-lucide="user"></i></span>
                            <input type="text" id="last_name" name="last_name" class="form-input" placeholder="Dela Cruz" required>
                        </div>
                    </div>

                    <div class="form-group form-group-ext">
                        <label class="form-label" for="name_ext">Extension</label>
                        <div class="input-wrap input-wrap-select">
                            <select id="name_ext" name="name_ext" class="form-input form-select">
                                <option value="">None</option>
                                <option value="Jr.">Jr.</option>
                                <option value="Sr.">Sr.</option>
                                <option value="I">I</option>
                                <option value="II">II</option>
                                <option value="III">III</option>
                                <option value="IV">IV</option>
                                <option value="V">V</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="email">E-mail Address <span class="req">*</span></label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="mail"></i></span>
                        <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password <span class="req">*</span></label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="At least 8 characters" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirm_password">Confirm Password <span class="req">*</span></label>
                    <div class="input-wrap password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="confirm_password" name="confirm_password" class="form-input" placeholder="Re-enter your password" required>
                        <button type="button" class="password-toggle" aria-label="Show password">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn-login">
                    <span class="btn-spinner"></span>
                    <span class="btn-label">Create Account</span>
                </button>
                <a href="<?php echo site_url('login'); ?>" class="btn-register">
                    <i data-lucide="arrow-left"></i>
                    Back to Login
                </a>
            </form>
        </div>
    </div>

    <script src="<?php echo base_url('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo base_url('assets/js/modal.js'); ?>"></script>
    <script src="<?php echo base_url('assets/js/auth.js'); ?>"></script>
    <?php $toast = $this->session->flashdata('toast'); ?>
    <?php if ($toast): ?>
    <script>
        document.addEventListener("DOMContentLoaded", function () {
            NexamToast.show("", <?php echo json_encode($toast['message']); ?>, <?php echo json_encode($toast['type']); ?>, 5000);
        });
    </script>
    <?php endif; ?>

</body>
</html>
