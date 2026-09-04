<head>
    <?php
    $appCssVersion = @filemtime(FCPATH . 'assets/css/app.min.css') ?: time();
    ?>
    <meta charset="utf-8" />
    <title><?= isset($page_title) ? htmlspecialchars($page_title) . ' &mdash; ' : '' ?>Binibining Mati 2026</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Binibining Mati 2026 e-Score Sheets" />
    <meta name="theme-color" content="#B8860B">
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <link rel="icon" type="image/svg+xml" href="<?= base_url(); ?>assets/images/favicon.svg">

    <!-- Plugins css-->
    <link href="<?= base_url(); ?>assets/libs/sweetalert2/sweetalert2.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/fullcalendar/fullcalendar.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/select2/select2.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/bootstrap-touchspin/jquery.bootstrap-touchspin.min.css" rel="stylesheet" type="text/css" />

    <!-- App css -->
    <link href="<?= base_url(); ?>assets/css/bootstrap.min.css" rel="stylesheet" type="text/css" id="bootstrap-stylesheet" />
    <link href="<?= base_url(); ?>assets/css/icons.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/css/app.min.css?v=<?= $appCssVersion; ?>" rel="stylesheet" type="text/css" id="app-stylesheet" />
    <!-- third party css -->
    <link href="<?= base_url(); ?>assets/libs/datatables/dataTables.bootstrap4.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/datatables/buttons.bootstrap4.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/datatables/responsive.bootstrap4.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= base_url(); ?>assets/libs/datatables/select.bootstrap4.min.css" rel="stylesheet" type="text/css" />

    <style>
        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Regular.ttf") format("truetype");
            font-weight: 400;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Italic.ttf") format("truetype");
            font-weight: 400;
            font-style: italic;
            font-display: swap;
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Medium.ttf") format("truetype");
            font-weight: 500;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-SemiBold.ttf") format("truetype");
            font-weight: 600;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Bold.ttf") format("truetype");
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }

        html,
        body,
        p,
        a,
        li,
        label,
        small,
        strong,
        em,
        td,
        th,
        button,
        input,
        select,
        textarea,
        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        .page-title,
        .card-title,
        .modal-title,
        .breadcrumb,
        .dropdown-menu,
        .nav-link,
        .dropdown-item,
        .btn,
        .form-control,
        .custom-select,
        .table,
        .dataTables_wrapper,
        .select2-container .select2-selection--single,
        .select2-container .select2-selection--multiple {
            font-family: "Karla", sans-serif !important;
        }
    </style>

    <!-- Global Notification System -->
    <style>
        :root {
            --srms-sidebar-width: 155px;
            --srms-toast-top: 86px;
            --srms-toast-min-width: 0px;
            --srms-toast-max-width: 340px;
            --srms-toast-radius: 14px;
            --srms-toast-shadow:
                0 18px 55px -24px rgba(15, 23, 42, 0.45),
                0 8px 22px -18px rgba(15, 23, 42, 0.35),
                0 0 0 1px rgba(15, 23, 42, 0.08);
        }

        #srms-toast-container {
            position: fixed;
            top: var(--srms-toast-top);
            left: var(--srms-sidebar-width);
            right: 0;
            z-index: 999999;

            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;

            pointer-events: none;
            font-family: "Karla", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            transform: none;
        }

        .srms-toast {
            pointer-events: auto;
            position: relative;
            overflow: hidden;

            width: auto;
            min-width: var(--srms-toast-min-width);
            max-width: var(--srms-toast-max-width);
            min-height: 0;

            display: grid;
            grid-template-columns: 34px minmax(0, auto) 26px;
            align-items: center;
            column-gap: 8px;

            padding: 10px 12px;

            background: rgba(255, 255, 255, 0.97) !important;
            border: 1px solid rgba(203, 213, 225, 0.95);
            border-radius: var(--srms-toast-radius);
            box-shadow: var(--srms-toast-shadow);

            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);

            opacity: 0;
            transform: translateY(-18px) scale(0.96);
            transition:
                opacity 0.32s ease,
                transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.25s ease;
        }

        .srms-toast.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .srms-toast.hide {
            opacity: 0;
            transform: translateY(-12px) scale(0.97);
        }

        .srms-toast:hover {
            box-shadow:
                0 22px 65px -26px rgba(15, 23, 42, 0.5),
                0 10px 28px -20px rgba(15, 23, 42, 0.35),
                0 0 0 1px rgba(15, 23, 42, 0.1);
        }

        .srms-toast::after {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
                linear-gradient(135deg,
                    rgba(255, 255, 255, 0.58) 0%,
                    rgba(255, 255, 255, 0.18) 38%,
                    rgba(255, 255, 255, 0) 72%);
            z-index: 1;
        }

        .srms-toast::before {
            content: '';
            position: absolute;
            left: 0;
            top: 10px;
            bottom: 10px;
            width: 3px;
            border-radius: 999px;
            z-index: 3;
        }

        .srms-toast-icon {
            position: relative;
            z-index: 4;

            width: 30px;
            height: 30px;
            border-radius: 10px;

            display: flex;
            align-items: center;
            justify-content: center;

            font-size: 16px;
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.75),
                0 8px 18px -12px rgba(15, 23, 42, 0.4);
        }

        .srms-toast-content {
            position: relative;
            z-index: 4;

            min-width: 0;
            text-align: left;
        }

        .srms-toast-title {
            margin: 0;

            font-size: 13px;
            font-weight: 700;
            line-height: 1.25;
            letter-spacing: 0;

            color: #111827;
            text-align: left;
            white-space: normal;
        }

        .srms-toast-message {
            margin-top: 2px;

            font-size: 12px;
            font-weight: 400;
            color: #6b7280;
            line-height: 1.35;

            text-align: left;
            word-break: break-word;
        }

        .srms-toast-close {
            position: relative;
            z-index: 4;

            width: 24px;
            height: 24px;
            padding: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            border: none;
            border-radius: 9px;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;

            font-size: 20px;
            font-weight: 300;
            line-height: 1;

            transition:
                background 0.18s ease,
                color 0.18s ease,
                transform 0.18s ease;
        }

        .srms-toast-close:hover {
            background: #f1f5f9;
            color: #334155;
        }

        .srms-toast-close:active {
            transform: scale(0.92);
        }

        .srms-toast.success::before {
            background: #22c55e;
        }

        .srms-toast.success .srms-toast-icon {
            background: linear-gradient(135deg, #dcfce7, #bbf7d0);
            color: #059669;
        }

        .srms-toast.success .srms-toast-title {
            color: #15803d;
        }

        .srms-toast.error::before {
            background: #ef4444;
        }

        .srms-toast.error .srms-toast-icon {
            background: linear-gradient(135deg, #fee2e2, #fecaca);
            color: #dc2626;
        }

        .srms-toast.error .srms-toast-title {
            color: #b91c1c;
        }

        .srms-toast.warning::before {
            background: #f59e0b;
        }

        .srms-toast.warning .srms-toast-icon {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            color: #d97706;
        }

        .srms-toast.warning .srms-toast-title {
            color: #b45309;
        }

        .srms-toast.info::before {
            background: #3b82f6;
        }

        .srms-toast.info .srms-toast-icon {
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: #2563eb;
        }

        .srms-toast.info .srms-toast-title {
            color: #1d4ed8;
        }

        .srms-toast-progress {
            position: absolute;
            left: 0;
            bottom: 0;
            height: 3px;
            width: 100%;
            transform-origin: left;
            animation: srmsToastProgress linear forwards;
            z-index: 5;
            opacity: 0.85;
        }

        .srms-toast.success .srms-toast-progress {
            background: #22c55e;
        }

        .srms-toast.error .srms-toast-progress {
            background: #ef4444;
        }

        .srms-toast.warning .srms-toast-progress {
            background: #f59e0b;
        }

        .srms-toast.info .srms-toast-progress {
            background: #3b82f6;
        }

        @keyframes srmsToastProgress {
            from {
                transform: scaleX(1);
            }

            to {
                transform: scaleX(0);
            }
        }

        @media (max-width: 768px) {
            :root {
                --srms-sidebar-width: 0px;
                --srms-toast-top: 74px;
                --srms-toast-min-width: 0px;
                --srms-toast-max-width: none;
            }

            #srms-toast-container {
                left: 14px;
                right: 14px;
                align-items: stretch;
            }

            .srms-toast {
                width: 100%;
                min-width: 0;
                max-width: none;
                min-height: 72px;
                grid-template-columns: 42px 1fr 30px;
                column-gap: 12px;
                padding: 13px 14px;
                border-radius: 14px;
            }

            .srms-toast-icon {
                width: 38px;
                height: 38px;
                border-radius: 12px;
                font-size: 18px;
            }

            .srms-toast-close {
                width: 28px;
                height: 28px;
                font-size: 23px;
            }

            .srms-toast-title {
                font-size: 14.5px;
            }

            .srms-toast-message {
                font-size: 12.5px;
            }
        }

        @media (prefers-reduced-motion: reduce) {

            .srms-toast,
            .srms-toast-close,
            .srms-toast-progress {
                transition: none !important;
                animation: none !important;
            }
        }
    </style>

    <!-- Toast Container (programmatic use only) -->
    <div id="srms-toast-container"></div>

    <!-- Notification API -->
    <script>
        (function() {
            'use strict';

            window.SrmsNotify = {
                container: null,
                defaultDuration: 5000,
                maxToasts: 5,

                init: function() {
                    this.container = document.getElementById('srms-toast-container');
                    if (!this.container) {
                        this.container = document.createElement('div');
                        this.container.id = 'srms-toast-container';
                        document.body.appendChild(this.container);
                    }
                },

                toast: function(options) {
                    if (!this.container) this.init();

                    var opts = Object.assign({
                        type: 'info',
                        title: '',
                        message: '',
                        duration: this.defaultDuration,
                        closable: true
                    }, options);

                    // Limit max toasts
                    while (this.container.children.length >= this.maxToasts) {
                        this.container.removeChild(this.container.firstChild);
                    }

                    var toast = document.createElement('div');
                    toast.className = 'srms-toast ' + opts.type;

                    var icons = {
                        success: '&#10003;',
                        error: '&#10007;',
                        warning: '&#9888;',
                        info: '&#8505;'
                    };
                    var titleHtml = opts.title ? '<div class="srms-toast-title">' + this.escapeHtml(opts.title) + '</div>' : '';
                    var messageHtml = opts.message ? '<div class="srms-toast-message">' + this.escapeHtml(opts.message) + '</div>' : '';
                    var closeHtml = opts.closable ? '<button class="srms-toast-close" aria-label="Close">&times;</button>' : '';
                    toast.innerHTML = '<div class="srms-toast-icon">' + icons[opts.type] + '</div><div class="srms-toast-content">' + titleHtml + messageHtml + '</div>' + closeHtml;

                    this.container.appendChild(toast);

                    // Trigger animation
                    requestAnimationFrame(function() {
                        toast.classList.add('show');
                    });

                    // Close handlers
                    if (opts.closable) {
                        var closeBtn = toast.querySelector('.srms-toast-close');
                        closeBtn.addEventListener('click', function() {
                            SrmsNotify.close(toast);
                        });
                    }

                    // Auto close
                    if (opts.duration > 0) {
                        setTimeout(function() {
                            SrmsNotify.close(toast);
                        }, opts.duration);
                    }

                    return toast;
                },

                close: function(toast) {
                    if (!toast || toast.classList.contains('hide')) return;

                    toast.classList.add('hide');
                    setTimeout(function() {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 500);
                },

                closeAll: function() {
                    if (!this.container) return;
                    var toasts = this.container.querySelectorAll('.srms-toast');
                    toasts.forEach(function(t) {
                        SrmsNotify.close(t);
                    });
                },

                escapeHtml: function(text) {
                    var div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
            };

            // Shorthand methods
            window.SrmsNotify.success = function(title, message, duration) {
                return window.SrmsNotify.toast({
                    type: 'success',
                    title: title,
                    message: message,
                    duration: duration || 5000
                });
            };

            window.SrmsNotify.error = function(title, message, duration) {
                return window.SrmsNotify.toast({
                    type: 'error',
                    title: title,
                    message: message,
                    duration: duration || 5000
                });
            };

            window.SrmsNotify.warning = function(title, message, duration) {
                return window.SrmsNotify.toast({
                    type: 'warning',
                    title: title,
                    message: message,
                    duration: duration || 5000
                });
            };

            window.SrmsNotify.info = function(title, message, duration) {
                return window.SrmsNotify.toast({
                    type: 'info',
                    title: title,
                    message: message,
                    duration: duration || 5000
                });
            };

            // Auto-init on DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    SrmsNotify.init();
                });
            } else {
                SrmsNotify.init();
            }
        })();
    </script>
    <?php if (!empty($page_styles)): ?>
        <style>
            <?= $page_styles ?>
        </style>
    <?php endif; ?>
</head>