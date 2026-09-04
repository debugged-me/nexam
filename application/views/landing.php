<?php
// Live values from the controller, with safe fallbacks if the view is hit directly.
$stats     = isset($stats) ? $stats : ['categories' => 0, 'judges' => 0, 'candidates' => 0];
$event     = isset($event) ? $event : null;
$board     = isset($board) ? $board : ['round_label' => 'Preliminary', 'rows' => []];
$board_top = isset($board_top) ? $board_top : [];

$site_name = $event && !empty($event->name) ? $event->name : 'Binibining Mati 2026';
$config = ['site_name' => $site_name];
$year = $event && !empty($event->year) ? $event->year : date('Y');
$carousel_dir = FCPATH . 'assets/images/carousel';
$carousel_files = is_dir($carousel_dir) ? glob($carousel_dir . '/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) : [];
if ($carousel_files === false) {
    $carousel_files = [];
}
natsort($carousel_files);
$carousel_images = array_values(array_map(function ($path) {
    $filename = basename($path);

    return [
        'src' => base_url('assets/images/carousel/' . $filename),
        'alt' => 'Binibining Mati candidate portrait',
    ];
}, $carousel_files));
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($config['site_name']) ?></title>
    <meta name="description" content="Official e-Score Sheet system for Binibining Mati 2026. Real-time digital scoring for pageant judges.">
    <meta name="theme-color" content="#B8860B">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#9812;</text></svg>">
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

        :root {
            --bg: #FDFCFA;
            --bg-warm: #FAFAF8;
            --gold: #B8860B;
            --gold-light: #D4AF37;
            --text: #111827;
            --text-muted: #6B7280;
            --border: rgba(184, 134, 11, 0.22);
            --border-light: rgba(184, 134, 11, 0.1);
            --white: #FFFEFE
        }

        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0
        }

        html {
            scroll-behavior: smooth
        }

        body {
            font-family: 'Karla', sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.65;
            overflow-x: hidden
        }

        a {
            text-decoration: none;
            color: inherit
        }

        .container {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 2rem
        }

        .nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 999;
            padding: 1.5rem 0;
            transition: .4s ease;
            border-bottom: 1px solid transparent
        }

        .nav.scrolled {
            background: rgba(255, 255, 255, .96);
            backdrop-filter: blur(16px);
            border-bottom-color: var(--border-light);
            padding: 1rem 0
        }

        .nav__inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem
        }

        .nav__logo {
            display: flex;
            align-items: center;
            gap: .6rem;
            font-family: 'Karla', sans-serif;
            font-size: 1.3rem;
            font-weight: 600;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis
        }

        .nav__logo-icon {
            width: 32px;
            height: 32px;
            flex-shrink: 0;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: .9rem;
            color: var(--white)
        }

        .nav__logo-img {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
            object-fit: contain
        }

        .nav__toggle {
            display: none;
            background: none;
            border: none;
            font-size: 1.4rem;
            color: var(--gold);
            cursor: pointer;
            padding: .5rem;
            touch-action: manipulation
        }

        .nav__cta {
            display: flex;
            align-items: center;
            gap: .6rem;
            flex-shrink: 0
        }

        .nav__cta a {
            font-size: .78rem;
            white-space: nowrap;
            font-weight: 500;
            letter-spacing: .08em;
            text-transform: uppercase;
            color: var(--gold);
            padding: .65rem 1.6rem;
            border: 1.5px solid var(--gold);
            border-radius: 8px;
            transition: .3s ease;
            min-height: 44px;
            display: inline-flex;
            align-items: center
        }

        .nav__cta a:hover,
        .nav__cta a:active {
            background: var(--gold);
            color: var(--white)
        }

        .hero {
            min-height: 100vh;
            min-height: 100svh;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 5rem 2rem 4rem;
            background-color: #061538;
            background-image:
                linear-gradient(90deg, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 55%, rgba(0, 0, 0, 0.15) 100%),
                linear-gradient(180deg, rgba(6, 21, 56, 0) 0%, rgba(6, 21, 56, .25) 66%, rgba(6, 21, 56, .95) 100%),
                url('assets/images/landing.jpg');
            background-position: center, center, center top;
            background-size: 100% 100%, 100% 100%, 100% auto;
            background-repeat: no-repeat;
            position: relative;
            color: var(--white)
        }

        .hero__content {
            text-align: left;
            width: min(100%, 680px);
            max-width: 680px
        }

        .hero__crown {
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            opacity: .75
        }

        .hero__logo {
            display: block;
            width: 180px;
            height: auto;
            margin: 0 0 1.5rem;
            opacity: 1
        }

        .hero__label {
            font-size: .68rem;
            font-weight: 500;
            letter-spacing: .35em;
            text-transform: uppercase;
            color: var(--gold);
            display: block;
            line-height: 1.45;
            margin: 0
        }

        .hero__meta {
            display: flex;
            align-items: center;
            gap: .85rem;
            flex-wrap: wrap;
            margin-bottom: 1rem;
            text-align: left
        }

        .hero__date {
            font-family: 'Karla', sans-serif;
            font-size: .86rem;
            font-weight: 600;
            letter-spacing: .14em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, .9);
            margin: 0;
            padding-left: .85rem;
            border-left: 1px solid rgba(212, 175, 55, .5);
            line-height: 1.45;
            text-shadow: 0 2px 10px rgba(0, 0, 0, .5)
        }

        .hero__title {
            font-family: 'Karla', sans-serif;
            font-size: clamp(2.6rem, 5.5vw, 4.2rem);
            font-weight: 600;
            line-height: 1.1;
            margin-bottom: 1.25rem;
            text-shadow: 0 2px 20px rgba(0, 0, 0, .6)
        }

        .hero__title em {
            font-style: italic;
            color: var(--gold)
        }

        .hero__sub {
            font-size: 1rem;
            font-weight: 300;
            color: rgba(255, 255, 255, .9);
            max-width: 480px;
            margin: 0 0 2.5rem;
            line-height: 1.8;
            text-shadow: 0 2px 10px rgba(0, 0, 0, .5)
        }

        .hero__divider {
            width: 50px;
            height: 1px;
            background: linear-gradient(90deg, var(--gold), transparent);
            margin: 0 0 2.5rem
        }

        .hero__actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-start;
            flex-wrap: wrap
        }

        .btn-gold {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: .5rem;
            padding: 1rem 2.4rem;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: var(--white);
            font-size: .78rem;
            font-weight: 500;
            letter-spacing: .1em;
            text-transform: uppercase;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: .3s ease;
            box-shadow: 0 4px 20px rgba(184, 134, 11, .25);
            min-height: 48px;
            min-width: 160px;
            touch-action: manipulation
        }

        .btn-gold:hover,
        .btn-gold:active {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(184, 134, 11, .35)
        }

        .btn-outline-gold {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: .5rem;
            padding: 1rem 2.4rem;
            background: transparent;
            color: var(--gold);
            font-size: .78rem;
            font-weight: 500;
            letter-spacing: .1em;
            text-transform: uppercase;
            border: 1.5px solid var(--gold);
            border-radius: 8px;
            cursor: pointer;
            transition: .3s ease;
            min-height: 48px;
            min-width: 160px;
            touch-action: manipulation
        }

        .btn-outline-gold:hover,
        .btn-outline-gold:active {
            background: var(--gold);
            color: var(--white)
        }

        .section {
            padding: 5rem 0
        }

        .section-warm {
            background: var(--bg-warm)
        }

        .section-dark {
            background: linear-gradient(160deg, #1C1C2E 0%, #2D2B45 100%);
            color: var(--white)
        }

        .section-dark .section-title {
            color: var(--white)
        }

        .section-dark .section-label {
            color: var(--gold-light)
        }

        .section-dark .section-sub,
        .section-dark .about-text,
        .section-dark .step-desc,
        .section-dark .feature-desc {
            color: rgba(255, 255, 255, .65)
        }

        .section-dark .step-num {
            background: transparent;
            color: var(--gold-light);
            border-color: var(--gold-light)
        }

        .section-dark .feature-num {
            color: var(--gold-light)
        }

        .section-dark .divider::after {
            background: linear-gradient(90deg, transparent, var(--gold-light), transparent)
        }

        .section-dark .feature-card,
        .section-dark .detail-card,
        .section-dark .stat-item {
            background: rgba(255, 255, 255, .06);
            border-color: rgba(212, 175, 55, .15);
            box-shadow: 0 2px 12px rgba(0, 0, 0, .15)
        }

        .section-dark .feature-card:hover,
        .section-dark .detail-card:hover,
        .section-dark .stat-item:hover {
            border-color: rgba(212, 175, 55, .35);
            box-shadow: 0 8px 24px rgba(0, 0, 0, .25)
        }

        .section-dark .feature-title,
        .section-dark .step-title,
        .section-dark .detail-value {
            color: var(--white)
        }

        .section-dark .detail-label {
            color: var(--gold-light)
        }

        .section-header {
            text-align: center;
            max-width: 540px;
            margin: 0 auto 3rem
        }

        .section-label {
            font-size: .68rem;
            font-weight: 500;
            letter-spacing: .3em;
            text-transform: uppercase;
            color: var(--gold);
            margin-bottom: 1rem;
            display: block
        }

        .section-title {
            font-family: 'Karla', sans-serif;
            font-size: clamp(1.6rem, 3vw, 2.4rem);
            font-weight: 600;
            line-height: 1.2;
            margin-bottom: .8rem
        }

        .section-title em {
            font-style: italic;
            color: var(--gold)
        }

        .section-sub {
            font-size: .92rem;
            color: var(--text-muted);
            line-height: 1.7
        }

        .divider {
            width: 40px;
            height: 1px;
            background: var(--gold);
            margin: 0 auto 2rem;
            opacity: .4
        }

        .about-text {
            text-align: center;
            max-width: 600px;
            margin: 0 auto;
            font-size: 1rem;
            color: var(--text-muted);
            line-height: 1.9
        }

        .candidate-gallery-section {
            min-height: 100vh;
            min-height: 100svh;
            padding: clamp(2.5rem, 4vh, 4rem) 0 clamp(2.5rem, 4vh, 4rem);
            overflow: hidden;
            display: flex;
            align-items: center;
            background:
                linear-gradient(180deg, #111126 0%, #24213a 48%, #17172d 100%)
        }

        .candidate-gallery-section .container {
            max-width: min(1500px, 100%);
            padding: 0 clamp(1rem, 3vw, 3rem)
        }

        .candidate-showcase {
            max-width: 1120px;
            margin: 0 auto
        }

        .candidate-carousel {
            position: relative;
            padding: 0 clamp(3.5rem, 5vw, 5rem)
        }

        .candidate-carousel__viewport {
            overflow: hidden;
            border-radius: 8px;
            cursor: grab;
            touch-action: pan-y;
            user-select: none
        }

        .candidate-carousel.is-dragging .candidate-carousel__viewport {
            cursor: grabbing
        }

        .candidate-carousel__track {
            display: flex;
            gap: 0;
            transition: transform .45s cubic-bezier(.16, 1, .3, 1);
            will-change: transform
        }

        .candidate-carousel.is-dragging .candidate-carousel__track {
            transition: none
        }

        .candidate-slide {
            flex: 0 0 100%;
            min-width: 0;
            display: flex;
            justify-content: center
        }

        .candidate-photo {
            width: min(100%, calc((100svh - 6rem) * .8), 1040px);
            min-width: 0;
            aspect-ratio: 4 / 5;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid rgba(212, 175, 55, .22);
            background: rgba(255, 255, 255, .06);
            box-shadow: 0 16px 42px rgba(0, 0, 0, .22);
            transform: translateZ(0);
            transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease
        }

        .candidate-slide:hover .candidate-photo {
            border-color: rgba(212, 175, 55, .58);
            box-shadow: 0 22px 54px rgba(0, 0, 0, .32);
            transform: translateY(-3px)
        }

        .candidate-photo img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center top;
            pointer-events: none;
            transition: transform .35s ease
        }

        .candidate-slide:hover img {
            transform: scale(1.035)
        }

        .candidate-carousel__button {
            position: absolute;
            top: 50%;
            z-index: 2;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            border: 1px solid rgba(212, 175, 55, .45);
            background: rgba(17, 24, 39, .72);
            color: #fff;
            font-size: 1.9rem;
            line-height: 1;
            cursor: pointer;
            touch-action: manipulation;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translateY(-50%);
            transition: background .2s ease, border-color .2s ease, transform .2s ease
        }

        .candidate-carousel__button:hover {
            background: var(--gold);
            border-color: var(--gold);
            transform: translateY(-50%) scale(1.04)
        }

        .candidate-carousel__button:disabled {
            opacity: .4;
            cursor: default;
            transform: translateY(-50%)
        }

        .candidate-carousel__button--prev {
            left: 0
        }

        .candidate-carousel__button--next {
            right: 0
        }

        .candidate-carousel__dots {
            display: flex;
            justify-content: center;
            gap: .45rem;
            margin-top: 1.35rem;
            flex-wrap: wrap
        }

        .candidate-carousel__dot {
            width: 10px;
            height: 10px;
            border: 0;
            border-radius: 999px;
            background: rgba(255, 255, 255, .28);
            cursor: pointer;
            padding: 0;
            transition: width .2s ease, background .2s ease
        }

        .candidate-carousel__dot.is-active {
            width: 32px;
            background: var(--gold-light)
        }

        .candidate-carousel__counter {
            display: none;
            margin-top: 1.1rem;
            text-align: center;
            font-size: .82rem;
            font-weight: 600;
            letter-spacing: .16em;
            color: rgba(255, 255, 255, .55);
            font-variant-numeric: tabular-nums
        }

        .candidate-carousel__counter [data-carousel-current] {
            color: var(--gold-light);
            font-weight: 700
        }

        .candidate-carousel__counter-sep {
            margin: 0 .5rem;
            opacity: .5
        }

        .steps {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 2rem;
            margin-top: 2.5rem
        }

        .step {
            text-align: center
        }

        .step-num {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 1.5px solid var(--gold);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Karla', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--gold);
            margin: 0 auto 1.2rem;
            background: var(--white);
            box-shadow: 0 2px 8px rgba(0, 0, 0, .05)
        }

        .step-title {
            font-family: 'Karla', sans-serif;
            font-size: 1.05rem;
            font-weight: 600;
            margin-bottom: .4rem
        }

        .step-desc {
            font-size: .82rem;
            color: var(--text-muted);
            line-height: 1.65
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-top: 2.5rem
        }

        .feature-card {
            background: var(--white);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            padding: 2rem;
            transition: .3s ease;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .04)
        }

        .feature-card:hover {
            border-color: var(--border);
            box-shadow: 0 12px 40px rgba(28, 28, 46, .05);
            transform: translateY(-3px)
        }

        .feature-num {
            font-family: 'Karla', sans-serif;
            font-size: .8rem;
            font-weight: 600;
            color: var(--gold);
            letter-spacing: .1em;
            margin-bottom: .6rem
        }

        .feature-title {
            font-family: 'Karla', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: .5rem
        }

        .feature-desc {
            font-size: .84rem;
            color: var(--text-muted);
            line-height: 1.65
        }

        .cta-section {
            background: linear-gradient(160deg, #1C1C2E 0%, #2D2B45 100%);
            padding: 4.5rem 0;
            text-align: center;
            position: relative;
            color: var(--white)
        }

        .cta-section::before,
        .cta-section::after {
            content: '';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 50px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--gold-light), transparent)
        }

        .cta-section::before {
            top: 0
        }

        .cta-section::after {
            bottom: 0
        }

        .cta-title {
            font-family: 'Karla', sans-serif;
            font-size: clamp(1.6rem, 3vw, 2.4rem);
            font-weight: 600;
            margin-bottom: .7rem;
            color: var(--white)
        }

        .cta-title em {
            font-style: italic;
            color: var(--gold-light)
        }

        .cta-sub {
            font-size: .92rem;
            color: rgba(255, 255, 255, .6);
            margin-bottom: 2rem
        }

        .ornament {
            text-align: center;
            margin: 0 0 2rem;
            font-size: 1.1rem;
            color: var(--gold);
            opacity: .35;
            letter-spacing: .3em
        }

        .event-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-top: 2.5rem
        }

        .detail-card {
            text-align: center;
            padding: 1.8rem 1.2rem;
            background: var(--white);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            transition: .3s ease;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .04)
        }

        .detail-card:hover {
            border-color: var(--border);
            box-shadow: 0 8px 24px rgba(28, 28, 46, .04)
        }

        .detail-icon {
            font-size: 1.4rem;
            margin-bottom: .6rem
        }

        .detail-label {
            font-size: .65rem;
            font-weight: 500;
            letter-spacing: .2em;
            text-transform: uppercase;
            color: var(--gold);
            margin-bottom: .35rem
        }

        .detail-value {
            font-family: 'Karla', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text)
        }

        .hero__content>* {
            opacity: 0;
            transform: translateY(40px) scale(.95);
            animation: heroEntrance .9s cubic-bezier(.16, 1, .3, 1) forwards
        }

        .hero__content>*:nth-child(1) {
            animation-delay: .15s
        }

        .hero__content>*:nth-child(2) {
            animation-delay: .3s
        }

        .hero__content>*:nth-child(3) {
            animation-delay: .45s
        }

        .hero__content>*:nth-child(4) {
            animation-delay: .6s
        }

        .hero__content>*:nth-child(5) {
            animation-delay: .75s
        }

        .hero__content>*:nth-child(6) {
            animation-delay: .9s
        }

        @keyframes heroEntrance {
            to {
                opacity: 1;
                transform: translateY(0) scale(1)
            }
        }

        /* Floating crown animation */
        .hero__crown {
            animation: crownFloat 3s ease-in-out infinite;
            display: inline-block
        }

        @keyframes crownFloat {

            0%,
            100% {
                transform: translateY(0)
            }

            50% {
                transform: translateY(-8px)
            }
        }

        /* Title gold glow pulse */
        .hero__title {
            position: relative
        }

        .hero__title em {
            animation: goldPulse 2.5s ease-in-out infinite;
            display: inline-block
        }

        @keyframes goldPulse {

            0%,
            100% {
                text-shadow: 0 0 0 transparent
            }

            50% {
                text-shadow: 0 0 20px rgba(212, 175, 55, .35)
            }
        }

        /* Scroll reveal animations */
        .fade-up {
            opacity: 0;
            transform: translateY(40px);
            transition: opacity .8s cubic-bezier(.16, 1, .3, 1), transform .8s cubic-bezier(.16, 1, .3, 1)
        }

        .fade-up.in {
            opacity: 1;
            transform: translateY(0)
        }

        .slide-left {
            opacity: 0;
            transform: translateX(-60px);
            transition: opacity .8s cubic-bezier(.16, 1, .3, 1), transform .8s cubic-bezier(.16, 1, .3, 1)
        }

        .slide-left.in {
            opacity: 1;
            transform: translateX(0)
        }

        .slide-right {
            opacity: 0;
            transform: translateX(60px);
            transition: opacity .8s cubic-bezier(.16, 1, .3, 1), transform .8s cubic-bezier(.16, 1, .3, 1)
        }

        .slide-right.in {
            opacity: 1;
            transform: translateX(0)
        }

        .scale-in {
            opacity: 0;
            transform: scale(.85);
            transition: opacity .7s cubic-bezier(.16, 1, .3, 1), transform .7s cubic-bezier(.16, 1, .3, 1)
        }

        .scale-in.in {
            opacity: 1;
            transform: scale(1)
        }

        .footer {
            padding: 2.5rem 0;
            text-align: center;
            background: linear-gradient(160deg, #1C1C2E 0%, #2D2B45 100%);
            color: var(--white)
        }

        .footer-copy {
            font-size: .75rem;
            color: rgba(255, 255, 255, .55);
            letter-spacing: .05em
        }

        .fade-up {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity .6s ease, transform .6s ease
        }

        .fade-up.in {
            opacity: 1;
            transform: translateY(0)
        }

        /* Floating gold particles - pure CSS */
        .hero {
            position: relative;
            overflow: hidden
        }

        .hero::after {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            background-image:
                radial-gradient(circle at 20% 30%, rgba(184, 134, 11, .06) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, rgba(212, 175, 55, .05) 0%, transparent 40%),
                radial-gradient(circle at 50% 80%, rgba(184, 134, 11, .04) 0%, transparent 35%)
        }

        /* Gold shimmer on label */
        .hero__label {
            position: relative;
            display: inline-block;
            text-align: left
        }

        .hero__label::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            transform: none;
            width: 30px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--gold), transparent);
            animation: shimmer 3s ease-in-out infinite
        }

        @keyframes shimmer {

            0%,
            100% {
                opacity: .3;
                width: 30px
            }

            50% {
                opacity: .8;
                width: 60px
            }
        }

        /* Enhanced card hover with gold glow */
        .feature-card:hover {
            border-color: rgba(184, 134, 11, .25);
            box-shadow: 0 12px 40px rgba(184, 134, 11, .08), 0 0 0 1px rgba(184, 134, 11, .06);
            transform: translateY(-4px)
        }

        .feature-card {
            position: relative;
            overflow: hidden
        }

        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--gold-light), transparent);
            opacity: 0;
            transition: opacity .3s ease
        }

        .feature-card:hover::before {
            opacity: .5
        }

        /* Step number enhanced */
        .step-num {
            position: relative;
            transition: .3s ease
        }

        .step:hover .step-num {
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: var(--white);
            border-color: transparent;
            box-shadow: 0 4px 12px rgba(184, 134, 11, .2)
        }

        /* Detail card enhanced hover */
        .detail-card:hover {
            border-color: rgba(184, 134, 11, .2);
            box-shadow: 0 8px 24px rgba(184, 134, 11, .06);
            transform: translateY(-2px)
        }

        .detail-card {
            transition: .3s ease
        }

        /* Nav logo icon hover */
        .nav__logo-icon {
            transition: .3s ease
        }

        .nav__logo:hover .nav__logo-icon {
            transform: rotate(12deg) scale(1.05)
        }

        /* Animated divider */
        .divider {
            position: relative;
            overflow: hidden
        }

        .divider::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, var(--gold), transparent);
            animation: dividerSlide 4s ease-in-out infinite
        }

        @keyframes dividerSlide {
            0% {
                left: -100%
            }

            50%,
            100% {
                left: 100%
            }
        }

        /* Footer link underline grow */
        .footer-copy a,
        .form-links a {
            position: relative
        }

        .footer-copy a::after,
        .form-links a::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            width: 0;
            height: 1px;
            background: var(--gold);
            transition: width .3s ease
        }

        .footer-copy a:hover::after,
        .form-links a:hover::after {
            width: 100%
        }

        @media(max-width:900px) {
            .steps {
                grid-template-columns: repeat(2, 1fr)
            }

            .features-grid {
                grid-template-columns: repeat(2, 1fr)
            }

            .candidate-slide {
                flex-basis: 100%
            }
        }

        @media(max-width:600px) {
            .container {
                padding: 0 1.25rem
            }

            .steps {
                grid-template-columns: 1fr
            }

            .features-grid {
                grid-template-columns: 1fr
            }

            .hero {
                padding: 6rem 1.25rem 2rem;
                align-items: flex-start;
                background-image:
                    linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.72) 58%, rgba(6, 21, 56, .96) 100%),
                    url('assets/images/landing.jpg');
                background-position: center, center top;
                background-size: 100% 100%, 100% auto;
                background-repeat: no-repeat
            }

            .hero__content {
                text-align: left;
                width: 100%;
                margin-top: 2rem
            }

            .hero__logo {
                margin: 0 0 1rem
            }

            .hero__meta {
                gap: .45rem;
                margin-bottom: .8rem
            }

            .hero__label {
                font-size: .62rem;
                letter-spacing: .22em
            }

            .hero__date {
                width: 100%;
                padding-left: 0;
                border-left: 0
            }

            .hero__actions {
                flex-direction: column;
                align-items: flex-start;
                width: 100%;
                padding: 0
            }

            .btn-gold,
            .btn-outline-gold {
                width: 100%;
                max-width: 280px
            }

            .hero__title {
                font-size: clamp(2rem, 10vw, 2.8rem)
            }

            .hero__sub {
                font-size: .94rem
            }

            .section {
                padding: 3.5rem 0
            }

            .candidate-gallery-section {
                min-height: 100vh;
                min-height: 100svh;
                padding: 3rem 0 4.25rem
            }

            .candidate-gallery-section .container {
                padding: 0 1rem
            }

            .candidate-carousel {
                padding: 0 1.15rem
            }

            .candidate-photo {
                width: min(100%, 430px);
                aspect-ratio: 2 / 3
            }

            .candidate-photo img {
                object-position: center center
            }

            .section-header {
                margin-bottom: 2.25rem
            }

            .nav {
                padding: .9rem 0
            }

            .nav.scrolled {
                padding: .75rem 0
            }

            .nav__logo {
                font-size: 1rem
            }

            .nav__logo-icon {
                width: 28px;
                height: 28px;
                font-size: .8rem
            }

            .nav__cta {
                gap: .4rem
            }

            .nav__cta a {
                padding: .5rem .85rem;
                font-size: .68rem;
                letter-spacing: .04em;
                min-height: 40px;
                border-width: 1px
            }

            .event-details {
                grid-template-columns: 1fr
            }

            .detail-card {
                padding: 1.4rem 1rem
            }

            .stats-bar {
                grid-template-columns: repeat(2, 1fr)
            }

            .about-widget {
                gap: 1rem
            }

            .lb-row {
                grid-template-columns: 30px 1fr auto;
                gap: .55rem;
                padding: .85rem .9rem
            }

            .lb-rank {
                font-size: 1rem
            }

            .lb-row--lead .lb-rank {
                width: 28px;
                height: 28px;
                line-height: 28px
            }

            .lb-num {
                font-size: .82rem
            }

            .lb-score {
                font-size: 1.05rem
            }

            .candidate-showcase {
                margin-top: 0
            }

            .candidate-slide {
                flex-basis: 100%
            }

            .candidate-carousel__button {
                width: 40px;
                height: 40px;
                font-size: 1.6rem
            }

            .candidate-carousel__button--prev {
                left: .5rem
            }

            .candidate-carousel__button--next {
                right: .5rem
            }

            .candidate-carousel__dots {
                display: none
            }

            .candidate-carousel__counter {
                display: block
            }
        }

        @media(max-width:380px) {
            .container {
                padding: 0 1rem
            }

            .nav__cta a {
                padding: .45rem .7rem;
                font-size: .62rem
            }

            .nav__logo {
                font-size: .92rem
            }

            .stats-bar {
                grid-template-columns: repeat(2, 1fr);
                gap: .7rem
            }

            .stat-num {
                font-size: 1.5rem
            }
        }

        /* Icon containers */
        .icon-wrap {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(212, 175, 55, .12), rgba(184, 134, 11, .08));
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
            color: var(--gold);
            transition: .3s ease
        }

        .feature-card:hover .icon-wrap {
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: var(--white);
            transform: scale(1.08);
            box-shadow: 0 4px 16px rgba(184, 134, 11, .2)
        }

        .step-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(212, 175, 55, .1), rgba(184, 134, 11, .06));
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
            color: var(--gold);
            font-size: 1.3rem;
            transition: .3s ease
        }

        .step:hover .step-icon {
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: var(--white);
            box-shadow: 0 4px 16px rgba(184, 134, 11, .25);
            transform: scale(1.1) rotate(-4deg)
        }

        .detail-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(212, 175, 55, .1), rgba(184, 134, 11, .06));
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto .8rem;
            color: var(--gold);
            font-size: 1.3rem;
            transition: .3s ease
        }

        .detail-card:hover .detail-icon {
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            color: var(--white);
            box-shadow: 0 4px 16px rgba(184, 134, 11, .25);
            transform: scale(1.1)
        }

        /* Step connector line */
        .steps {
            position: relative
        }

        .step {
            position: relative
        }

        @media(min-width:901px) {
            .step:not(:last-child)::after {
                content: '';
                position: absolute;
                top: 24px;
                right: -1rem;
                width: calc(2rem - 4px);
                height: 2px;
                background: linear-gradient(90deg, var(--gold-light), var(--gold));
                opacity: .25
            }
        }

        /* New animation classes */
        .blur-in {
            opacity: 0;
            filter: blur(12px);
            transform: translateY(30px);
            transition: opacity .8s ease, transform .8s cubic-bezier(.16, 1, .3, 1), filter .8s ease
        }

        .blur-in.in {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0)
        }

        .flip-in {
            opacity: 0;
            transform: perspective(600px) rotateX(-15deg) translateY(30px);
            transition: opacity .8s ease, transform .8s cubic-bezier(.16, 1, .3, 1)
        }

        .flip-in.in {
            opacity: 1;
            transform: perspective(600px) rotateX(0) translateY(0)
        }

        .rotate-in {
            opacity: 0;
            transform: rotate(-8deg) scale(.9) translateY(20px);
            transition: opacity .7s ease, transform .7s cubic-bezier(.16, 1, .3, 1)
        }

        .rotate-in.in {
            opacity: 1;
            transform: rotate(0) scale(1) translateY(0)
        }

        /* Stats widget */
        .stats-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            max-width: 760px;
            margin: 2.5rem auto 0
        }

        .stat-item {
            text-align: center;
            padding: 1.2rem;
            background: var(--white);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            transition: .3s ease;
            box-shadow: 0 2px 12px rgba(0, 0, 0, .04)
        }

        .stat-item:hover {
            border-color: rgba(184, 134, 11, .2);
            box-shadow: 0 8px 24px rgba(184, 134, 11, .06);
            transform: translateY(-2px)
        }

        .stat-num {
            font-family: 'Karla', sans-serif;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--gold);
            line-height: 1;
            margin-bottom: .3rem
        }

        .stat-label {
            font-size: .7rem;
            font-weight: 500;
            letter-spacing: .15em;
            text-transform: uppercase;
            color: var(--text-muted)
        }

        /* Live leaderboard preview */
        .live-dot {
            display: inline-block;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #e0245e;
            margin-right: .4rem;
            vertical-align: middle;
            box-shadow: 0 0 0 0 rgba(224, 36, 94, .6);
            animation: livePulse 1.8s infinite
        }

        @keyframes livePulse {
            0% {
                box-shadow: 0 0 0 0 rgba(224, 36, 94, .5)
            }

            70% {
                box-shadow: 0 0 0 9px rgba(224, 36, 94, 0)
            }

            100% {
                box-shadow: 0 0 0 0 rgba(224, 36, 94, 0)
            }
        }

        .lb-preview {
            max-width: 640px;
            margin: 2.5rem auto 0;
            display: flex;
            flex-direction: column;
            gap: .6rem
        }

        .lb-row {
            display: grid;
            grid-template-columns: 44px 1fr auto;
            align-items: center;
            gap: 1rem;
            padding: 1rem 1.4rem;
            background: var(--white);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, .04);
            transition: .3s ease
        }

        .lb-row:hover {
            border-color: rgba(184, 134, 11, .25);
            transform: translateX(2px)
        }

        .lb-row--lead {
            border-color: rgba(184, 134, 11, .45);
            background: linear-gradient(90deg, rgba(184, 134, 11, .07), var(--white) 60%)
        }

        .lb-rank {
            font-family: 'Karla', sans-serif;
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--gold);
            text-align: center
        }

        .lb-row--lead .lb-rank {
            color: #fff;
            background: var(--gold);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            line-height: 32px;
            margin: 0 auto
        }

        .lb-num {
            font-weight: 700;
            color: var(--text);
            font-size: 1rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap
        }

        .lb-score {
            font-family: 'Karla', sans-serif;
            font-weight: 700;
            font-size: 1.15rem;
            color: var(--gold)
        }

        .lb-empty {
            text-align: center;
            padding: 2.5rem 1.5rem;
            color: var(--text-muted);
            background: var(--white);
            border: 1px dashed var(--border-light);
            border-radius: 12px
        }

        /* About visual widget */
        .about-widget {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2rem;
            margin-top: 2rem;
            flex-wrap: wrap
        }

        .about-visual {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: var(--white);
            box-shadow: 0 8px 24px rgba(184, 134, 11, .2);
            animation: gentlePulse 3s ease-in-out infinite
        }

        @keyframes gentlePulse {

            0%,
            100% {
                transform: scale(1);
                box-shadow: 0 8px 24px rgba(184, 134, 11, .2)
            }

            50% {
                transform: scale(1.05);
                box-shadow: 0 12px 32px rgba(184, 134, 11, .3)
            }
        }

        .about-badge {
            display: inline-flex;
            align-items: center;
            gap: .4rem;
            padding: .4rem .8rem;
            background: rgba(184, 134, 11, .08);
            border: 1px solid rgba(184, 134, 11, .15);
            border-radius: 20px;
            font-size: .72rem;
            font-weight: 500;
            color: var(--gold);
            letter-spacing: .05em
        }

        .about-badge svg {
            width: 14px;
            height: 14px;
            color: var(--gold)
        }

        @media (prefers-reduced-motion: reduce) {

            .fade-up,
            .blur-in,
            .flip-in,
            .rotate-in,
            .slide-left,
            .slide-right,
            .scale-in {
                opacity: 1;
                transform: none;
                filter: none;
                transition: none
            }
        }
    </style>
