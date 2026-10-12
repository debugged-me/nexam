/**
 * LMS export service — converts questions to Moodle GIFT and Canvas XML.
 *
 * Moodle GIFT format: https://docs.moodle.org/en/GIFT_format
 * Canvas QTI XML: simplified Canvas-compatible XML for import.
 *
 * Both formats only support the objective question types in scope:
 * mcq, true_false, matching, identification (short answer).
 */
import { answerOptionIndex, parseMatchingLetters } from './scoring.js';

/** Resolve an MCQ stored answer (letter or option text) to an option index. */
function correctOptionIndex(options, answer) {
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  return answerOptionIndex(opts, answer);
}

/**
 * Convert questions to Moodle GIFT format.
 * @param {Array} questions — [{ type, stem, options, answer, explanation }]
 * @returns {string} GIFT text
 */
export function toGIFT(questions) {
  return questions.map((q, i) => {
    const title = `Q${i + 1}`;
    const stem = escapeGIFT(q.stem);
    const feedback = q.explanation ? `#### ${escapeGIFT(q.explanation)}` : '';

    switch (q.type) {
      case 'mcq':
        return formatMCQGIFT(title, stem, q.options, q.answer, feedback);
      case 'true_false':
        return formatTrueFalseGIFT(title, stem, q.answer, feedback);
      case 'matching':
        return formatMatchingGIFT(title, stem, q.options, q.answer, feedback);
      case 'identification':
        return formatShortAnswerGIFT(title, stem, q.answer, feedback);
      default:
        return `// Unsupported question type: ${q.type}\n`;
    }
  }).join('\n\n');
}

/**
 * Convert questions to Canvas-compatible QTI XML.
 * @param {Array} questions
 * @returns {string} XML text
 */
