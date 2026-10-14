import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import 'dotenv/config';

const BASE = 'http://localhost:5173';
const OUT = '/tmp/nexam-verify';
fs.mkdirSync(OUT, { recursive: true });

const secret = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const tok = (u) => jwt.sign(u, secret, { expiresIn: '2h' });

const USERS = {
  instructor: { id: '44e04313-2a05-46d1-93ff-2b6832cee5a1', email: 'eclarksteven@gmail.com', role: 'instructor' },
  superadmin: { id: '71ec74ae-1431-4ee3-95c6-58db76fdcc8f', email: 'superadmin@mati.gov.ph', role: 'superadmin' },
};

const SHOTS = [
  ['v4-i-analytics', '/analytics', 'instructor'],
  ['v4-i-review', '/questions/review', 'instructor'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Helium.app/Contents/MacOS/Helium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 140)));

for (const [name, path, user, opts = {}] of SHOTS) {
  const mobile = Boolean(opts.mobile);
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((u, accent) => {
    try {
      if (u) {
        localStorage.setItem('nexam.token', u.token);
        localStorage.setItem('nexam.theme.uid', u.id);
        if (accent) localStorage.setItem(`nexam.accent.${u.id}`, accent);
      }
    } catch {}
  }, user ? { token: tok(USERS[user]), id: USERS[user].id } : null, opts.accent || null);
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2600);
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y <= h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
      window.scrollTo(0, 0);
    });
    await sleep(600);
    if (opts.accent) {
      // Server users.accent overrides the seed on sign-in; force post-load.
      await page.evaluate((a) => { document.documentElement.dataset.accent = a; }, opts.accent);
      await sleep(400);
    }
    if (opts.openSelect) {
      // Render the select's options as text (native dropdown can't be captured);
      // dump option labels to console instead.
      const labels = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel + ' option')].map((o) => o.textContent.trim()), opts.openSelect);
      console.log('OPTIONS', name, JSON.stringify(labels));
    }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !mobile });
    console.log('ok', name);
  } catch (e) {
    console.log('FAIL', name, e.message.slice(0, 120));
  }
}
await browser.close();
console.log('done ->', OUT);
