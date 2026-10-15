# Nexam landing — scrollcraft brief

Interviewed via structured prompt; four binding answers returned by the owner.
Remaining Step 0 fields are authored decisions, marked. Brand source of truth:
the running Nexam app (real screens, real blueprint data, real fonts, brand
accent `--brand-accent: #2D93E8`).

## The eight topics

1. **Vibe** (from the original creative direction, verbatim):
   "Apple-inspired product presentation, sophisticated typography, smooth
   movements, restrained blue and silver accents, elegant transitions."
   References: Apple keynote stage decks; the product's own blueprint UI.
   *(authored: no external references supplied beyond the Apple direction.)*
2. **Scroll journey** *(authored, derived from the product's own pipeline)*:
   a calm open → a blueprint assembling itself → the finished paired exam →
   the results arriving → the ask. Five sections, one working day.
3. **Energy curve**: calm, ordered open → rising intensity through the
   blueprint dwell → assured, quiet middle → a resolved landing. Never loud.
4. **Feeling curve** (one line per leg, cause second):
   - The desk — *calm*: a workspace already tidy before you touch anything.
   - The blueprint — *awe*: the real spec matrix assembles row by row under
     your hand while the live screen glides behind it.
   - The exam — *competence*: Set A and Set B, keys, OMR sheets, done.
   - The readout — *trust*: answer sheets scan back in; analytics land.
   - Home — *resolve*: the world returns to the desk and stays there.
5. **One thing no site does** (owner-chosen direction): the blueprint
   assembles live — a real Table of Specifications (20 topics, 54 hours,
   50 items, six Bloom levels, all pulled from the actual product database)
   fills cell by cell as you scroll.
6. **Range**: premium-minimal. Apple's register, not brutalist, not maximal.
7. **Sectioned, Apple-style** (owner-chosen, revised on review): the first
   build shipped worldflight — one fixed stage, legs crossfading in place —
   and the owner rejected it ("only 1 page? i though its like apple"). The
   shipped page is distinct sections with real document rhythm: clean hero,
   pinned arguments, a lateral rail, a closing ask.
8. **Assets owned**: 16 real captured app screens (light theme, instructor
   account, real data), the cover-flow render built from them, brand faces
   Sora (display) + SF Pro (text), the Nexam bolt mark. No generation needed;
   nothing is invented.

## The single belief (owner-chosen)

"The whole workflow, one place." — syllabus in, exam out, results back,
without leaving Nexam.

## The one action (owner-chosen)

**Create account** — one label, used in the top bar and the finale. Links to
`/register` on the app host.

## The peak

§2, the blueprint. Longest pinned act (3.4vh span), and the signature move
lives inside it. The sentence a visitor tells a friend:

> "The exam blueprint filled itself in while I scrolled — every topic, every
> hour, every Bloom cell, and it was their real data."

## Tell-someone

It's the site where you fly through the product itself and watch a real
blueprint assemble under your hand.

## Authored silence

The whitespace between sections is the design — the Apple register breathes.
Inside acts, every scroll region either advances the matrix, the rail, or the
counters; a frozen span inside a pinned act is a defect, not intent.

## Grammar pick

**Chaptered editorial** — discrete sections in document flow, pinned acts
inside them. Owner's explicit redirect after reviewing the worldflight build
("Apple-style sections"). The others lost because:

- Continuous world (worldflight) shipped first and read as one long panel —
  exactly what the owner rejected.
- Filmic one-shot has the same fixed-stage problem, plus hidden cuts.
- Live surface requires an operable product surface; this is a marketing page
  presenting real captured screens, not running the app.
- Typographic poster wastes the real product footage that anchors the brand.
- Gallery answers "what are the options"; this page answers "what does it do".
- Split stage needs a two-sided argument; the pitch is a journey, not a balance.
- Rhythmic cutlist is the wrong energy for an assessment tool faculty must
  trust.

## Fingerprint gate

First build in this workspace. Registry is empty; nothing to clear.

## Score (section table — chaptered editorial, act mode)

As shipped: five sections, ~13 viewport-heights total. Three devices inside
document flow — `flow` ×2, `pin` ×2, `pan` ×1 — never the same pinned device
twice in a row.

| § | Section | Device | Span | Feeling | What scroll does |
|---|---------|--------|------|---------|------------------|
| 1 | Start | flow | — | calm | Headline + live product card (the 8s cover-flow loop, autoplaying) rise in on entry |
| 2 | Blueprint | pin | 3.4vh | awe (PEAK) | Real spec matrix assembles row-by-row off `--sc-p`; copy cues hand off claim → mechanism → proof |
| 3 | Exam | pan | 4.6vh | competence | Lateral rail of real crops: heading card → Set A → Set B → Export → resolve card |
| 4 | Readout | pin | 2.8vh | trust | Counters scrub (26 sheets / 55.5% avg / 2 flagged) beside the real analytics screen |
| 5 | Join | flow | — | resolve | Statement + the CTA + wordmark footer |

Cue windows:

- blueprint: head `"0 0.52 0"` (greet) · sub `"0.14 0.8"` · proof `"0.55 1"`
  (closes at 1 — middle act)
- readout: head `"0 0.55 0"` (greet) · stats `"0.12 0.85"` · sub `"0.52 1"`
- exam: no cues — the rail heading card is the act's ground (always present)
- join: `data-sc-in` stagger — flow sections reveal once on entry

Nav = the route rail: fixed section map (right edge on desktop, dot row on
mobile), clickable, active stop follows the section under the viewport's
midline; slim top bar carries the bolt wordmark and the one CTA label.

Assets: `nexam-hero.mp4`/poster (the loop render) in the hero card; crops of
the real exam-detail screen for the rail; the real analytics screen for the
readout. The five `leg*.mp4` worldflight segments remain in `assets/` as the
archived experiment — unreferenced by this page.
