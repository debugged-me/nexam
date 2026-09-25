<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KPI preview — nexam</title>
<link href="../assets/css/fonts.css" rel="stylesheet">
<link href="../assets/css/toast.css" rel="stylesheet">
<link href="../assets/css/modal.css" rel="stylesheet">
<link href="../assets/css/layout.css" rel="stylesheet">
<link href="../assets/css/dashboard.css" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body class="app-body">
<div class="main-content" style="margin-left:0">
<div class="page-content page-content--dashboard">

    <div class="page-header">
        <div>
            <h1>Good morning, Clark</h1>
            <p class="page-sub">42 questions and 3 exams created in the last 30 days.</p>
        </div>
        <div class="page-header-actions">
            <a href="#" class="btn btn-outline"><i data-lucide="plus"></i> New Question</a>
            <a href="#" class="btn btn-primary"><i data-lucide="file-plus-2"></i> New Exam</a>
        </div>
    </div>

    <div class="kpi-grid">
        <a href="#" class="kpi-card kpi-card--info">
            <div class="kpi-top">
                <span class="kpi-icon kpi-icon--info"><i data-lucide="book-open"></i></span>
                <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
            </div>
            <div class="kpi-num">12</div>
            <div class="kpi-label">Subjects</div>
            <div class="kpi-foot">
                <span class="delta up"><i data-lucide="trending-up"></i> 18%</span>
                <span>vs. previous 30 days</span>
            </div>
        </a>
        <a href="#" class="kpi-card kpi-card--success">
            <div class="kpi-top">
                <span class="kpi-icon kpi-icon--success"><i data-lucide="help-circle"></i></span>
                <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
            </div>
            <div class="kpi-num">248</div>
            <div class="kpi-label">Questions</div>
            <div class="kpi-foot">
                <span class="delta up"><i data-lucide="trending-up"></i> 12%</span>
                <span>vs. previous 30 days</span>
            </div>
        </a>
        <a href="#" class="kpi-card kpi-card--warning">
            <div class="kpi-top">
                <span class="kpi-icon kpi-icon--warning"><i data-lucide="table"></i></span>
                <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
            </div>
            <div class="kpi-num">6</div>
            <div class="kpi-label">Blueprints (TOS)</div>
            <div class="kpi-foot">
                <span class="delta flat">No change</span>
                <span>vs. previous 30 days</span>
            </div>
        </a>
        <a href="#" class="kpi-card kpi-card--purple">
            <div class="kpi-top">
                <span class="kpi-icon kpi-icon--purple"><i data-lucide="file-text"></i></span>
                <span class="kpi-open"><i data-lucide="arrow-up-right"></i></span>
            </div>
            <div class="kpi-num">9</div>
            <div class="kpi-label">Exams</div>
            <div class="kpi-foot">
                <span class="delta down"><i data-lucide="trending-down"></i> 4%</span>
                <span>vs. previous 30 days</span>
            </div>
        </a>
    </div>

    <div class="dash-grid">
        <div class="card">
            <div class="card-header">
                <div><span class="card-title">Content Activity</span><div class="card-sub">For context — how a normal card sits below the tiles</div></div>
            </div>
            <div class="card-body"><p class="text-muted">Chart goes here.</p></div>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Bank Readiness</span></div>
            <div class="card-body"><p class="text-muted">Gauge goes here.</p></div>
        </div>
    </div>
</div>
</div>
<script>lucide.createIcons();</script>
</body>
</html>