export function toCanvasXML(questions) {
  const items = questions.map((q, i) => formatCanvasItem(q, i + 1)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop version="2.1" xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="nexam_export" title="Nexam Export">
    <section ident="section_1">
${items}
    </section>
  </assessment>
</questestinterop>`;
}

// ── GIFT formatters ──────────────────────────────────

function formatMCQGIFT(title, stem, options, answer, feedback) {
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  const correctIdx = correctOptionIndex(opts, answer);
  const lines = opts.map((opt, i) => {
    const optText = escapeGIFT(stripOptionLetter(opt));
    return `${i === correctIdx ? '=' : '~'}${optText}`;
  });
  return `::${title}::${stem}{\n${lines.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`;
}

function formatTrueFalseGIFT(title, stem, answer, feedback) {
  const isTrue = answer && answer.toLowerCase().startsWith('true');
  return `::${title}::${stem}{${isTrue ? 'T' : 'F'}${feedback ? `\n${feedback}` : ''}}`;
}

function formatMatchingGIFT(title, stem, options, answer, feedback) {
  // GIFT matching: =item -> match. Stored answers use "1-B, 2-A" letter refs
  // into an implicit A–E match column; text-pair answers export the text.
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  const letters = parseMatchingLetters(answer);
  const pairs = letters || parseMatchingAnswer(answer);
  const lines = opts.map((opt, i) => {
    const match = pairs[i] || '';
    return `=${escapeGIFT(opt)} -> ${escapeGIFT(match)}`;
  });
  return `::${title}::${stem}{\n${lines.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`;
}

function formatShortAnswerGIFT(title, stem, answer, feedback) {
  return `::${title}::${stem}{=${escapeGIFT(answer || '')}${feedback ? `\n${feedback}` : ''}}`;
}

// ── Canvas XML formatters ────────────────────────────

function formatCanvasItem(q, num) {
  const ident = `q_${num}`;
  const stem = escapeXML(q.stem);
  const feedback = q.explanation ? `<itemfeedback ident="response"><flow_mat><material><mattext texttype="text/html">${escapeXML(q.explanation)}</mattext></material></flow_mat></itemfeedback>` : '';

  switch (q.type) {
    case 'mcq':
      return formatCanvasMCQ(ident, num, stem, q.options, q.answer, feedback);
    case 'true_false':
      return formatCanvasTrueFalse(ident, num, stem, q.answer, feedback);
    case 'matching':
      return formatCanvasMatching(ident, num, stem, q.options, q.answer, feedback);
    case 'identification':
      return formatCanvasShortAnswer(ident, num, stem, q.answer, feedback);
    default:
      return `<!-- Unsupported: ${q.type} -->`;
  }
}

function formatCanvasMCQ(ident, num, stem, options, answer, feedback) {
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  const responses = opts.map((opt, i) => {
    const optText = escapeXML(stripOptionLetter(opt));
    return `<response_label ident="${i + 1}"><flow_mat><material><mattext texttype="text/html">${optText}</mattext></material></flow_mat></response_label>`;
  }).join('');

  const correctIdx = correctOptionIndex(opts, answer);
  const correctResp = correctIdx >= 0 ? `<varequal respident="${correctIdx + 1}"/>` : '';

  return `<item ident="${ident}" title="Q${num}">
  <presentation><material><mattext texttype="text/html">${stem}</mattext></material>
    <response_lid ident="response_1" rcardinality="Single">
      <render_choice>${responses}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing><outcomes><decvar varname="SCORE" vtype="Integer" minvalue="0" maxvalue="1" defaultval="0"/></outcomes>
    <respcondition><conditionvar>${correctResp}</conditionvar><setvar varname="SCORE" action="Set">1</setvar>${feedback}</respcondition>
  </resprocessing>
</item>`;
}

function formatCanvasTrueFalse(ident, num, stem, answer, feedback) {
  const isTrue = answer && answer.toLowerCase().startsWith('true');
  return `<item ident="${ident}" title="Q${num}">
  <presentation><material><mattext texttype="text/html">${stem}</mattext></material>
    <response_lid ident="response_1" rcardinality="Single">
      <render_choice>
        <response_label ident="T"><flow_mat><material><mattext>True</mattext></material></flow_mat></response_label>
        <response_label ident="F"><flow_mat><material><mattext>False</mattext></material></flow_mat></response_label>
      </render_choice>
    </response_lid>
  </presentation>
  <resprocessing><outcomes><decvar varname="SCORE" vtype="Integer" minvalue="0" maxvalue="1" defaultval="0"/></outcomes>
    <respcondition><conditionvar><varequal respident="${isTrue ? 'T' : 'F'}"/></conditionvar><setvar varname="SCORE" action="Set">1</setvar>${feedback}</respcondition>
  </resprocessing>
</item>`;
}

function formatCanvasMatching(ident, num, stem, options, answer, feedback) {
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  const pairs = parseMatchingAnswer(answer);
  const responses = opts.map((opt, i) => {
    const match = escapeXML(pairs[i] || '');
    return `<response_label ident="${i + 1}"><flow_mat><material><mattext>${escapeXML(opt)}</mattext></material></flow_mat></response_label>`;
  }).join('');

  return `<item ident="${ident}" title="Q${num}">
  <presentation><material><mattext texttype="text/html">${stem}</mattext></material>
    <response_lid ident="response_1" rcardinality="Single">
      <render_choice>${responses}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing><outcomes><decvar varname="SCORE" vtype="Integer" minvalue="0" maxvalue="1" defaultval="0"/></outcomes>
    <respcondition><conditionvar><varequal respident="1"/></conditionvar><setvar varname="SCORE" action="Set">1</setvar>${feedback}</respcondition>
  </resprocessing>
</item>`;
}

function formatCanvasShortAnswer(ident, num, stem, answer, feedback) {
  return `<item ident="${ident}" title="Q${num}">
  <presentation><material><mattext texttype="text/html">${stem}</mattext></material>
    <response_str ident="response_1" rcardinality="Single"><render_fib fibtype="String"/></response_str>
  </presentation>
  <resprocessing><outcomes><decvar varname="SCORE" vtype="Integer" minvalue="0" maxvalue="1" defaultval="0"/></outcomes>
    <respcondition><conditionvar><varequal respident="response_1">${escapeXML(answer || '')}</varequal></conditionvar><setvar varname="SCORE" action="Set">1</setvar>${feedback}</respcondition>
  </resprocessing>
</item>`;
}

// ── Helpers ──────────────────────────────────────────

function escapeGIFT(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/~/g, '\\~')
    .replace(/=/g, '\\=')
    .replace(/#/g, '\\#')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/:/g, '\\:')
    .replace(/\n/g, ' ');
}

function escapeXML(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripOptionLetter(option) {
  // Remove leading "A) ", "B) ", "A. ", etc.
  return String(option).replace(/^[A-Z][).]\s*/i, '');
}

function parseMatchingAnswer(answer) {
  // Parse "1-B, 2-A, 3-D, 4-C" format
  if (!answer) return [];
  const pairs = {};
  answer.split(',').forEach((pair) => {
    const [left, right] = pair.trim().split('-');
    if (left && right) {
      pairs[parseInt(left.trim(), 10) - 1] = right.trim();
    }
  });
  return Object.values(pairs);
}

export default { toGIFT, toCanvasXML, parseGIFT, parseCanvasXML };

// ── GIFT parser ──────────────────────────────────────

/**
 * Parse Moodle GIFT format text into question objects.
 *
 * Supports: MCQ, True/False, Short Answer (identification), Matching.
 * Handles ::title::, escaped chars, =correct/~wrong, T/F, and feedback.
 *
 * @param {string} text — GIFT format text
 * @returns {Array} questions — [{ type, stem, options, answer, explanation }]
 */
export function parseGIFT(text) {
  const questions = [];
  // GIFT spec separates questions with blank lines, but many exporters use
  // single newlines. Normalize: ensure each ::Title:: or stem{...} starts on
  // its own line, then split on blank lines OR on ::Q boundaries.
  let blocks;

  if (/\n\s*\n/.test(text)) {
    // Has blank-line separators — use them
    blocks = text.split(/\n\s*\n/);
  } else {
    // No blank lines — split on ::Q patterns (each question starts with ::)
    // This handles single-newline-separated GIFT files
    blocks = text.split(/(?=^::)/m);
    // If no :: prefixes found at all, fall back to line blocks.
    // (A single :: block is legitimate — don't shred it into lines.)
    if (blocks.length === 1 && !blocks[0].trim().startsWith('::')) {
      blocks = text.split(/\n/).reduce((acc, line) => {
        if (line.trim() && !line.trim().startsWith('//')) {
          acc.push(line);
        }
        return acc;
      }, []);
    }
  }

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const q = parseGIFTBlock(trimmed);
    if (q) questions.push(q);
  }
  return questions;
}

function parseGIFTBlock(block) {
  // Pattern: ::title::stem{answers} with optional #### feedback
  // The title is optional; the stem is everything between ::title:: and {
  let title = '';
  let stem = '';
  let answerPart = '';
  let feedback = '';

  // Extract feedback (#### ...) — appears before closing }
  const feedbackMatch = block.match(/####\s*(.+?)\}/);
  if (feedbackMatch) {
    feedback = unescapeGIFT(feedbackMatch[1].trim());
  }

  // Try ::Title::stem{...}
  const titled = block.match(/^::(.*?)::(.*)\{(.*)\}\s*$/s);
  if (titled) {
    title = unescapeGIFT(titled[1].trim());
    stem = unescapeGIFT(titled[2].trim());
    answerPart = titled[3].replace(/####.*$/, '').trim();
  } else {
    // Untitled: stem{...}
    const untitled = block.match(/^(.*)\{(.*)\}\s*$/s);
    if (!untitled) return null;
    stem = unescapeGIFT(untitled[1].trim());
    answerPart = untitled[2].replace(/####.*$/, '').trim();
  }

  if (!stem) return null;

  // Detect question type from answer part
  // True/False: just T or F
  if (/^(T|F|TRUE|FALSE)\s*$/i.test(answerPart)) {
    return {
      type: 'true_false',
      stem,
      options: null,
      answer: /^T/i.test(answerPart) ? 'True' : 'False',
      explanation: feedback || null,
    };
  }

  // Matching: =item -> match (contains -> arrows)
  if (/->/.test(answerPart)) {
    const pairs = answerPart.split(/\s+(?==)/);
    const options = [];
    const matches = [];
    for (const pair of pairs) {
      const m = pair.match(/^=(.+?)\s*->\s*(.+)$/);
      if (m) {
        options.push(unescapeGIFT(m[1].trim()));
        matches.push(unescapeGIFT(m[2].trim()));
      }
    }
    if (options.length > 0) {
      // Answer format: "1-B, 2-A, 3-D, 4-C"
      const answer = matches.map((m, i) => `${i + 1}-${m}`).join(', ');
      return { type: 'matching', stem, options, answer, explanation: feedback || null };
    }
  }

  // MCQ: =correct ~wrong ~wrong — requires at least one ~ distractor,
  // otherwise "=answer" is a short-answer (identification) question.
  if (answerPart.includes('~')) {
    // Split on whitespace that precedes a = or ~ marker, so multi-word
    // options like "=New York ~Los Angeles" stay intact.
    const parts = answerPart.split(/\s+(?=[=~])/);
    const options = [];
    let answer = '';
    for (const part of parts) {
      const isCorrect = part.startsWith('=');
      const text = unescapeGIFT(part.replace(/^[=~]/, '').trim());
      if (!text) continue;
      options.push(text);
      if (isCorrect) answer = text;
    }
    if (options.length > 0) {
      return { type: 'mcq', stem, options, answer, explanation: feedback || null };
    }
  }

  // Short answer: =answer
  if (answerPart.startsWith('=')) {
    const answer = unescapeGIFT(answerPart.replace(/^=/, '').trim());
    return { type: 'identification', stem, options: null, answer, explanation: feedback || null };
  }

  // Fallback: try as short answer with the whole answer part
  if (answerPart) {
    return {
      type: 'identification',
      stem,
      options: null,
      answer: unescapeGIFT(answerPart),
      explanation: feedback || null,
    };
  }

  return null;
}

function unescapeGIFT(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\([\\~=#{}:])/g, '$1')
    .replace(/\\n/g, '\n')
    .trim();
}

// ── Moodle XML parser ────────────────────────────────

/**
 * Moodle <text> content → plain text. Moodle text is HTML carried inside
 * XML, so it is decoded in two layers: the XML layer (CDATA verbatim, other
 * runs XML-unescaped), then the HTML layer (tags stripped, entities such as
 * &#x27; or &rsquo; decoded). Doing either layer partially is how
 * "school&#x27;s" leaked into imported stems.
 */
function moodleText(xmlFragment) {
  if (!xmlFragment) return '';
  return htmlToText(xmlLayer(xmlFragment));
}

/** Pull the inner <text>…</text> of the first element matching `tag`. */
function moodleField(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<text[^>]*>([\\s\\S]*?)<\\/text>[\\s\\S]*?<\\/${tag}>`, 'i'));
  return m ? moodleText(m[1]) : '';
}

/** Inner text of the first <text>…</text> in a fragment. */
function firstText(block) {
  const m = String(block || '').match(/<text[^>]*>([\s\S]*?)<\/text>/i);
  return m ? moodleText(m[1]) : '';
}

/**
 * Parse Moodle question-bank XML (<quiz><question type="…">).
 * Category entries are structural and filtered out entirely.
 * Supported: multichoice, truefalse, shortanswer (→identification), matching.
 * Other types are emitted with their Moodle type so the normalizer can
 * report them as skipped instead of silently losing them.
 */
export function parseMoodleXML(xmlText) {
  const questions = [];
  const qRegex = /<question\b[^>]*\btype="([^"]*)"[^>]*>([\s\S]*?)<\/question>/gi;
  let qm;
  while ((qm = qRegex.exec(xmlText)) !== null) {
    const [, moodleType, body] = qm;
    if (moodleType === 'category') continue;

    const name = moodleField(body, 'name');
    const stem = moodleField(body, 'questiontext') || name;
    const explanation = moodleField(body, 'generalfeedback') || null;

    // All <answer fraction="…"> options (multichoice/truefalse/shortanswer)
    const answers = [];
    const aRegex = /<answer\b[^>]*\bfraction="([^"]*)"[^>]*>([\s\S]*?)<\/answer>/gi;
    let am;
    while ((am = aRegex.exec(body)) !== null) {
      answers.push({ fraction: parseFloat(am[1]) || 0, text: firstText(am[2]) });
    }

    if (moodleType === 'truefalse') {
      const correct = answers.find((a) => a.fraction > 0);
      questions.push({
        type: 'true_false', stem, options: null,
        answer: correct && /^t/i.test(correct.text) ? 'True' : correct ? 'False' : '',
        explanation,
      });
      continue;
    }

    if (moodleType === 'multichoice') {
      const correct = answers.filter((a) => a.fraction > 0);
      if (correct.length > 1) {
        // Multiple-correct items don't map to a single-answer MCQ.
        questions.push({ type: `moodle_multichoice_multi_${correct.length}`, stem, options: answers.map((a) => a.text), answer: '', explanation });
      } else {
        questions.push({
          type: 'mcq', stem,
          options: answers.map((a) => a.text),
          answer: correct[0]?.text || '',
          explanation,
        });
      }
      continue;
    }

    if (moodleType === 'shortanswer') {
      const best = answers.filter((a) => a.fraction > 0).sort((a, b) => b.fraction - a.fraction)[0];
      questions.push({ type: 'identification', stem, options: null, answer: best?.text || '', explanation });
      continue;
    }

    if (moodleType === 'matching') {
      const premises = [];
      const matches = [];
      const sRegex = /<subquestion\b[^>]*>([\s\S]*?)<\/subquestion>/gi;
      let sm;
      while ((sm = sRegex.exec(body)) !== null) {
        const premise = firstText(sm[1]);
        const match = firstText(sm[1].match(/<answer\b[^>]*>([\s\S]*?)<\/answer>/i)?.[1] || '');
        if (!premise) continue; // blank spacer subquestions
        premises.push(premise);
        matches.push(match);
      }
      questions.push({
        type: 'matching', stem,
        options: premises,
        answer: matches.map((m, i) => `${i + 1}-${m}`).join(', '),
        explanation,
      });
      continue;
    }

    // essay / numerical / cloze / ddwtos etc. — unsupported, report it
    questions.push({ type: `moodle_${moodleType}`, stem, options: null, answer: '', explanation });
  }
  return questions;
}

