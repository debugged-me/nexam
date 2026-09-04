<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>nexam — Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: #eef2f7; color: #1e293b; }
        .topbar {
            background: #1a5276;
            color: #fff;
            padding: 14px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .topbar .logo { font-size: 20px; font-weight: 700; }
        .topbar .user-area { display: flex; align-items: center; gap: 16px; font-size: 14px; }
        .topbar .user-area strong { font-weight: 600; }
        .topbar .logout-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            background: rgba(255,255,255,0.12);
            padding: 7px 14px;
            border-radius: 8px;
            transition: background 0.15s;
        }
        .topbar .logout-btn:hover { background: rgba(255,255,255,0.20); }
        .container { max-width: 800px; margin: 48px auto; padding: 0 24px; }
        .welcome-card {
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            padding: 40px;
            text-align: center;
        }
        .welcome-card h1 { font-size: 24px; margin-bottom: 8px; }
        .welcome-card p { color: #64748b; font-size: 14px; line-height: 1.6; }
        .badge {
            display: inline-block;
            background: #e8edf3;
            color: #1a5276;
            font-size: 12px;
            font-weight: 600;
            padding: 5px 16px;
            border-radius: 999px;
            margin-top: 16px;
        }
        .placeholder { margin-top: 20px; color: #94a3b8; font-size: 13px; }
    </style>
</head>
<body>
    <div class="topbar">
        <div class="logo">nexam</div>
        <div class="user-area">
            <strong><?php echo htmlspecialchars($full_name); ?></strong>
            <span style="opacity:0.7;">&middot;</span>
            <span style="opacity:0.8;"><?php echo htmlspecialchars($role); ?></span>
            <a href="<?php echo site_url('logout'); ?>" class="logout-btn">
                <i data-lucide="log-out" style="width:15px;height:15px;"></i>
                Logout
            </a>
        </div>
    </div>
    <div class="container">
        <div class="welcome-card">
            <h1>Welcome, <?php echo htmlspecialchars(explode(' ', $full_name)[0]); ?>!</h1>
            <p>You're signed in as <strong><?php echo htmlspecialchars($email); ?></strong>.<br>The exam-builder dashboard modules will appear here.</p>
            <span class="badge">TOS-aligned Exam Builder</span>
            <p class="placeholder">Subjects, Questions, TOS, and Exams modules coming next.</p>
        </div>
    </div>
    <script>lucide.createIcons();</script>
</body>
</html>
