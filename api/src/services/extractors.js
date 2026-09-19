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
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { YoutubeTranscript } from 'youtube-transcript';

const require = createRequire(import.meta.url);
// pdf-parse is CommonJS/UMD — load via require.
const pdfParse = require('pdf-parse');
const JSZip = require('jszip');

/** Extract text from a PDF file. Rejects scanned/image-only PDFs. */
async function extractPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = (data.text || '').trim();
  if (!text || text.length < 20) {
    throw new Error('No selectable text found in this PDF. It may be a scanned image. The system cannot extract content from image-based PDFs (see scope limitations).');
  }
  return text;
}

/** Extract text from a DOCX file. */
async function extractDocx(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').trim();
  if (!text) throw new Error('No text found in this DOCX file.');
  return text;
}

/** Extract text from a PPTX file — unzip and read slide XML text runs. */
async function extractPptx(filePath) {
  const buffer = await fs.readFile(filePath);
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
  const res = await fetch(url, {
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