// ── Bloom-level heuristic ────────────────────────────

/**
 * Guess the cognitive level from stem verb cues. Ordered highest→lowest so a
 * stem like "explain why this is the most appropriate response" classifies as
 * evaluate rather than understand. Transparent and deterministic — the import
 * preview shows the guess and the question can be re-tagged on edit.
 */
const BLOOM_CUES = [
  ['create', /\b(design|creat|construct|develop|formulat|propos|compos|invent|devise|plan|synthesi[sz]e)\w*/i],
  ['evaluate', /\b(evaluat|judge|judget|critique|criticiz|justify|appraise|defend|recommend|argue|most appropriate|most effective|worthwhile)/i],
  ['analyze', /\b(analy[sz]e|compare|contrast|differentiate|distinguish|examine|categoriz|classif|infer|relationship|difference between|why is|why did)/i],
  ['apply', /\b(appl|solve|solv|calculat|compute|demonstrat|execute|implement|determine|illustrat|use|show how|perform|carry out)\w*/i],
  ['understand', /\b(explain|describe|summariz|paraphrase|interpret|discuss|purpose|meaning|main idea|example|how does|why\b|reason for)/i],
  ['remember', /\b(define|list|name|identify|recall|state|what is|who|when|where|which of the following|refers to|term for)/i],
];

