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
  const stem = stemMatch ? decodeXmlEntities(stemMatch[1].trim()) : '';
  if (!stem) return null;

  // Extract feedback
  const feedbackMatch = itemXml.match(/<itemfeedback[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/i);
  const explanation = feedbackMatch ? decodeXmlEntities(feedbackMatch[1].trim()) : null;

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
    // Extract all response_label texts
    const labelRegex = /<response_label\b[^>]*>[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/gi;
    const options = [];
    let labelMatch;
    while ((labelMatch = labelRegex.exec(itemXml)) !== null) {
      options.push(decodeXmlEntities(labelMatch[1].trim()));
    }

    // Extract correct answer from <varequal respident="...">
    // Handle both self-closing (<varequal respident="2"/>) and content tags
    let correctMatch = itemXml.match(/<varequal\s+respident="([^"]*)"\s*\/>/i);
    if (!correctMatch) {
      correctMatch = itemXml.match(/<varequal\s+respident="([^"]*)"[^>]*>([\s\S]*?)<\/varequal>/i);
    }
    let answer = '';

    // Check if it's True/False (options are "True" and "False")
    if (options.length === 2 && /true/i.test(options[0]) && /false/i.test(options[1])) {
      const isTrue = correctMatch && /T/i.test(correctMatch[1]);
      return {
        type: 'true_false',
        stem,
        options: null,
        answer: isTrue ? 'True' : 'False',
        explanation,
      };
    }

    // MCQ: correct answer is the option at the respident index
    if (correctMatch) {
      const respId = correctMatch[1];
      // respId could be a number (1-based) or a letter
      let idx = parseInt(respId, 10) - 1;
      if (isNaN(idx)) {
        idx = respId.charCodeAt(0) - 65; // A=0, B=1, etc.
      }
      if (idx >= 0 && idx < options.length) {
        answer = options[idx];
      }
    }

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

function decodeXmlEntities(text) {
  if (!text) return '';
  // Decode named entities + numeric refs. &amp; must decode LAST so
  // "&amp;lt;" → "&lt;" stays escaped rather than double-decoding to "<".
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .trim();
}
