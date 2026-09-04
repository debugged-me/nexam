<?php
$page_styles = '
:root{
    --login-bg:#F4F6FA;
    --navy:#1B3A5B;
    --navy-light:#2C5478;
    --blue:#3E6B96;
    --blue-soft:#6B95B8;
    --accent:#5B8BB5;
    --text:#1E293B;
    --text-muted:#64748B;
    --text-light:#94A3B8;
    --border:rgba(27,58,91,0.16);
    --white:#FFFFFF;
    --input-bg:#F8FAFC;
    --error:#DC2626
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body.login-page{
    font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:var(--login-bg);
    color:var(--text);
    line-height:1.65;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:1rem
}
a{text-decoration:none;color:inherit}
.login-wrap{
    width:100%;
    max-width:780px;
    background:var(--white);
    border-radius:16px;
    overflow:hidden;
    display:grid;
    grid-template-columns:1fr 1fr;
    box-shadow:0 24px 80px rgba(0,0,0,.08);
    animation:cardIn .6s ease forwards;
    min-height:560px
}
@keyframes cardIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

/* ---- Left brand panel ---- */
.login-panel{
    background:linear-gradient(160deg,#1B3A5B 0%,#2C5478 100%);
    color:var(--white);
    padding:3.5rem 2.5rem;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    position:relative;
    overflow:hidden
}
.login-panel::before{
    content:"";
    position:absolute;
    top:-40%;right:-30%;
    width:280px;height:280px;
    background:radial-gradient(circle,rgba(107,149,184,.18) 0%,transparent 70%);
    pointer-events:none
}
.panel-icon{margin-bottom:1.2rem;opacity:.55;display:flex;align-items:center}
.panel-icon svg{width:42px;height:42px;display:block}
.panel-badge{
    font-size:.65rem;font-weight:500;letter-spacing:.25em;
    text-transform:uppercase;color:var(--blue-soft);opacity:.85;margin-bottom:.6rem
}
.panel-title{
    font-size:1.6rem;font-weight:600;line-height:1.25;margin-bottom:.4rem
}
.panel-title em{font-style:italic;color:var(--blue-soft);display:block;margin-top:.1rem}
.panel-tagline{font-size:.8rem;opacity:.7;line-height:1.6}
.panel-footer{font-size:.68rem;opacity:.45;letter-spacing:.05em}

/* ---- Right form panel ---- */
.login-form-wrap{
    padding:3.5rem;
    display:flex;
    flex-direction:column;
    justify-content:center
}
.form-group{margin-bottom:1.4rem}
.form-label{
    display:block;font-size:.75rem;font-weight:500;color:var(--text);margin-bottom:.4rem
}
.input-wrap{position:relative}
.input-wrap .input-icon{
    position:absolute;left:.9rem;top:50%;transform:translateY(-50%);
    color:var(--text-light);pointer-events:none;
    display:flex;align-items:center;justify-content:center;
    width:18px;height:18px
}
.input-wrap .input-icon svg{width:18px;height:18px;display:block}
.form-input{
    width:100%;
    padding:.9rem 1.1rem .9rem 2.6rem;
    background:var(--input-bg);
    border:1.5px solid var(--border);
    border-radius:8px;
    font-family:inherit;
    font-size:.9rem;
    color:var(--text);
    transition:.2s ease;
    outline:none
}
.form-input:focus{
    border-color:var(--blue);
    background:var(--white);
    box-shadow:0 0 0 3px rgba(62,107,150,.10)
}
.form-input::placeholder{color:var(--text-light)}

.password-wrap{position:relative}
.password-wrap .form-input{padding-right:2.6rem}
.password-toggle{
    position:absolute;right:.6rem;top:50%;transform:translateY(-50%);
    background:none;border:none;color:var(--text-light);cursor:pointer;
    padding:0;display:flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:6px;transition:.2s ease
}
.password-toggle:hover{color:var(--blue);background:rgba(62,107,150,.08)}
.password-toggle svg{width:18px;height:18px;display:block}

.btn-login{
    width:100%;padding:.95rem;
    background:linear-gradient(135deg,var(--navy-light),var(--navy));
    color:var(--white);
    font-family:inherit;
    font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
    border:none;border-radius:8px;cursor:pointer;
    transition:.3s ease;
    box-shadow:0 4px 16px rgba(27,58,91,.22);
    margin-top:.4rem;min-height:48px
}
.btn-login:hover,.btn-login:active{
    transform:translateY(-1px);
    box-shadow:0 6px 24px rgba(27,58,91,.32)
}
.btn-back{
    width:100%;padding:.95rem;
    background:transparent;color:var(--navy);
    font-family:inherit;
    font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
    border:1.5px solid var(--navy);border-radius:8px;cursor:pointer;
    transition:.3s ease;
    margin-top:.8rem;min-height:48px;
    display:inline-flex;align-items:center;justify-content:center;gap:6px
}
.btn-back:hover,.btn-back:active{background:var(--navy);color:var(--white)}
.btn-back svg{width:15px;height:15px;display:block;flex-shrink:0}

.form-links{
    text-align:center;margin-top:1.5rem;
    display:flex;justify-content:space-between;align-items:center
}
.form-links a{font-size:.82rem;color:var(--text-muted);transition:.2s ease}
.form-links a:hover{color:var(--blue)}

.error-msg{
    background:rgba(220,38,38,.06);
    border:1px solid rgba(220,38,38,.15);
    border-radius:8px;
    padding:.6rem 1rem;
    font-size:.82rem;color:var(--error);
    margin-bottom:1rem;text-align:center;
    display:flex;align-items:center;justify-content:center;gap:6px
}
.error-msg svg{width:15px;height:15px;flex-shrink:0;display:block}

@media(max-width:768px){
    body.login-page{padding:0;align-items:flex-start}
    .login-wrap{grid-template-columns:1fr;max-width:100%;border-radius:0;min-height:100vh;box-shadow:none}
    .login-panel{padding:1.2rem 1.5rem;min-height:auto;flex-direction:row;align-items:center;gap:.8rem;justify-content:flex-start}
    .panel-icon{margin-bottom:0}
    .panel-icon svg{width:28px;height:28px}
    .panel-title{font-size:1.15rem;margin-bottom:0}
    .panel-title em{display:inline;margin-top:0;margin-left:.35rem}
    .panel-tagline{display:none}
    .panel-footer{display:none}
    .login-form-wrap{padding:2rem 1.5rem 2.5rem}
    .form-group{margin-bottom:1.1rem}
    .form-input{padding:1rem 1.1rem 1rem 2.6rem;border-radius:10px;font-size:1rem}
    .btn-login,.btn-back{padding:1rem;min-height:52px}
}
@media(prefers-reduced-motion:reduce){.login-wrap{animation:none;opacity:1}}
';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>nexam — Login</title>
    <meta name="theme-color" content="#1B3A5B">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style><?php echo $page_styles; ?></style>
</head>
<body class="login-page">

    <div class="login-wrap">
        <!-- Left brand panel -->
        <div class="login-panel">
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
        <div class="login-form-wrap">
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
                    <div class="password-wrap">
                        <span class="input-icon"><i data-lucide="lock"></i></span>
                        <input type="password" id="password" name="password" class="form-input" placeholder="Enter your password" required>
                        <button type="button" class="password-toggle" id="togglePw" aria-label="Show password">
                            <i data-lucide="eye" id="eyeIcon"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn-login">Log In</button>
                <a href="<?php echo site_url(); ?>" class="btn-back">
                    <i data-lucide="arrow-left"></i>
                    Back to Home
                </a>
            </form>

            <div class="form-links">
                <a href="#">Forgot password?</a>
                <a href="#">Register</a>
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();

        document.getElementById("togglePw").addEventListener("click", function () {
            var pw = document.getElementById("password");
            var btn = document.getElementById("togglePw");
            if (pw.type === "password") {
                pw.type = "text";
                btn.setAttribute("aria-label", "Hide password");
                btn.innerHTML = '<i data-lucide="eye-off"></i>';
            } else {
                pw.type = "password";
                btn.setAttribute("aria-label", "Show password");
                btn.innerHTML = '<i data-lucide="eye"></i>';
            }
            lucide.createIcons();
        });
    </script>

</body>
</html>
