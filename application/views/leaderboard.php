<?php
$site_name = $event && !empty($event->name) ? $event->name : 'Binibining Mati 2026';
$rows = $board['rows'] ?? [];

// Candidate photos (same source as the landing-page carousel) used as a backdrop.
$carousel_dir = FCPATH . 'assets/images/carousel';
$carousel_files = is_dir($carousel_dir) ? glob($carousel_dir . '/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) : [];
if ($carousel_files === false) {
    $carousel_files = [];
}
natsort($carousel_files);
$carousel_images = array_values(array_map(function ($path) {
    return base_url('assets/images/carousel/' . basename($path));
}, $carousel_files));

/** Ranked rows with '=' for ties (mirrors the tabulation sheet). */
function lb_render_rows($rows)
{
    $html = '';
    $rank = 1;
    $prev = null;
    foreach ($rows as $i => $r) {
        $tie = $prev !== null && abs($r['score'] - $prev) < 0.001;
        $disp = $tie ? '=' : $rank;
        $cls = $rank === 1 ? 'lb-row lb-row--lead' : ($rank <= 3 ? 'lb-row lb-row--top' : 'lb-row');
        $html .= '<div class="' . $cls . '">';
        $html .= '<span class="lb-rank">' . $disp . '</span>';
        $html .= '<span class="lb-num">#' . htmlspecialchars($r['candidate_number']) . '</span>';
        $html .= '<span class="lb-score">' . number_format($r['score'], 2) . '</span>';
        $html .= '</div>';
        $prev = $r['score'];
        $rank++;
    }
    return $html;
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Leaderboard &middot; <?= htmlspecialchars($site_name) ?></title>
    <meta name="theme-color" content="#0e0c08">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#9812;</text></svg>">
    <style>
        @font-face {
            font-family: "Karla";
            src: url("<?= base_url(); ?>assets/fonts/karla/Karla-Bold.ttf") format("truetype");
            font-weight: 700;
            font-display: swap
        }

        :root {
            --gold: #D4AF37;
            --gold-deep: #B8860B;
            --bg: #0e0c08;
            --panel: #1a1610;
            --line: rgba(212, 175, 55, .15);
            --muted: #9a8f78;
            --text: #f5f1e8
        }

        * { margin: 0; padding: 0; box-sizing: border-box }

        body {
            font-family: 'Karla', system-ui, -apple-system, sans-serif;
            background: radial-gradient(1200px 600px at 50% -10%, #241d12 0%, var(--bg) 60%);
            color: var(--text);
            min-height: 100vh;
            min-height: 100svh;
            padding: 2rem 1rem 4rem
        }

        .wrap { position: relative; z-index: 1; max-width: 720px; margin: 0 auto }

        .lb-head { text-align: center; margin-bottom: 2.2rem }

        .crown { font-size: 2.6rem; color: var(--gold); line-height: 1 }

        .lb-head h1 {
            font-size: 1.9rem;
            font-weight: 700;
            letter-spacing: .01em;
            margin: .6rem 0 .2rem
        }

        .lb-head h1 em { color: var(--gold); font-style: normal }

        .event-name {
            font-size: .8rem;
            letter-spacing: .25em;
            text-transform: uppercase;
            color: var(--muted)
        }

        .round-pill {
            display: inline-flex;
            align-items: center;
            gap: .5rem;
            margin-top: 1.1rem;
            padding: .5rem 1.1rem;
            border: 1px solid var(--line);
            border-radius: 999px;
            background: rgba(212, 175, 55, .06);
            font-size: .82rem;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: var(--gold)
        }

        .live-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #e0245e;
            box-shadow: 0 0 0 0 rgba(224, 36, 94, .6);
            animation: pulse 1.8s infinite
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(224, 36, 94, .5) }
            70% { box-shadow: 0 0 0 9px rgba(224, 36, 94, 0) }
            100% { box-shadow: 0 0 0 0 rgba(224, 36, 94, 0) }
        }

        .lb-list { display: flex; flex-direction: column; gap: .55rem }

        .lb-row {
            display: grid;
            grid-template-columns: 48px 1fr auto;
            align-items: center;
            gap: 1rem;
            padding: 1rem 1.3rem;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 14px;
            transition: background .4s ease, border-color .4s ease, transform .25s ease
        }

        .lb-row.flash { animation: flash 1.1s ease }

        @keyframes flash {
            0% { background: rgba(212, 175, 55, .18) }
            100% { background: var(--panel) }
        }

        .lb-rank {
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--muted);
            text-align: center
        }

        .lb-row--top .lb-rank { color: var(--gold) }

        .lb-row--lead {
            border-color: rgba(212, 175, 55, .55);
            background: linear-gradient(90deg, rgba(212, 175, 55, .12), var(--panel) 55%)
        }

        .lb-row--lead .lb-rank {
            color: #1a1610;
            background: linear-gradient(135deg, var(--gold), var(--gold-deep));
            border-radius: 50%;
            width: 36px;
            height: 36px;
            line-height: 36px;
            margin: 0 auto
        }

        .lb-num {
            font-weight: 700;
            color: var(--text);
            font-size: 1.05rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap
        }

        .lb-score { font-size: 1.25rem; font-weight: 700; color: var(--gold) }

        .lb-empty {
            text-align: center;
            padding: 3rem 1.5rem;
            color: var(--muted);
            background: var(--panel);
            border: 1px dashed var(--line);
            border-radius: 14px
        }

        .lb-foot {
            text-align: center;
            margin-top: 2.2rem;
            color: var(--muted);
            font-size: .8rem
        }

        .lb-foot .updated { display: block; margin-bottom: 1rem; letter-spacing: .04em }

        .lb-links a {
            color: var(--gold);
            text-decoration: none;
            margin: 0 .7rem;
            border-bottom: 1px solid transparent;
            transition: .2s
        }

        .lb-links a:hover { border-bottom-color: var(--gold) }

        @media (max-width: 480px) {
            .lb-row { grid-template-columns: 36px 1fr auto; gap: .6rem; padding: .85rem 1rem }
            .lb-head h1 { font-size: 1.5rem }
            .lb-score { font-size: 1.1rem }
        }

        /* Candidate photo backdrop */
        .lb-bg {
            position: fixed;
            inset: 0;
            z-index: 0;
            overflow: hidden;
            background: var(--bg)
        }

        .lb-bg__layer {
            position: absolute;
            inset: 0;
            background-size: cover;
            background-position: center top;
            opacity: 0;
            transition: opacity 1.6s ease;
            will-change: opacity
        }

        .lb-bg__layer.is-active {
            opacity: 1;
            animation: lbKen 13s ease-out forwards
        }

        @keyframes lbKen {
            from { transform: scale(1.12) }
            to { transform: scale(1) }
        }

        .lb-bg__scrim {
            position: absolute;
            inset: 0;
            background:
                radial-gradient(1200px 700px at 50% -10%, rgba(36, 29, 18, .35) 0%, transparent 60%),
                linear-gradient(180deg, rgba(14, 12, 8, .86) 0%, rgba(14, 12, 8, .74) 45%, rgba(14, 12, 8, .92) 100%)
        }

        @media (prefers-reduced-motion: reduce) {
            .lb-bg__layer { transition: none }
            .lb-bg__layer.is-active { animation: none }
        }
    </style>
