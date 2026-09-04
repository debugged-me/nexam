<?php
$page_title = 'Forgot Password';
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
.form-header{margin-bottom:2rem}
.form-header h2{font-family:"Karla",sans-serif;font-size:1.3rem;font-weight:600;color:var(--text);margin-bottom:.3rem}
.form-header p{font-size:.85rem;color:var(--text-muted)}
.form-group{margin-bottom:1.4rem}
.form-label{display:block;font-size:.75rem;font-weight:500;color:var(--text);margin-bottom:.4rem}
.form-input{width:100%;padding:.9rem 1.1rem;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;font-family:"Karla",sans-serif;font-size:.9rem;color:var(--text);transition:.2s ease;outline:none}
.form-input:focus{border-color:var(--gold);background:var(--white);box-shadow:0 0 0 3px rgba(184,134,11,.08)}
.form-input::placeholder{color:var(--text-light)}
.btn-login{width:100%;padding:.95rem;background:linear-gradient(135deg,var(--gold-light),var(--gold));color:var(--white);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:none;border-radius:8px;cursor:pointer;transition:.3s ease;box-shadow:0 4px 16px rgba(184,134,11,.25);margin-top:.4rem;min-height:48px}
.btn-login:hover,.btn-login:active{transform:translateY(-1px);box-shadow:0 6px 24px rgba(184,134,11,.35)}
.btn-back{width:100%;padding:.95rem;background:transparent;color:var(--gold);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid var(--gold);border-radius:8px;cursor:pointer;transition:.3s ease;margin-top:.8rem;min-height:48px;display:inline-flex;align-items:center;justify-content:center}
.btn-back:hover,.btn-back:active{background:var(--gold);color:var(--white)}
.form-links{text-align:center;margin-top:1.5rem}
.form-links a{font-size:.82rem;color:var(--text-muted);transition:.2s ease}
.form-links a:hover{color:var(--gold)}
.error-msg{background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);border-radius:8px;padding:.7rem 1rem;font-size:.82rem;color:var(--error);margin-bottom:1.4rem;text-align:center}
.success-msg{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:8px;padding:.7rem 1rem;font-size:.82rem;color:#15803d;margin-bottom:1.4rem;text-align:center}
@media(max-width:768px){body.login-page{padding:0;align-items:flex-start}.login-wrap{grid-template-columns:1fr;max-width:100%;border-radius:0;min-height:100vh;box-shadow:none}.login-panel{padding:1.2rem 1.5rem;min-height:auto;flex-direction:row;align-items:center;gap:.8rem;justify-content:flex-start}.panel-crown{font-size:1.8rem;margin-bottom:0}.panel-title{font-size:1.15rem;margin-bottom:0}.panel-title em{display:inline;margin-top:0;margin-left:.35rem}.panel-tagline{display:none}.panel-footer{display:none}.login-form-wrap{padding:2rem 1.5rem 2.5rem}.form-header{margin-bottom:1.5rem}.form-group{margin-bottom:1.1rem}.form-input{padding:1rem 1.1rem;border-radius:10px;font-size:1rem}.btn-login,.btn-back{padding:1rem;min-height:52px}}
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
            <div class="form-header">
                <h2>Reset Password</h2>
                <p>Enter your Judge ID to generate a temporary password.</p>
            </div>

            <?php if ($this->session->flashdata('error')): ?>
                <div class="error-msg"><?= htmlspecialchars($this->session->flashdata('error')) ?></div>
            <?php endif; ?>

            <?php if ($this->session->flashdata('success')): ?>
                <div class="success-msg"><?= htmlspecialchars($this->session->flashdata('success')) ?></div>
            <?php endif; ?>

            <form action="<?= site_url('login/reset_password') ?>" method="post" autocomplete="off">
                <div class="form-group">
                    <label class="form-label" for="judge_id">Judge ID</label>
                    <input type="text" id="judge_id" name="judge_id" class="form-input" placeholder="Enter your Judge ID" required autofocus>
                </div>

                <button type="submit" class="btn-login">Generate Temporary Password</button>
                <a href="<?= site_url('login/login_page') ?>" class="btn-back">Back to Login</a>
            </form>
        </div>
    </div>

</body>

</html>