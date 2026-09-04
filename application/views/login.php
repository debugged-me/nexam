<?php
$page_styles = '
:root{--login-bg:#FDFCFA;--gold:#B8860B;--gold-light:#D4AF37;--text:#111827;--text-muted:#6B7280;--text-light:#9CA3AF;--border:rgba(184,134,11,0.18);--white:#FFFEFE;--input-bg:#FAFAF8;--error:#DC2626}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body.login-page{font-family:"Karla",sans-serif;background:var(--login-bg);color:var(--text);line-height:1.65;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
a{text-decoration:none;color:inherit}
.login-wrap{width:100%;max-width:780px;background:var(--white);border-radius:16px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;box-shadow:0 24px 80px rgba(0,0,0,.08);animation:cardIn .6s ease forwards;min-height:560px}
@keyframes cardIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.login-panel{background:linear-gradient(160deg,#1C1C2E 0%,#2D2B45 100%);color:var(--white);padding:3.5rem 2.5rem;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.login-panel::before{content:"";position:absolute;top:-40%;right:-30%;width:280px;height:280px;background:radial-gradient(circle,rgba(212,175,55,.15) 0%,transparent 70%);pointer-events:none}
.panel-crown{font-size:2.6rem;margin-bottom:1.2rem;opacity:.6}
.panel-title{font-family:"Karla",sans-serif;font-size:1.6rem;font-weight:600;line-height:1.25;margin-bottom:.4rem}
.panel-title em{font-style:italic;color:var(--gold-light);display:block;margin-top:.1rem}
.panel-tagline{font-size:.8rem;opacity:.7;line-height:1.6}
.panel-badge{font-size:.65rem;font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:var(--gold-light);opacity:.8;margin-bottom:.6rem}
.panel-footer{font-size:.68rem;opacity:.45;letter-spacing:.05em}
.login-form-wrap{padding:3.5rem;display:flex;flex-direction:column;justify-content:center}
.form-group{margin-bottom:1.4rem}
.form-label{display:block;font-size:.75rem;font-weight:500;color:var(--text);margin-bottom:.4rem}
.form-input{width:100%;padding:.9rem 1.1rem;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;font-family:"Karla",sans-serif;font-size:.9rem;color:var(--text);transition:.2s ease;outline:none}
.form-input:focus{border-color:var(--gold);background:var(--white);box-shadow:0 0 0 3px rgba(184,134,11,.08)}
.form-input::placeholder{color:var(--text-light)}
.password-wrap{position:relative}
.password-wrap .form-input{padding-right:2.6rem}
.password-toggle{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-light);cursor:pointer;font-size:1.1rem;padding:.25rem;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;transition:.2s ease}
.password-toggle:hover{color:var(--gold);background:rgba(184,134,11,.06)}
.btn-login{width:100%;padding:.95rem;background:linear-gradient(135deg,var(--gold-light),var(--gold));color:var(--white);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:none;border-radius:8px;cursor:pointer;transition:.3s ease;box-shadow:0 4px 16px rgba(184,134,11,.25);margin-top:.4rem;min-height:48px}
.btn-login:hover,.btn-login:active{transform:translateY(-1px);box-shadow:0 6px 24px rgba(184,134,11,.35)}
.btn-back{width:100%;padding:.95rem;background:transparent;color:var(--gold);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid var(--gold);border-radius:8px;cursor:pointer;transition:.3s ease;margin-top:.8rem;min-height:48px;display:inline-flex;align-items:center;justify-content:center}
.btn-back:hover,.btn-back:active{background:var(--gold);color:var(--white)}
.form-links{text-align:center;margin-top:1.5rem}
.form-links a{font-size:.82rem;color:var(--text-muted);transition:.2s ease}
.form-links a:hover{color:var(--gold)}
.error-msg{background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);border-radius:8px;padding:.6rem 1rem;font-size:.82rem;color:var(--error);margin-bottom:1rem;text-align:center}
@media(max-width:768px){body.login-page{padding:0;align-items:flex-start}.login-wrap{grid-template-columns:1fr;max-width:100%;border-radius:0;min-height:100vh;box-shadow:none}.login-panel{padding:1.2rem 1.5rem;min-height:auto;flex-direction:row;align-items:center;gap:.8rem;justify-content:flex-start}.panel-crown{font-size:1.8rem;margin-bottom:0}.panel-title{font-size:1.15rem;margin-bottom:0}.panel-title em{display:inline;margin-top:0;margin-left:.35rem}.panel-tagline{display:none}.panel-footer{display:none}.login-form-wrap{padding:2rem 1.5rem 2.5rem}.form-group{margin-bottom:1.1rem}.form-input{padding:1rem 1.1rem;border-radius:10px;font-size:1rem}.btn-login,.btn-back{padding:1rem;min-height:52px}}
@media(prefers-reduced-motion:reduce){.login-wrap{animation:none;opacity:1}}
';
include __DIR__ . '/includes/head.php';
?>

<body class="login-page">

    <div class="login-wrap">
        <div class="login-panel">
            <div class="panel-crown">&#9812;</div>
            <div>
                <div class="panel-badge">Portal</div>
                <div class="panel-title">Binibining Mati <em>2026</em></div>
                <p class="panel-tagline">Official digital score sheet system.</p>
            </div>
            <div class="panel-footer">Mati City, Davao Oriental</div>
        </div>

        <div class="login-form-wrap">
            <?php if ($this->session->flashdata('error')): ?>
                <div class="error-msg"><?= htmlspecialchars($this->session->flashdata('error')) ?></div>
            <?php endif; ?>

            <form action="<?= site_url("login/authenticate") ?>" method="post" autocomplete="off">
                <div class="form-group">
                    <label class="form-label" for="username">Judge ID</label>
                    <input type="text" id="username" name="username" class="form-input" placeholder="Enter your judge ID" required autofocus>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <div class="password-wrap">
                        <input type="password" id="password" name="password" class="form-input" placeholder="Enter your password" required>
                        <button type="button" class="password-toggle" id="togglePw" aria-label="Show password">
                            <svg id="eyeIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn-login">Log In</button>
                <a href="<?= site_url() ?>" class="btn-back">Back to Home</a>
            </form>

            <div class="form-links" style="display:flex;justify-content:space-between;align-items:center">
                <a href="<?= site_url("login/forgot") ?>">Forgot password?</a>
                <a href="<?= site_url("admin/login") ?>">Admin Portal</a>
            </div>
        </div>
    </div>

    <script>
        document.getElementById("togglePw").addEventListener("click", function() {
            var pw = document.getElementById("password");
            var icon = document.getElementById("eyeIcon");
            var eyeOpen = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            var eyeClosed = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            if (pw.type === "password") {
                pw.type = "text";
                icon.innerHTML = eyeClosed;
            } else {
                pw.type = "password";
                icon.innerHTML = eyeOpen;
            }
        });
    </script>

</body>

</html>