</head>

<body>
    <?php if (!empty($carousel_images)): ?>
        <div class="lb-bg" aria-hidden="true" data-lb-bg>
            <div class="lb-bg__layer is-active" data-bg-layer style="background-image:url('<?= htmlspecialchars($carousel_images[0]) ?>')"></div>
            <div class="lb-bg__layer" data-bg-layer></div>
            <div class="lb-bg__scrim"></div>
        </div>
    <?php endif; ?>

    <div class="wrap">
        <div class="lb-head">
            <div class="crown">&#9812;</div>
            <h1>Live <em>Leaderboard</em></h1>
            <div class="event-name"><?= htmlspecialchars($site_name) ?></div>
            <div class="round-pill">
                <span class="live-dot"></span>
                <span id="roundLabel"><?= htmlspecialchars($board['round_label'] ?? 'Preliminary') ?></span>
            </div>
        </div>

        <div class="lb-list" id="lbList">
            <?php if (empty($rows)): ?>
                <div class="lb-empty">Scoring hasn't started yet.<br>Standings will appear here live as judges submit their scores.</div>
            <?php else: ?>
                <?= lb_render_rows($rows) ?>
            <?php endif; ?>
        </div>

        <div class="lb-foot">
            <span class="updated">Updated <span id="updatedAt">just now</span> &middot; refreshes automatically</span>
            <div class="lb-links">
                <a href="<?= site_url() ?>">&larr; Home</a>
                <a href="<?= site_url('login/login_page') ?>">Judge Login</a>
            </div>
        </div>
    </div>

    <script>
        (function () {
            const list = document.getElementById('lbList');
            const roundLabel = document.getElementById('roundLabel');
            const updatedAt = document.getElementById('updatedAt');
            const DATA_URL = '<?= site_url('leaderboard/data') ?>';

            const esc = s => String(s).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));

            // Track each candidate's last score so we can flash rows that changed.
            let lastScore = {};

            function render(data) {
                const rows = data.rows || [];
                if (roundLabel && data.round_label) roundLabel.textContent = data.round_label;

                if (!rows.length) {
                    list.innerHTML = '<div class="lb-empty">Scoring hasn\'t started yet.<br>Standings will appear here live as judges submit their scores.</div>';
                    return;
                }

                let rank = 1, prev = null, html = '';
                rows.forEach(r => {
                    const tie = prev !== null && Math.abs(r.score - prev) < 0.001;
                    const disp = tie ? '=' : rank;
                    const cls = rank === 1 ? 'lb-row lb-row--lead' : (rank <= 3 ? 'lb-row lb-row--top' : 'lb-row');
                    const changed = lastScore[r.id] !== undefined && lastScore[r.id] !== r.score;
                    html += '<div class="' + cls + (changed ? ' flash' : '') + '">' +
                        '<span class="lb-rank">' + disp + '</span>' +
                        '<span class="lb-num">#' + esc(r.candidate_number) + '</span>' +
                        '<span class="lb-score">' + Number(r.score).toFixed(2) + '</span>' +
                        '</div>';
                    lastScore[r.id] = r.score;
                    prev = r.score;
                    rank++;
                });
                list.innerHTML = html;
            }

            async function refresh() {
                try {
                    const res = await fetch(DATA_URL, { cache: 'no-store' });
                    if (!res.ok) return;
                    render(await res.json());
                    updatedAt.textContent = new Date().toLocaleTimeString();
                } catch (e) { /* keep last good render */ }
            }

            // Seed lastScore from the server-rendered rows so the first poll
            // doesn't flash everything.
            <?php foreach ($rows as $r): ?>
            lastScore[<?= (int)$r['id'] ?>] = <?= json_encode($r['score']) ?>;
            <?php endforeach; ?>

            updatedAt.textContent = new Date().toLocaleTimeString();
            setInterval(refresh, 8000);
        })();
    </script>

    <?php if (!empty($carousel_images)): ?>
        <script>
            // Crossfading candidate-photo backdrop. Loads one image at a time
            // (preloads the next, then fades) to stay light on mobile data.
            (function () {
                const root = document.querySelector('[data-lb-bg]');
                if (!root) return;
                const images = <?= json_encode($carousel_images) ?>;
                if (images.length < 2) return;
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

                const layers = Array.from(root.querySelectorAll('[data-bg-layer]'));
                let active = 0;
                let imgIndex = 0;

                function showNext() {
                    imgIndex = (imgIndex + 1) % images.length;
                    const url = images[imgIndex];
                    const incoming = layers[1 - active];
                    const pre = new Image();
                    pre.onload = () => {
                        incoming.style.backgroundImage = "url('" + url + "')";
                        incoming.classList.add('is-active');
                        layers[active].classList.remove('is-active');
                        active = 1 - active;
                    };
                    pre.src = url;
                }

                setInterval(showNext, 6000);
            })();
        </script>
    <?php endif; ?>
</body>

</html>
