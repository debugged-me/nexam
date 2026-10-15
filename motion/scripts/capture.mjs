// Capture real NEXAM app screens for the motion graphic.
// Uses puppeteer-core + HyperFrames' chrome-headless-shell.
// Auth: mint a JWT with `node scripts/mint-token.mjs` output pasted into TOKEN env,
// or run scripts/mint-token.mjs first and pass its output via TOKEN=…
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets/screens');
const CHROME = process.env.CHROME_BIN
  || `${process.env.HOME}/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-152.0.7977.30/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.APP_URL || 'http://localhost:5173';
const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('TOKEN env required'); process.exit(1); }

mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ['login',          '/login',                                        false],
  ['dashboard',      '/dashboard',                                    true],
  ['subjects',       '/subjects',                                     true],
  ['questions',      '/questions',                                    true],
  ['tos-list',       '/tos',                                          true],
  ['tos-detail',     '/tos/e9060e11-f3aa-482d-81f2-79709dd76a18',     true],
  ['exams',          '/exams',                                        true],
  ['exam-detail',    '/exams/22c9863c-8ec4-45d8-8c7c-747a5b748e20',   true],
  ['exam-analytics', '/analytics/exam/22c9863c-8ec4-45d8-8c7c-747a5b748e20', true],
  ['materials',      '/materials',                                    true],
  ['scans',          '/scans',                                        true],
  ['pipeline',       '/pipeline',                                     true],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument((token) => {
  localStorage.setItem('nexam.token', token);
  localStorage.setItem('nexam.theme', 'light');
}, TOKEN);

for (const [name, path, auth] of SHOTS) {
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1800)); // fonts, charts, query settle
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`ok ${name}`);
  } catch (e) {
    console.log(`fail ${name}: ${e.message}`);
  }
}
await browser.close();