</head>

<body>

    <nav class="nav" id="navbar">
        <div class="container">
            <div class="nav__inner">
                <a href="<?= site_url() ?>" class="nav__logo">
                    <img src="<?= base_url('assets/images/BB.MATI.png') ?>" class="nav__logo-img" alt="Binibining Mati logo">
                    <?= htmlspecialchars($config['site_name']) ?>
                </a>
                <div class="nav__cta">
                    <a href="<?= site_url('leaderboard') ?>">Leaderboard</a>
                    <a href="<?= site_url('login/login_page') ?>">Log In</a>
                </div>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <div class="hero__content">
                <img src="<?= base_url('assets/images/BB.MATI.png') ?>" class="hero__crown hero__logo" alt="Binibining Mati logo">

                <div class="hero__meta">
                    <span class="hero__label">Mati City, Davao Oriental</span>
                    <div class="hero__date"><?= htmlspecialchars($year) ?></div>
                </div>
                <h1 class="hero__title">Binibining Mati</h1>
                <p class="hero__sub">Experience Binibining Mati <?= htmlspecialchars($year) ?> with real-time scoring and live results. Follow every round, see the leaderboard, and witness the crowning moment.</p>
                <div class="hero__divider"></div>
                <div class="hero__actions">
                    <a href="<?= site_url('login/login_page') ?>" class="btn-gold">Judge Login</a>
                    <a href="#features" class="btn-outline-gold">Learn More</a>
                </div>
            </div>
        </div>
    </section>

    <section class="section section-dark candidate-gallery-section">
        <div class="container">
            <?php if (!empty($carousel_images)): ?>
                <div class="candidate-showcase fade-up">
                    <div class="candidate-carousel" data-candidate-carousel>
                        <button class="candidate-carousel__button candidate-carousel__button--prev" type="button" aria-label="Previous candidate" data-carousel-prev>&lsaquo;</button>
                        <div class="candidate-carousel__viewport">
                            <div class="candidate-carousel__track" data-carousel-track>
                                <?php foreach ($carousel_images as $i => $image): ?>
                                    <article class="candidate-slide">
                                        <figure class="candidate-photo">
                                            <img src="<?= htmlspecialchars($image['src']) ?>" alt="<?= htmlspecialchars($image['alt']) ?>" width="1040" height="1300" decoding="async" <?= $i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"' ?>>
                                        </figure>
                                    </article>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <button class="candidate-carousel__button candidate-carousel__button--next" type="button" aria-label="Next candidate" data-carousel-next>&rsaquo;</button>
                        <div class="candidate-carousel__dots" data-carousel-dots></div>
                        <div class="candidate-carousel__counter" aria-hidden="true"><span data-carousel-current>1</span><span class="candidate-carousel__counter-sep">/</span><span data-carousel-total>1</span></div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </section>

    <section class="section" id="leaderboard">
        <div class="container">
            <div class="section-header">
                <div class="divider"></div>
                <span class="section-label">Live</span>
                <h2 class="section-title">Live <em>Leaderboard</em></h2>
                <p class="section-sub">
                    <span class="live-dot"></span>
                    <?= htmlspecialchars($board['round_label']) ?> standings &middot; updates automatically
                </p>
            </div>
            <div class="lb-preview" id="lbPreview">
                <?php if (empty($board_top)): ?>
                    <div class="lb-empty">Scoring hasn't started yet. Standings will appear here live as judges submit their scores.</div>
                <?php else: ?>
                    <?php $rank = 1;
                    foreach ($board_top as $row): ?>
                        <div class="lb-row<?= $rank === 1 ? ' lb-row--lead' : '' ?>">
                            <span class="lb-rank"><?= $rank ?></span>
                            <span class="lb-num">#<?= htmlspecialchars($row['candidate_number']) ?></span>
                            <span class="lb-score"><?= number_format($row['score'], 2) ?></span>
                        </div>
                    <?php $rank++;
                    endforeach; ?>
                <?php endif; ?>
            </div>
            <div style="text-align:center;margin-top:2rem">
                <a href="<?= site_url('leaderboard') ?>" class="btn-gold">View Full Leaderboard</a>
            </div>
        </div>
    </section>

    <section class="section">
        <div class="container">
            <div class="section-header">
                <div class="divider"></div>
                <span class="section-label">Event Details</span>
                <h2 class="section-title">The <em>Coronation</em></h2>
            </div>
            <div class="event-details">
                <div class="detail-card rotate-in">
                    <div class="detail-label">Date</div>
                    <div class="detail-value"><?= $event && !empty($event->date) ? date('M j, Y', strtotime($event->date)) : 'To Be Announced' ?></div>
                </div>
                <div class="detail-card rotate-in">
                    <div class="detail-label">Venue</div>
                    <div class="detail-value"><?= htmlspecialchars($event && !empty($event->venue) ? $event->venue : 'Mati City, Davao Oriental') ?></div>
                </div>
                <div class="detail-card rotate-in">
                    <div class="detail-label">Categories</div>
                    <div class="detail-value"><?= (int)$stats['categories'] ?> Judging Categories</div>
                </div>
            </div>
        </div>
    </section>

    <section class="section section-dark" id="how-it-works">
        <div class="container">
            <div class="section-header">
                <div class="divider"></div>
                <span class="section-label">Experience</span>
                <h2 class="section-title">The <em>Competition</em></h2>
                <p class="section-sub">Follow the journey from opening to coronation night.</p>
            </div>
            <div class="steps">
                <div class="step flip-in">
                    <div class="step-num">01</div>
                    <h3 class="step-title">Opening Night</h3>
                    <p class="step-desc">The competition begins. Contestants take the stage for the first round.</p>
                </div>
                <div class="step flip-in">
                    <div class="step-num">02</div>
                    <h3 class="step-title">Judges Score</h3>
                    <p class="step-desc">Judges evaluate each category in real time through their private portals.</p>
                </div>
                <div class="step flip-in">
                    <div class="step-num">03</div>
                    <h3 class="step-title">Live Results</h3>
                    <p class="step-desc">Watch scores update instantly on the leaderboard as each round concludes.</p>
                </div>
                <div class="step flip-in">
                    <div class="step-num">04</div>
                    <h3 class="step-title">Coronation</h3>
                    <p class="step-desc">The final scores are revealed and the next Binibining Mati is crowned.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="section" id="features">
        <div class="container">
            <div class="section-header">
                <div class="divider"></div>
                <span class="section-label">Highlights</span>
                <h2 class="section-title">What to <em>Expect</em></h2>
                <p class="section-sub">Everything that makes this pageant experience unique and transparent.</p>
            </div>
            <div class="features-grid">
                <div class="feature-card blur-in">
                    <div class="feature-num">01</div>
                    <h3 class="feature-title">Live Leaderboard</h3>
                    <p class="feature-desc">Watch scores update in real time. See rankings shift as each round concludes.</p>
                </div>
                <div class="feature-card blur-in">
                    <div class="feature-num">02</div>
                    <h3 class="feature-title">Transparent Scoring</h3>
                    <p class="feature-desc">Every score is visible and accounted for. Full transparency from judges to crown.</p>
                </div>
                <div class="feature-card blur-in">
                    <div class="feature-num">03</div>
                    <h3 class="feature-title">Multiple Categories</h3>
                    <p class="feature-desc">Swimwear, evening gown, Q&amp;A, and more. Each round brings its own excitement.</p>
                </div>
                <div class="feature-card blur-in">
                    <div class="feature-num">04</div>
                    <h3 class="feature-title">Instant Results</h3>
                    <p class="feature-desc">No long waits. Final standings appear the moment judging ends for each round.</p>
                </div>
                <div class="feature-card blur-in">
                    <div class="feature-num">05</div>
                    <h3 class="feature-title">Mobile Friendly</h3>
                    <p class="feature-desc">Follow the competition on any device. Phone, tablet, or venue display.</p>
                </div>
                <div class="feature-card blur-in">
                    <div class="feature-num">06</div>
                    <h3 class="feature-title">Full Event History</h3>
                    <p class="feature-desc">Review scores from every round. See the journey from start to finish.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="cta-section">
        <div class="container">
            <h2 class="cta-title">Join the <em>Experience</em></h2>
            <p class="cta-sub">Follow the live leaderboard or access the judging portal.</p>
            <div class="hero__actions" style="margin-top:1.5rem">
                <a href="<?= site_url('login/login_page') ?>" class="btn-gold">Judge Login</a>
                <a href="<?= site_url('leaderboard') ?>" class="btn-outline-gold">View Leaderboard</a>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <p class="footer-copy">&copy; <?= $year ?> <?= htmlspecialchars($config['site_name']) ?>. All rights reserved.</p>
        </div>
    </footer>

    <script>
        const nav = document.getElementById('navbar');
        window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 48), {
            passive: true
        });

        const animObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const siblings = Array.from(el.parentElement.children);
                    const idx = siblings.indexOf(el);
                    const delay = (idx % 6) * 120;
                    setTimeout(() => el.classList.add('in'), delay);
                    animObserver.unobserve(el);
                }
            });
        }, {
            threshold: 0.08,
            rootMargin: '0px 0px -30px 0px'
        });

        document.querySelectorAll('.fade-up, .slide-left, .slide-right, .scale-in, .blur-in, .flip-in, .rotate-in').forEach(el => animObserver.observe(el));

        document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
            const t = document.querySelector(a.getAttribute('href'));
            if (t) {
                e.preventDefault();
                t.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }));

        (function() {
            const carousel = document.querySelector('[data-candidate-carousel]');
            if (!carousel) return;

            const track = carousel.querySelector('[data-carousel-track]');
            const viewport = carousel.querySelector('.candidate-carousel__viewport');
            const slides = Array.from(track.children);
            const prev = carousel.querySelector('[data-carousel-prev]');
            const next = carousel.querySelector('[data-carousel-next]');
            const dots = carousel.querySelector('[data-carousel-dots]');
            const counterCurrent = carousel.querySelector('[data-carousel-current]');
            const counterTotal = carousel.querySelector('[data-carousel-total]');
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            let index = 0;
            let timer = null;
            let dragging = false;
            let dragStartX = 0;
            let dragDelta = 0;

            function visibleCount() {
                return 1;
            }

            function maxIndex() {
                return Math.max(0, slides.length - visibleCount());
            }

            function slideStep() {
                const style = window.getComputedStyle(track);
                const gap = parseFloat(style.columnGap || style.gap) || 0;
                return slides[0].getBoundingClientRect().width + gap;
            }

            function setTrackOffset(offset = 0) {
                track.style.transform = 'translateX(' + (offset - (index * slideStep())) + 'px)';
            }

            function buildDots() {
                const count = maxIndex() + 1;
                dots.innerHTML = Array.from({
                    length: count
                }, (_, i) => '<button class="candidate-carousel__dot" type="button" aria-label="Show candidate slide ' + (i + 1) + '" data-carousel-dot="' + i + '"></button>').join('');
            }

            function updateDots() {
                dots.querySelectorAll('[data-carousel-dot]').forEach(dot => {
                    dot.classList.toggle('is-active', Number(dot.dataset.carouselDot) === index);
                });
            }

            function updateCounter() {
                if (counterCurrent) counterCurrent.textContent = index + 1;
                if (counterTotal) counterTotal.textContent = slides.length;
            }

            function render() {
                const max = maxIndex();
                index = Math.max(0, Math.min(index, max));
                setTrackOffset();
                prev.disabled = max === 0;
                next.disabled = max === 0;
                updateDots();
                updateCounter();
            }

            function move(delta) {
                const max = maxIndex();
                if (max === 0) return;
                index += delta;
                if (index < 0) index = max;
                if (index > max) index = 0;
                render();
            }

            function stop() {
                if (timer) window.clearInterval(timer);
                timer = null;
            }

            function start() {
                stop();
                if (reduceMotion.matches || maxIndex() === 0) return;
                timer = window.setInterval(() => move(1), 4500);
            }

            prev.addEventListener('click', () => {
                move(-1);
                start();
            });

            next.addEventListener('click', () => {
                move(1);
                start();
            });

            dots.addEventListener('click', event => {
                const dot = event.target.closest('[data-carousel-dot]');
                if (!dot) return;
                index = Number(dot.dataset.carouselDot);
                render();
                start();
            });

            carousel.addEventListener('keydown', event => {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    move(-1);
                    start();
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    move(1);
                    start();
                }
            });

            viewport.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (maxIndex() === 0) return;
                dragging = true;
                dragStartX = event.clientX;
                dragDelta = 0;
                stop();
                carousel.classList.add('is-dragging');
                viewport.setPointerCapture(event.pointerId);
            });

            viewport.addEventListener('pointermove', event => {
                if (!dragging) return;
                dragDelta = event.clientX - dragStartX;
                setTrackOffset(dragDelta);
            });

            function finishDrag() {
                if (!dragging) return;
                const threshold = Math.min(140, slideStep() * .25);
                dragging = false;
                carousel.classList.remove('is-dragging');

                if (dragDelta > threshold) {
                    move(-1);
                } else if (dragDelta < -threshold) {
                    move(1);
                } else {
                    render();
                }

                dragDelta = 0;
                start();
            }

            viewport.addEventListener('pointerup', finishDrag);
            viewport.addEventListener('pointercancel', finishDrag);
            viewport.addEventListener('lostpointercapture', finishDrag);
            carousel.addEventListener('mouseenter', stop);
            carousel.addEventListener('mouseleave', () => {
                if (!dragging) start();
            });
            carousel.addEventListener('focusin', stop);
            carousel.addEventListener('focusout', () => {
                if (!dragging) start();
            });
            window.addEventListener('resize', () => {
                buildDots();
                render();
                start();
            });

            buildDots();
            render();
            start();
        })();

        // ---- Live leaderboard preview (top 5, auto-refresh) ----
        (function() {
            const box = document.getElementById('lbPreview');
            if (!box) return;
            const esc = s => String(s).replace(/[&<>"']/g, c => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            } [c]));

            function render(rows) {
                if (!rows.length) {
                    box.innerHTML = '<div class="lb-empty">Scoring hasn\'t started yet. Standings will appear here live as judges submit their scores.</div>';
                    return;
                }
                box.innerHTML = rows.slice(0, 5).map((r, i) =>
                    '<div class="lb-row' + (i === 0 ? ' lb-row--lead' : '') + '">' +
                    '<span class="lb-rank">' + (i + 1) + '</span>' +
                    '<span class="lb-num">#' + esc(r.candidate_number) + '</span>' +
                    '<span class="lb-score">' + Number(r.score).toFixed(2) + '</span>' +
                    '</div>'
                ).join('');
            }

            async function refresh() {
                try {
                    const res = await fetch('<?= site_url('leaderboard/data') ?>', {
                        cache: 'no-store'
                    });
                    if (!res.ok) return;
                    const data = await res.json();
                    render(data.rows || []);
                } catch (e) {
                    /* keep last good render */
                }
            }
            setInterval(refresh, 10000);
        })();
    </script>
</body>

</html>
