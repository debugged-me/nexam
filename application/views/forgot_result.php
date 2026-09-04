<?php
$page_title = 'Temporary Password';
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
.result-box{text-align:center}
.result-box h2{font-family:"Karla",sans-serif;font-size:1.4rem;font-weight:600;color:var(--text);margin-bottom:.5rem}
.result-box p{font-size:.9rem;color:var(--text-muted);margin-bottom:2rem}
.temp-password-box{background:var(--input-bg);border:2px dashed var(--gold);border-radius:12px;padding:1.5rem 2rem;margin-bottom:2rem}
.temp-password-box label{display:block;font-size:.7rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem}
.temp-password-box .password{font-family:"Karla",sans-serif;font-size:1.8rem;font-weight:700;color:var(--text);letter-spacing:.05em}
.temp-password-box .hint{font-size:.75rem;color:var(--text-muted);margin-top:.5rem}
.btn-login{width:100%;padding:.95rem;background:linear-gradient(135deg,var(--gold-light),var(--gold));color:var(--white);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:none;border-radius:8px;cursor:pointer;transition:.3s ease;box-shadow:0 4px 16px rgba(184,134,11,.25);min-height:48px}
.btn-login:hover,.btn-login:active{transform:translateY(-1px);box-shadow:0 6px 24px rgba(184,134,11,.35)}
.btn-back{width:100%;padding:.95rem;background:transparent;color:var(--gold);font-family:"Karla",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid var(--gold);border-radius:8px;cursor:pointer;transition:.3s ease;margin-top:.8rem;min-height:48px;display:inline-flex;align-items:center;justify-content:center}
.btn-back:hover,.btn-back:active{background:var(--gold);color:var(--white)}
@media(max-width:768px){body.login-page{padding:0;align-items:flex-start}.login-wrap{grid-template-columns:1fr;max-width:100%;border-radius:0;min-height:100vh;box-shadow:none}.login-panel{padding:1.2rem 1.5rem;min-height:auto;flex-direction:row;align-items:center;gap:.8rem;justify-content:flex-start}.panel-crown{font-size:1.8rem;margin-bottom:0}.panel-title{font-size:1.15rem;margin-bottom:0}.panel-title em{display:inline;margin-top:0;margin-left:.35rem}.panel-tagline{display:none}.panel-footer{display:none}.login-form-wrap{padding:2rem 1.5rem 2.5rem}.result-box h2{font-size:1.2rem}.temp-password-box{padding:1.2rem 1.5rem}.temp-password-box .password{font-size:1.5rem}.btn-login,.btn-back{padding:1rem;min-height:52px}}
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
            <div class="result-box">
                <h2>Password Reset</h2>
                <p>Your temporary password has been generated.</p>

                <div class="temp-password-box">
                    <label>Temporary Password</label>
                    <div class="password"><?= htmlspecialchars($this->session->flashdata('temp_password') ?: '---') ?></div>
                    <div class="hint">Use this password to log in. You will be asked to change it.</div>
                </div>

                <a href="<?= site_url('login/login_page') ?>" class="btn-login" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;">Go to Login</a>
                <a href="<?= site_url('login/forgot') ?>" class="btn-back">Back to Reset</a>
            </div>
        </div>
    </div>

</body>

</html>