<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Verify Email</title>
    <meta name="theme-color" content="#1B3A5B">
    <link href="<?php echo base_url('assets/css/fonts.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/auth.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/toast.css'); ?>" rel="stylesheet" type="text/css">
    <link href="<?php echo base_url('assets/css/modal.css'); ?>" rel="stylesheet" type="text/css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="auth-page">

    <div class="auth-wrap">
        <!-- Left brand panel -->
        <div class="auth-panel">
            <div class="panel-icon">
                <i data-lucide="shield-check"></i>
            </div>
            <div>
                <div class="panel-badge">Verification</div>
                <div class="panel-title">Verify <em>Your Email</em></div>
                <p class="panel-tagline">Enter the 6-digit code sent to your email.</p>
            </div>
            <div class="panel-footer">Table of Specifications</div>
        </div>

        <!-- Right form panel -->
        <div class="auth-form-wrap">
            <p style="font-size:13px;color:#64748b;margin-bottom:1.5rem;text-align:center">
                We sent a code to <strong><?php echo htmlspecialchars($email); ?></strong>
            </p>

            <form action="<?php echo site_url('verify/submit'); ?>" method="post" autocomplete="off">
                <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
                <div class="form-group">
                    <label class="form-label" for="code">Verification Code</label>
                    <div class="input-wrap">
                        <span class="input-icon"><i data-lucide="key-round"></i></span>
                        <input type="text" id="code" name="code" class="form-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autofocus style="text-align:center;letter-spacing:4px;font-size:1.2rem">
                    </div>
                </div>

                <button type="submit" class="btn-login">Verify</button>
                <a href="<?php echo site_url('verify/resend'); ?>" class="btn-register">
                    <i data-lucide="refresh-cw"></i>
                    Resend Code
                </a>
            </form>

            <div class="form-links">
                <a href="<?php echo site_url('login'); ?>">Back to Login</a>
            </div>
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
