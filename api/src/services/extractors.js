/**
 * Text extractors — one per material source type.
 *
 * Each extractor takes the material row (with file_path / url / content)
 * and returns clean plain text. On failure it throws with a clear message
 * matching the scope's stated limitations (image PDFs, no-caption videos,
 * JS-heavy pages).
 *
 * Supported source types:
 *   - pdf    (smalot/pdfparser via pdf-parse)
 *   - docx   (mammoth)
 *   - pptx   (pptxtojson → text)
 *   - url    (cheerio, readability-style extraction)
 *   - youtube (youtube-transcript)
 *   - text   (raw text typed by the instructor — passthrough)
 */
import { createRequire } from 'module';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { YoutubeTranscript } from 'youtube-transcript';
import { safePublicFetch } from './safeUrl.js';
import { readProtectedFile } from './storageCrypto.js';

const require = createRequire(import.meta.url);
// pdf-parse ≥2.x exposes a PDFParse class over pdf.js, not a bare function.
const { PDFParse } = require('pdf-parse');
const JSZip = require('jszip');

/** Extract text from a PDF file. Rejects scanned/image-only PDFs. */
async function extractPdf(filePath) {
  const buffer = await readProtectedFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let text;
  try {
    const data = await parser.getText();
    text = (data.text || '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
  if (!text || text.length < 20) {
    throw new Error('No selectable text found in this PDF. It may be a scanned image. The system cannot extract content from image-based PDFs (see scope limitations).');
  }
  return text;
}

/**
 * Extract text from a DOCX file.
 *
 * Tables are serialized cell-by-cell instead of flattened: raw text extraction
 * interleaves wrapped cell lines across columns, which destroys outline
 * structure (syllabus Topics columns lose their bullets). Rows with a short
 * multi-column header get "Header: " labels so each line keeps its column's
 * meaning for both the LLM prompt and retrieval chunks.
 */
async function extractDocx(filePath) {
  const buffer = await readProtectedFile(filePath);
  const { value: html } = await mammoth.convertToHtml({ buffer });
  if (!html || !html.trim()) throw new Error('No text found in this DOCX file.');

  let listItems = [];
  try { listItems = await docxListItems(buffer); } catch { /* nesting is optional */ }
  return docxHtmlToText(html, { listItems });
}

/**
 * List paragraphs in document order with their indent and level. mammoth's
 * HTML flattens lists whose sub-items use a separate bullet definition
 * (common in syllabi: "Larong Task" then indented "- Patintero"), so the
 * nesting is read from Word's own paragraph and numbering properties.
 */
export async function docxListItems(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name) => (zip.file(name) ? zip.file(name).async('string') : '');
  const xml = (src) => cheerio.load(src, { xml: { xmlMode: true } });
  const twips = (el) => Number(el.attr('w:left') ?? el.attr('w:start')) || 0;

  const numbering = xml(await read('word/numbering.xml'));
  const levelIndent = new Map(); // abstractNumId:ilvl -> indent
  numbering('w\\:abstractNum').each((_, a) => {
    const id = numbering(a).attr('w:abstractNumId');
    numbering(a).children('w\\:lvl').each((__, l) => {
      levelIndent.set(`${id}:${numbering(l).attr('w:ilvl')}`, twips(numbering(l).find('w\\:pPr > w\\:ind').first()));
    });
  });
  const abstractOf = new Map();
  numbering('w\\:num').each((_, n) => {
    abstractOf.set(numbering(n).attr('w:numId'), numbering(n).children('w\\:abstractNumId').attr('w:val'));
  });

  const doc = xml(await read('word/document.xml'));
  const items = [];
  doc('w\\:p').each((_, p) => {
    const pPr = doc(p).children('w\\:pPr');
    const numPr = pPr.children('w\\:numPr');
    if (!numPr.length) return;
    const numId = numPr.children('w\\:numId').attr('w:val');
    const ilvl = Number(numPr.children('w\\:ilvl').attr('w:val')) || 0;
    const own = pPr.children('w\\:ind');
    const indent = own.length && (own.attr('w:left') ?? own.attr('w:start')) != null
      ? twips(own) : levelIndent.get(`${abstractOf.get(numId)}:${ilvl}`) || 0;
    const text = doc(p).find('w\\:t').map((__, t) => doc(t).text()).get().join('').replace(/\s+/g, ' ').trim();
    if (text) items.push({ text, indent, ilvl });
  });
  return items;
}

/**
 * Pure serializer, shared by DOCX extraction and regression tests.
 * `listItems` (from docxListItems) marks sub-items: a list item indented
 * deeper than the cell's top-level items is written as "  - item".
 */
export function docxHtmlToText(html, { listItems = [] } = {}) {
  const $ = cheerio.load(`<div id="nexam-docx-root">${html}</div>`);
  let cursor = 0;
  // mammoth emits list items in document order, so each <li> claims the next
  // Word list paragraph with the same text (looking a few ahead for safety).
  const nestingOf = (text) => {
    for (let i = cursor; i < Math.min(listItems.length, cursor + 8); i++) {
      if (listItems[i].text === text) { cursor = i + 1; return listItems[i]; }
    }
    return null;
  };
  const cellLines = (cell) => {
    const entries = $(cell).find('p, li').map((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (!t) return null;
      return { text: t, li: el.tagName === 'li', nest: el.tagName === 'li' ? nestingOf(t) : null };
    }).get().filter(Boolean);
    const nested = entries.filter((e) => e.nest);
    const topIndent = nested.length ? Math.min(...nested.map((e) => e.nest.indent)) : 0;
    const topLevel = nested.length ? Math.min(...nested.map((e) => e.nest.ilvl)) : 0;
    const blocks = entries.map((e) => {
      if (!e.li) return e.text;
      const deeper = e.nest && (e.nest.ilvl > topLevel || e.nest.indent > topIndent + 60);
      return `${deeper ? '  ' : ''}- ${e.text}`;
    });
    if (blocks.length) return blocks;
    const t = $(cell).text().replace(/\s+/g, ' ').trim();
    return t ? [t] : [];
  };

  const lines = [];
  $('#nexam-docx-root').children().each((_, el) => {
    const node = $(el);
    if (!node.is('table')) {
      const t = node.text().replace(/\s+/g, ' ').trim();
      if (t) lines.push(t);
      return;
    }
    // .each(), not .map() — cheerio flattens mapped arrays, which would
    // merge every cell back into the interleaved soup we're avoiding.
    const rows = [];
    node.find('tr').filter((_, tr) => $(tr).closest('table')[0] === el).each((_, tr) => {
      const cells = [];
      $(tr).children('th,td').each((_, c) => {
        const span = Math.max(1, Number($(c).attr('colspan')) || 1);
        cells.push({ lines: cellLines(c), span, rowspan: Number($(c).attr('rowspan')) || 1 });
      });
      rows.push(cells);
    });
    const first = rows[0] || [];
    const width = first.reduce((n, c) => n + c.span, 0);
    const header = rows.length > 1 && first.length >= 3
      && first.every((c) => c.lines.length && c.lines.join(' ').length <= 60 && c.rowspan === 1)
      ? first.flatMap((c) => Array(c.span).fill(c.lines.join(' '))) : null;
    // Vertical merges are emitted without inferred column labels: guessing
    // their alignment would attach facts to the wrong heading.
    const hasVerticalMerge = rows.some((r) => r.some((c) => c.rowspan > 1));
    for (const cells of rows.slice(header && !hasVerticalMerge ? 1 : 0)) {
      if (!cells.some((c) => c.lines.length)) continue;
      lines.push('');
      if (cells.length === 1) { lines.push(...cells[0].lines); continue; }
      if (!header || hasVerticalMerge || cells.reduce((n, c) => n + c.span, 0) !== width) {
        lines.push(cells.map((c) => c.lines.join('\n')).filter(Boolean).join(' | '));
        continue;
      }
      let column = 0;
      for (const cell of cells) {
        const label = [...new Set(header.slice(column, column + cell.span))].join(' / ');
        cell.lines.forEach((line, j) => lines.push(j === 0 ? `${label}: ${line}` : line));
        column += cell.span;
      }
    }
  });

  const text = lines.join('\n').trim();
  if (!text) throw new Error('No text found in this DOCX file.');
  return text;
}

/** Extract text from a PPTX file — unzip and read slide XML text runs. */
async function extractPptx(filePath) {
  const buffer = await readProtectedFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  const parts = [];
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async('string');
    // Extract all <a:t> text runs from the slide XML.
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const slideText = matches.map((m) => m.replace(/<\/?a:t>/g, '')).join(' ');
    if (slideText) parts.push(slideText);
  }

  // Also extract speaker notes if present.
  const noteFiles = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  for (const noteFile of noteFiles) {
    const xml = await zip.files[noteFile].async('string');
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const noteText = matches.map((m) => m.replace(/<\/?a:t>/g, '')).join(' ');
    if (noteText) parts.push(noteText);
  }

  const text = parts.join('\n').trim();
  if (!text) throw new Error('No text found in this PPTX file.');
  return text;
}

