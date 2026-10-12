/**
 * emptyArt.jsx — module-specific animated SVG scenes for EmptyStateArt.
 *
 * Each scene is a compact inline SVG (viewBox 140×105) drawn from theme
 * tokens — `--art-wash` (set by `tone` on the wrapper) carries the module
 * accent, `--line-strong`/`--ink-faint`/`--surface-3` do the structure.
 * Animation is pure CSS via `.eart-*` classes in app.css, so scenes stay
 * dependency-free and honor prefers-reduced-motion globally.
 *
 * Shared visual language: 2px round-join strokes, dashed "ghost" details,
 * one moving accent element per scene.
 */

const P = {
  stroke: 'var(--line-strong)',
  faint: 'var(--ink-faint)',
  wash: 'var(--art-wash, var(--action-600))',
  fill: 'var(--surface-3)',
};

const svg = { viewBox: '0 0 140 105', width: '100%', height: '100%', role: 'presentation' };
const line = { fill: 'none', stroke: P.stroke, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const thin = { ...line, stroke: P.faint, strokeWidth: 1.5 };

/** Inbox tray with papers dropping in — "a container waiting to be filled". */
export function InboxArt() {
  return (
    <svg {...svg}>
      <g className="eart-drop">
        <rect x="52" y="8" width="36" height="46" rx="4" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <path d="M59 20h22M59 28h22M59 36h14" {...thin} />
      </g>
      <g className="eart-drop eart-delay-1">
        <rect x="74" y="16" width="30" height="38" rx="4" fill="var(--surface)" stroke={P.faint} strokeWidth="1.5" strokeDasharray="4 3" />
      </g>
      <path d="M28 62h84l-10 30H38z" {...line} />
      <path d="M28 62l14-16h56l14 16" {...line} />
      <rect x="58" y="76" width="24" height="6" rx="3" fill={P.wash} opacity=".85" />
    </svg>
  );
}

/** Answer sheet with A/B set tabs — exam artifacts. */
export function PaperArt() {
  return (
    <svg {...svg}>
      <g className="eart-float">
        <rect x="38" y="10" width="64" height="84" rx="5" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <rect x="46" y="20" width="22" height="10" rx="2" fill={P.wash} opacity=".9" />
        <path d="M72 24h22" {...thin} />
        {[38, 48, 58, 68, 78].map((y, i) => (
          <g key={y}>
            <circle cx="50" cy={y + 2} r="2.4" fill="none" stroke={P.faint} strokeWidth="1.5" />
            <path d={`M60 ${y + 2}h${i % 2 ? 20 : 30}`} {...thin} />
          </g>
        ))}
      </g>
      <g className="eart-float eart-delay-1">
        <rect x="92" y="30" width="22" height="14" rx="3" fill={P.fill} stroke={P.stroke} strokeWidth="1.5" />
        <path d="M97 37h12" {...thin} />
      </g>
      <g className="eart-float eart-delay-2">
        <rect x="26" y="34" width="22" height="14" rx="3" fill={P.fill} stroke={P.stroke} strokeWidth="1.5" />
        <path d="M31 41h12" {...thin} />
      </g>
    </svg>
  );
}

/** 3×3 specification matrix with cells lighting up in sequence — blueprint. */
export function GridArt() {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      cells.push(<rect key={`${r}${c}`} x={34 + c * 20} y={26 + r * 18} width="16" height="14" rx="3"
        className="eart-cell" style={{ animationDelay: `${(r * 4 + c) * 0.24}s` }}
        fill={P.wash} stroke={P.stroke} strokeWidth="1.2" fillOpacity=".9" />);
  return (
    <svg {...svg}>
      <path d="M34 14h70M34 80h70" {...thin} strokeDasharray="3 4" />
      <path d="M26 26v48M112 26v48" {...thin} strokeDasharray="3 4" />
      {cells}
      <circle cx="122" cy="18" r="4" {...line} />
      <circle cx="122" cy="88" r="4" {...line} />
    </svg>
  );
}

/** Stacked documents with the top sheet lifting away — materials upload. */
export function DocsArt() {
  return (
    <svg {...svg}>
      <rect x="48" y="34" width="48" height="60" rx="5" fill={P.fill} stroke={P.stroke} strokeWidth="1.5" />
      <rect x="42" y="26" width="48" height="60" rx="5" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
      <path d="M50 38h32M50 46h32M50 54h20" {...thin} />
      <g className="eart-lift">
        <rect x="62" y="8" width="44" height="52" rx="5" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <path d="M70 20h28M70 28h28M70 36h18" {...thin} />
        <path d="M108 44v-10m0 0l-4 5m4-5l4 5" {...line} stroke={P.wash} strokeWidth="2.5" />
      </g>
      <circle cx="38" cy="18" r="3" className="eart-twinkle" fill={P.wash} />
    </svg>
  );
}

/** Shelf with one book easing out — the institution bank. */
export function LibraryArt() {
  return (
    <svg {...svg}>
      <path d="M26 84h88" {...line} strokeWidth="3" />
      <rect x="36" y="38" width="14" height="46" rx="2" fill={P.fill} stroke={P.stroke} strokeWidth="1.8" />
      <rect x="54" y="30" width="14" height="54" rx="2" fill={P.fill} stroke={P.stroke} strokeWidth="1.8" />
      <g className="eart-slide">
        <rect x="72" y="26" width="16" height="58" rx="2" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <path d="M76 34h8M76 76h8" {...thin} />
      </g>
      <rect x="90" y="34" width="14" height="50" rx="2" fill={P.fill} stroke={P.stroke} strokeWidth="1.8" />
      <path d="M104 34l10 50" {...thin} />
      <circle cx="118" cy="24" r="3.5" className="eart-twinkle" fill={P.wash} />
    </svg>
  );
}

/** Review card with a checkmark that draws itself — approval gate. */
export function CheckArt() {
  return (
    <svg {...svg}>
      <rect x="40" y="16" width="60" height="74" rx="6" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
      <rect x="56" y="10" width="28" height="12" rx="4" fill={P.fill} stroke={P.stroke} strokeWidth="1.8" />
      <path d="M50 34h40M50 44h40" {...thin} />
      <path d="M50 62l8 8 18-18" className="eart-draw" fill="none" stroke={P.wash} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy="70" r="10" fill="none" stroke={P.wash} strokeWidth="2" opacity=".5" className="eart-pulse" />
    </svg>
  );
}

/** Compass with a swinging needle — the pipeline wizard. */
export function CompassArt() {
  return (
    <svg {...svg}>
      <circle cx="70" cy="52" r="34" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
      <circle cx="70" cy="52" r="26" {...thin} strokeDasharray="3 5" />
      <path d="M70 26v6M70 72v6M44 52h6M90 52h6" {...thin} />
      <g className="eart-needle">
        <path d="M70 34l6 18-6 18-6-18z" fill={P.wash} stroke={P.stroke} strokeWidth="1.5" />
      </g>
      <circle cx="70" cy="52" r="4" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
      <circle cx="112" cy="20" r="3" className="eart-twinkle" fill={P.wash} />
      <circle cx="30" cy="84" r="3" className="eart-twinkle eart-delay-2" fill={P.wash} />
    </svg>
  );
}

/** Bars rising on an axis — item analysis. */
export function ChartArt() {
  return (
    <svg {...svg}>
      <path d="M32 88h80M32 88V22" {...line} />
      <path d="M40 70h64M40 52h64M40 34h64" {...thin} strokeDasharray="3 4" />
      <rect x="46" y="46" width="14" height="42" rx="2" fill={P.wash} opacity=".45" className="eart-bar" />
      <rect x="66" y="30" width="14" height="58" rx="2" fill={P.wash} opacity=".7" className="eart-bar eart-delay-1" />
      <rect x="86" y="58" width="14" height="30" rx="2" fill={P.wash} opacity=".9" className="eart-bar eart-delay-2" />
    </svg>
  );
}

/** Orbit rings with twinkling stars — AI generation. */
export function SparkArt() {
  return (
    <svg {...svg}>
      <circle cx="70" cy="52" r="12" fill={P.wash} opacity=".9" className="eart-pulse" />
      <ellipse cx="70" cy="52" rx="34" ry="14" {...thin} transform="rotate(-16 70 52)" />
      <ellipse cx="70" cy="52" rx="34" ry="14" {...thin} transform="rotate(24 70 52)" />
      <circle cx="70" cy="52" r="26" {...thin} strokeDasharray="2 6" />
      <circle cx="40" cy="38" r="3" fill={P.wash} className="eart-orbit" />
      <path d="M104 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill={P.wash} className="eart-twinkle" />
      <path d="M30 74l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" fill={P.wash} className="eart-twinkle eart-delay-1" />
    </svg>
  );
}

/** Scanline sweeping down an OMR sheet — analytics/scans. */
export function ScanArt() {
  return (
    <svg {...svg}>
      <defs>
        <clipPath id="eart-scanclip"><rect x="42" y="12" width="56" height="80" rx="5" /></clipPath>
      </defs>
      <rect x="42" y="12" width="56" height="80" rx="5" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
      {[30, 40, 50, 60, 70].map((y) => (
        <g key={y}>
          <circle cx="54" cy={y} r="2.4" fill="none" stroke={P.faint} strokeWidth="1.4" />
          <circle cx="64" cy={y} r="2.4" fill="none" stroke={P.faint} strokeWidth="1.4" />
          <circle cx="74" cy={y} r="2.4" fill="none" stroke={P.faint} strokeWidth="1.4" />
          <circle cx="84" cy={y} r="2.4" fill="none" stroke={P.faint} strokeWidth="1.4" />
        </g>
      ))}
      <circle cx="64" cy="40" r="2.4" fill={P.wash} />
      <circle cx="84" cy="60" r="2.4" fill={P.wash} />
      <g clipPath="url(#eart-scanclip)">
        <rect x="40" y="12" width="60" height="8" fill={P.wash} opacity=".22" className="eart-sweep" />
        <path d="M40 20h60" {...line} stroke={P.wash} className="eart-sweep" />
      </g>
    </svg>
  );
}

/** Pulsing alert triangle — items needing attention. */
export function FlagArt() {
  return (
    <svg {...svg}>
      <path d="M70 22l36 62H34z" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M70 22l36 62H34z" className="eart-pulse" fill="none" stroke={P.wash} strokeWidth="2" opacity=".4" transform="scale(1.06)" transform-origin="70 60" />
      <path d="M70 44v18" {...line} stroke={P.wash} strokeWidth="3" />
      <circle cx="70" cy="74" r="3.4" fill={P.wash} className="eart-twinkle" />
      <circle cx="112" cy="30" r="3" className="eart-twinkle eart-delay-1" fill={P.faint} />
      <circle cx="30" cy="26" r="3" className="eart-twinkle eart-delay-2" fill={P.faint} />
    </svg>
  );
}

/** Two overlapping cards converging into one — similarity dedupe. */
export function MergeArt() {
  return (
    <svg {...svg}>
      <g className="eart-merge-a">
        <rect x="30" y="26" width="44" height="56" rx="6" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <path d="M38 40h28M38 50h28M38 60h16" {...thin} />
      </g>
      <g className="eart-merge-b">
        <rect x="66" y="26" width="44" height="56" rx="6" fill="var(--surface)" stroke={P.stroke} strokeWidth="2" />
        <path d="M74 40h28M74 50h28M74 60h16" {...thin} />
      </g>
      <circle cx="70" cy="54" r="7" fill={P.wash} className="eart-pulse" />
      <path d="M70 51v6M67 54h6" {...line} stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

// Scene names for the `art` prop: inbox, paper, grid, docs, library,
// check, compass, chart, spark, scan, flag, merge.
