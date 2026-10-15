# NEXAM — Hero Motion Graphic · Storyboard

**Deliverable:** 8 s looping motion graphic, 1920×1080 @ 30 fps, silent.
**Direction:** Apple-keynote restraint — a silver studio stage, real product
screens floating in shallow 3D space, one dominant move (the cover-flow
advance), a specular sheen, and a perfectly seamless loop.
**Copy policy:** no headline, caption, or CTA is baked into the video —
React renders all text as accessible HTML over/around it.

## Cast (real captures, `assets/screens/`, shot @2x)

| Slot | Screen | Route captured | Why |
| ---- | ------ | -------------- | --- |
| A | `dashboard.png` | `/dashboard` | KPI cards + to-do + outcome donut — the product at a glance |
| B | `tos-detail.png` | `/tos/<id>` | Blueprint: Bloom bars + specification matrix — the "planning" story |
| C | `exam-detail.png` | `/exams/<id>` | Set A/Set B papers, keys, QR-OMR, exports — the deliverable |
| D | `exam-analytics.png` | `/analytics/exam/<id>` | Mastery bars + cognitive radar — the payoff |

Narrative arc: **Overview → Blueprint → Exam → Insight** (the instructor's
workflow in order), then wraps back to Overview.

## Stage

- Silver radial backdrop (`#fbfcfe` → `#dfe4ec`), faint blue glow
  breathing at top (period = loop), static vignette, soft floor band.
- Screens are 1180×698 browser-chrome cards (16 px radius, hairline
  border, dot strip), riding a true-perspective stage
  (`perspective: 1500`, `rotateX 3°` on the world).
- Right-of-center bias (stage center x≈1000) leaves the left third
  calm for the React overlay.

## The move — cover-flow advance (block law, loop-safe)

8 slots on the rail = the 4 screens duplicated once (`D′ A B C D A′ B′ C′`),
so the last frame is pixel-identical to the first. A virtual position `c`
steps 1→5 across the loop; each screen's pose is a pure function of its
distance from center `rel = i − c`:

| rel | x | z | rotY | scale | opacity | brightness | ring | sheen |
| --- | --- | ---- | ---- | ----- | ------- | ---------- | ---- | ----- |
| 0   | 0    | 0    | 0°   | 1.00 | 1.00 | 1.00 | on  | .50 |
| ±1  | ±560 | −120 | ∓18° | .90  | .72  | .88  | off | .18 |
| ±2  | ±1120| −240 | ∓30° | .80  | 0    | .80  | off | 0   |
| ≥3  | ±1680| −360 | ∓36° | .70  | 0    | .75  | off | 0   |

Each advance reuses the block's **throw-and-catch** law: a fast
`power4.out` whip covering 90% of the hop, then a `power2.out` long-tail
settle (0.64 s total). Hero screens get the blue ring + diagonal sheen;
each card carries a soft floor-contact shadow.

## Beats

| t (s)    | Action |
| -------- | ------ |
| 0.0–1.55 | **Dashboard** holds hero (loop-clean poster frame) |
| 1.55–2.19| Advance → **Blueprint** hero |
| 2.19–3.55| Blueprint dwell |
| 3.55–4.19| Advance → **Exam detail** hero |
| 4.19–5.55| Exam dwell |
| 5.55–6.19| Advance → **Analytics** hero |
| 6.19–7.28| Analytics dwell |
| 7.28–7.92| Advance → **Dashboard′** lands at the exact t=0 pose |
| 8.0      | = frame 0 → seamless |

Ambient, all loop-periodic: stage breathe `scale 1→1.025→1` (8 s),
blue glow swell (8 s), sheen positions ride `rel`.

## Outputs

- `renders/nexam-hero.mp4` — H.264, faststart, 1920×1080, 8 s.
- `renders/nexam-hero-poster.jpg` — t=0 poster (static fallback).
- React layer supplies headline, sub-copy, CTA buttons as HTML.