/** Extract main content from a web page URL. */
async function extractUrl(url) {
  const res = await safePublicFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexamBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status}).`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Strip non-content elements
  $('script,style,noscript,nav,footer,header,aside,iframe,svg').remove();

  // Prefer article/main, fall back to body
  const main = $('article, main, [role="main"], .post-content, .article-content, .content').first();
  const target = main.length ? main : $('body');
  const text = target.text().replace(/\s+/g, ' ').trim();
  if (!text || text.length < 50) {
    throw new Error('Could not extract meaningful text from this page. It may be a JavaScript-heavy or dynamic page (see scope limitations).');
  }
  return text;
}

/** Extract transcript from a YouTube video. */
async function extractYouTube(url) {
  // Parse video ID from various URL formats
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (!match) throw new Error('Invalid YouTube URL. Could not extract video ID.');
  const videoId = match[1];

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || !transcript.length) {
      throw new Error('No captions or transcript available for this video (see scope limitations).');
    }
    const text = transcript.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('Transcript was empty.');
    return text;
  } catch (err) {
    if (err.message.includes('scope limitations')) throw err;
    throw new Error('No captions or transcript available for this video (see scope limitations).');
  }
}

/** Passthrough for raw text typed by the instructor. */
async function extractText(content) {
  const text = (content || '').trim();
  if (!text) throw new Error('No text provided.');
  return text;
}

/**
 * Dispatch to the right extractor based on source_type.
 *
 * @param {object} material — row from materials table
 * @returns {Promise<string>} extracted plain text
 */
export async function extract(material) {
  const type = material.source_type;
  switch (type) {
    case 'pdf':   return extractPdf(material.file_path);
    case 'docx':  return extractDocx(material.file_path);
    case 'pptx':  return extractPptx(material.file_path);
    case 'url':   return extractUrl(material.url);
    case 'youtube': return extractYouTube(material.url);
    case 'text':  return extractText(material.content);
    default:
      throw new Error(`Unknown material source type: ${type}`);
  }
}

export default { extract };
