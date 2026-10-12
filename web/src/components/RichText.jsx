/**
 * RichText — renders question text with LaTeX math typeset by KaTeX.
 *
 *   <RichText as="p" className="rv-stem" text={question.stem} />
 *
 * Recognised delimiters: \( … \) and $ … $ inline, \[ … \] and $$ … $$
 * display. A single $ follows Pandoc's rule — the opening $ must touch a
 * non-space, the closing $ must follow a non-space and not precede a digit —
 * so prices like "$5 and $10" stay plain text; \$ is a literal dollar sign.
 *
 * Text without math renders as a plain string and never loads KaTeX; the
 * library and its stylesheet are fetched on first use. Only math segments go
 * through KaTeX (trust off, so no \href/\url or raw HTML); everything else is
 * ordinary React text.
 */
import { useEffect, useMemo, useState } from 'react';
import { splitMath } from '../lib/mathText.js';

const KATEX_OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: 'ignore',
  output: 'htmlAndMathml',
  maxSize: 40,
  maxExpand: 200,
};

let katexLib = null;
let katexLoading = null;

function loadKatex() {
  if (!katexLoading) {
    katexLoading = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([mod]) => { katexLib = mod.default || mod; return katexLib; });
  }
  return katexLoading;
}

export default function RichText({ text, as: Tag = 'span', className }) {
  const segments = useMemo(() => splitMath(text), [text]);
  const hasMath = segments.some((seg) => seg.math);
  const [katex, setKatex] = useState(() => katexLib);

  useEffect(() => {
    if (!hasMath || katex) return undefined;
    let alive = true;
    loadKatex().then((lib) => { if (alive) setKatex(() => lib); }).catch(() => {});
    return () => { alive = false; };
  }, [hasMath, katex]);

  if (!hasMath) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag className={className}>
      {segments.map((seg, i) => {
        if (!seg.math) return <span key={i}>{seg.value}</span>;
        const cls = seg.display ? 'rt-math rt-math--display' : 'rt-math';
        // Until KaTeX arrives (or if it fails to load) show the source.
        if (!katex) return <code key={i} className={`${cls} is-pending`}>{seg.value}</code>;
        const html = katex.renderToString(seg.value, { ...KATEX_OPTIONS, displayMode: seg.display });
        return <span key={i} className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </Tag>
  );
}
