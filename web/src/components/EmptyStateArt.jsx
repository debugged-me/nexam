/**
 * EmptyStateArt — animated illustration for `.empty-state` blocks.
 *
 * `art` picks a module-specific animated SVG scene from `emptyArt.jsx`
 * ("inbox" | "paper" | "grid" | "docs" | "library" | "check" | "compass" |
 * "chart" | "spark" | "scan" | "flag" | "merge"). Without `art` it falls
 * back to the shared `emptyStateArt` Lottie (paper + magnifier).
 *
 * `tone` (1–8 → --gc-*) sets the scene's accent color; `icon` floats a
 * Lucide badge on the Lottie fallback only. Honors prefers-reduced-motion,
 * decorative only (aria-hidden), suppressed in print.
 */
import { LottieLight } from 'lottie-react';
import { useReducedMotion } from 'motion/react';
import emptyStateArt from '../assets/emptyStateArt.js';
import {
  InboxArt, PaperArt, GridArt, DocsArt, LibraryArt, CheckArt,
  CompassArt, ChartArt, SparkArt, ScanArt, FlagArt, MergeArt,
} from './emptyArt.jsx';

const SCENES = {
  inbox: InboxArt, paper: PaperArt, grid: GridArt, docs: DocsArt,
  library: LibraryArt, check: CheckArt, compass: CompassArt, chart: ChartArt,
  spark: SparkArt, scan: ScanArt, flag: FlagArt, merge: MergeArt,
};

export default function EmptyStateArt({ size = 140, art, icon: Icon, tone = 2 }) {
  const reduceMotion = useReducedMotion();
  const Scene = art && SCENES[art];
  return (
    <div className="empty-art" data-tone={tone} style={{ width: size, height: size * 0.75 }} aria-hidden="true">
      {Scene ? (
        <Scene />
      ) : (
        <>
          <LottieLight src={emptyStateArt} autoplay={!reduceMotion} loop style={{ width: '100%', height: '100%' }} />
          {Icon && (
            <span className="empty-art-badge">
              <Icon size={Math.max(13, Math.round(size * 0.12))} />
            </span>
          )}
        </>
      )}
    </div>
  );
}
