# NEXAM hero motion graphic — integration

Deliverables (relative to this file):

- `renders/nexam-hero.mp4` — H.264 + yuv420p, 1920×1080, 30 fps, 8.0 s,
  ~8.9 Mbps, faststart. **Seamlessly loops** (first and last frames are
  pixel-identical).
- `renders/nexam-hero-poster.jpg` — 1920×1080, ~115 KB static fallback
  (the t=0 hero frame: Dashboard centered, Blueprint/Analytics flanking).

Composition rules baked into the video:

- **No text or CTAs are rendered in the video.** Keep all copy in the DOM
  (screen readers, responsive reflow, i18n).
- The hero panel sits slightly **right of center**; the left ~35% stays
  calm — that's where overlay copy reads best.
- All screenshots are real captures of the running app (light theme,
  blue accent).

## React usage

```jsx
export function HeroMotion() {
  return (
    <section className="hero">
      <video
        className="hero-media"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/nexam-hero-poster.jpg"
        aria-hidden="true"            /* decorative — copy lives below */
      >
        <source src="/media/nexam-hero.mp4" type="video/mp4" />
      </video>

      <div className="hero-copy">
        <h1>Less busywork. More thoughtful assessments.</h1>
        <p>Your materials, your expertise, one organized place.</p>
        <a className="cta" href="/register">Create account</a>
      </div>
    </section>
  );
}
```

```css
.hero { position: relative; overflow: hidden; }
.hero-media {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;               /* crops sides gracefully on mobile */
}
.hero-copy { position: relative; z-index: 1; }

@media (prefers-reduced-motion: reduce) {
  .hero-media { display: none; }
  .hero {
    background: url("/media/nexam-hero-poster.jpg") center / cover;
  }
}
```

Notes:

- `muted + playsInline` are required for iOS autoplay; the video is silent
  by design so nothing else is needed.
- `aria-hidden` on the `<video>` is correct because it conveys no
  information — don't move real content into the render.
- Copy the two files into `web/public/media/` (or the landing site's
  static dir) when wiring them up — they are intentionally not added to
  the app tree yet.

## Rebuilding

```bash
cd motion
npm run check          # lint + runtime + layout + motion
npm run dev            # Studio preview (or: npx hyperframes preview --background)
npx hyperframes render -q high -o renders/nexam-hero.mp4
ffmpeg -y -ss 0 -i renders/nexam-hero.mp4 -frames:v 1 -q:v 3 renders/nexam-hero-poster.jpg
```

Screens live in `assets/screens/`; refresh them with
`TOKEN=<jwt> node scripts/capture.mjs` (see that file for requirements).