export function guessBloom(stem) {
  const text = String(stem || '');
  for (const [level, re] of BLOOM_CUES) {
    if (re.test(text)) return level;
  }
  return 'remember';
}

// ── Import normalization ─────────────────────────────

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const IMPORT_TYPES = ['mcq', 'true_false', 'matching', 'identification'];
// OMR matching bubbles run A–E, so imported pools cap at 5 choices.
const MATCH_POOL_MAX = 5;

function shuffleCopy(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Normalize one parsed import item into the canonical storage shape.
 * Returns { data } on success or { skip: reason } — callers surface the
 * reason so nothing is dropped silently.
 *
 * @param {object} q — parser output { type, stem, options, answer }
 * @param {number} index — 0-based position in the file (for error labels)
 */
export function normalizeImportItem(q, index = 0) {
  const at = `#${index + 1}`;
  const stem = String(q.stem || '').trim();
  if (!stem) return { skip: `${at}: empty stem` };
  if (stem.length > 10000) return { skip: `${at}: stem too long` };
  if (!IMPORT_TYPES.includes(q.type)) return { skip: `${at}: unsupported type "${q.type}"` };

  const result = normalizeType(q, at, stem);
  // Imported items get their Bloom level guessed from stem cues — visible in
  // the preview and editable later, no manual default needed.
  if (result.data) result.data.bloom = guessBloom(stem);
  return result;
}

function normalizeType(q, at, stem) {
  switch (q.type) {
    case 'mcq': {
      const options = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2) return { skip: `${at}: multiple-choice needs at least two options` };
      const answerText = String(q.answer || '').trim();
      const resolves = options.some((o) => o === answerText)
        || (/^[A-Z]$/i.test(answerText) && options[answerText.toUpperCase().charCodeAt(0) - 65] !== undefined)
        || (/^\d+$/.test(answerText) && options[parseInt(answerText, 10) - 1] !== undefined);
      if (!resolves) return { skip: `${at}: answer does not resolve to one of the options` };
      return { data: { type: 'mcq', stem, options, answer: answerText } };
    }
    case 'true_false': {
      const a = String(q.answer || '').trim().toUpperCase();
      if (!['TRUE', 'FALSE', 'T', 'F'].includes(a)) {
        return { skip: `${at}: answer is not True or False` };
      }
      return { data: { type: 'true_false', stem, options: null, answer: a.startsWith('T') ? 'True' : 'False' } };
    }
    case 'identification': {
      const answer = String(q.answer || '').trim();
      if (!answer) return { skip: `${at}: fill-in-the-blank answer is empty` };
      return { data: { type: 'identification', stem, options: null, answer } };
    }
    case 'matching': {
      // Parsers give options = premise texts and answer = "1-matchText, 2-…".
      // Canonical form: options = the lettered match pool (A–E on the OMR
      // sheet), answer = "1-B, 2-A" premise→letter pairs, and the premises
      // themselves live as a numbered list inside the stem.
      const premises = (Array.isArray(q.options) ? q.options : [])
        .map((p) => String(p).trim()).filter(Boolean);
      const matchTexts = [];
      for (const part of String(q.answer || '').split(/,\s*(?=\d+\s*-)/)) {
        const m = part.trim().match(/^\d+\s*-\s*(.+)$/);
        matchTexts.push(m ? m[1].trim() : '');
      }
      if (premises.length < 2 || premises.length !== matchTexts.length || matchTexts.some((t) => !t)) {
        return { skip: `${at}: matching needs at least two complete premise → match pairs` };
      }
      const pool = [...new Set(matchTexts)];
      if (pool.length > MATCH_POOL_MAX) {
        return { skip: `${at}: matching supports at most ${MATCH_POOL_MAX} answer choices` };
      }
      // Shuffle the pool so the mapping isn't a trivial A, B, C diagonal.
      const shuffledPool = shuffleCopy(pool);
      const answer = matchTexts
        .map((text, i) => `${i + 1}-${OPTION_LETTERS[shuffledPool.indexOf(text)]}`)
        .join(',');
      const stemWithPremises = `${stem}\n${premises.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
      return { data: { type: 'matching', stem: stemWithPremises, options: shuffledPool, answer } };
    }
    default:
      return { skip: `${at}: unsupported type "${q.type}"` };
  }
}

// ── Canvas QTI XML parser ────────────────────────────

/**
 * Parse Canvas QTI XML into question objects.
 *
 * Supports: MCQ, True/False, Short Answer (identification), Matching.
 * Uses the browser DOMParser or Node's xmldom-style API.
 *
 * @param {string} xmlText — QTI XML text
 * @returns {Array} questions — [{ type, stem, options, answer, explanation }]
 */
export function parseCanvasXML(xmlText) {
  // Lightweight XML parser — no external dependency needed for well-formed QTI
  const questions = [];

  // Extract all <item> blocks
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemXml = itemMatch[1];
    const q = parseQTIItem(itemXml);
    if (q) questions.push(q);
  }

  return questions;
}

function parseQTIItem(itemXml) {
  // Extract stem from <mattext> inside <presentation>
  const stemMatch = itemXml.match(/<presentation>[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/i);
  const stem = stemMatch ? mattextValue(stemMatch[1]) : '';
  if (!stem) return null;

  // Extract feedback
  const feedbackMatch = itemXml.match(/<itemfeedback[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/i);
  const explanation = feedbackMatch ? mattextValue(feedbackMatch[1]) || null : null;

  // Detect type: response_lid = MCQ/TrueFalse/Matching, response_str = short answer
  if (/<response_str/i.test(itemXml)) {
    // Short answer / identification
    const answerMatch = itemXml.match(/<varequal[^>]*>([\s\S]*?)<\/varequal>/i);
    return {
      type: 'identification',
      stem,
      options: null,
      answer: answerMatch ? decodeXmlEntities(answerMatch[1].trim()) : '',
      explanation,
    };
  }

  if (/<response_lid/i.test(itemXml)) {
    // Extract response_label idents + texts — <varequal> names the winning ident
    const labelRegex = /<response_label\b[^>]*\bident="([^"]*)"[^>]*>[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/gi;
    const labelIdents = [];
    const options = [];
    let labelMatch;
    while ((labelMatch = labelRegex.exec(itemXml)) !== null) {
      labelIdents.push(labelMatch[1]);
      options.push(mattextValue(labelMatch[2]));
    }

    // The correct answer is a response_label ident — found either in the
    // <varequal> content (Canvas native) or in its respident attribute
    // (self-closing style, e.g. our own exporter). A bare 1-based index or
    // A–Z letter in either position also resolves.
    const resolve = (token) => {
      if (!token) return -1;
      const t = decodeXmlEntities(String(token).trim());
      const byIdent = labelIdents.indexOf(t);
      if (byIdent >= 0) return byIdent;
      const byNum = parseInt(t, 10) - 1;
      if (!Number.isNaN(byNum)) return byNum;
      if (/^[A-Z]$/i.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
      return -1;
    };
    let correctIdx = -1;
    const tag = itemXml.match(/<varequal\b[^>]*?(?:\/>|>([\s\S]*?)<\/varequal>)/i);
    if (tag) {
      correctIdx = resolve(tag[1]);
      if (correctIdx < 0) {
        const attr = tag[0].match(/respident="([^"]*)"/i);
        correctIdx = resolve(attr ? attr[1] : '');
      }
    }
    if (correctIdx >= options.length) correctIdx = -1;

    // True/False: exactly two options reading "True"/"False"
    if (options.length === 2 && /true/i.test(options[0]) && /false/i.test(options[1])) {
      return {
        type: 'true_false',
        stem,
        options: null,
        answer: correctIdx === 0 ? 'True' : correctIdx === 1 ? 'False' : '',
        explanation,
      };
    }

    const answer = correctIdx >= 0 && correctIdx < options.length ? options[correctIdx] : '';
    return {
      type: 'mcq',
      stem,
      options,
      answer,
      explanation,
    };
  }

  return null;
}

// Named references decoded on import. XML defines the first five; the rest
// are the HTML ones LMS editors commonly emit. Unknown names are left as-is.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', bull: '•', middot: '·', deg: '°', plusmn: '±', times: '×', divide: '÷',
  le: '≤', ge: '≥', ne: '≠', copy: '©', reg: '®', trade: '™',
};

/**
 * Decode character references in ONE pass, so "&amp;lt;" becomes "&lt;"
 * (the text the author wrote) and never "<". Handles decimal (&#39;), hex
 * (&#x27;) and named references; invalid code points are left untouched.
 */
function decodeEntities(text) {
  return String(text).replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (ref, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      try { return code > 0 ? String.fromCodePoint(code) : ref; } catch { return ref; }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? ref;
  });
}

function decodeXmlEntities(text) {
  if (!text) return '';
  return decodeEntities(text).trim();
}

/** XML layer of an element's content: CDATA kept verbatim, the rest unescaped. */
function xmlLayer(fragment) {
  return String(fragment || '').replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>|[^<]+/g,
    (run, cdata) => (cdata !== undefined ? cdata : decodeEntities(run))
  );
}

// Real HTML markup (as LMS rich-text editors write it), as opposed to text
// that merely contains "<" — e.g. a stem quoting "<tag>" stays intact.
const HTML_MARKUP = /<\/?(p|div|span|br|b|i|u|em|strong|sub|sup|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|img|a|font|pre|code|blockquote)\b[^>]*>/i;

/** HTML → plain text: line breaks kept, tags stripped, entities decoded. */
function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * QTI <mattext> content → plain text. Canvas rich text is escaped HTML
 * ("&lt;p&gt;…&amp;#x27;…"), so markup gets the HTML layer too; plain text
 * (including our own exports) only gets the XML layer, so it round-trips.
 */
function mattextValue(content) {
  const text = xmlLayer(content);
  return HTML_MARKUP.test(text) ? htmlToText(text) : text.trim();
}
