/**
 * LMS export service — converts questions to Moodle GIFT and Canvas XML.
 *
 * Moodle GIFT format: https://docs.moodle.org/en/GIFT_format
 * Canvas QTI XML: simplified Canvas-compatible XML for import.
 *
 * Both formats only support the objective question types in scope:
 * mcq, true_false, matching, identification (short answer).
 */

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
  const lines = opts.map((opt) => {
    const optText = escapeGIFT(stripOptionLetter(opt));
    const isCorrect = optText === escapeGIFT(answer) || opt === answer || stripOptionLetter(opt) === answer;
    return `${isCorrect ? '=' : '~'}${optText}`;
  });
  return `::${title}::${stem}{${opts.join(' ')}${feedback ? `\n${feedback}` : ''}}`;
}

function formatTrueFalseGIFT(title, stem, answer, feedback) {
  const isTrue = answer && answer.toLowerCase().startsWith('true');
  return `::${title}::${stem}{${isTrue ? 'T' : 'F'}${feedback ? `\n${feedback}` : ''}}`;
}

function formatMatchingGIFT(title, stem, options, answer, feedback) {
  // GIFT matching: =item -> match
  const opts = Array.isArray(options) ? options : JSON.parse(options || '[]');
  const pairs = parseMatchingAnswer(answer);
  const lines = opts.map((opt, i) => {
    const match = pairs[i] || '';
    return `=${escapeGIFT(opt)} -> ${escapeGIFT(match)}`;
  });
  return `::${title}::${stem}{${lines.join(' ')}${feedback ? `\n${feedback}` : ''}}`;
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
    const isCorrect = optText === escapeXML(answer) || opt === answer || stripOptionLetter(opt) === answer;
    return `<response_label ident="${i + 1}"><flow_mat><material><mattext texttype="text/html">${optText}</mattext></material></flow_mat></response_label>`;
  }).join('');

  const correctIdx = opts.findIndex((opt) => {
    const optText = stripOptionLetter(opt);
    return optText === answer || opt === answer || escapeXML(optText) === escapeXML(answer);
  });
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

export default { toGIFT, toCanvasXML };
