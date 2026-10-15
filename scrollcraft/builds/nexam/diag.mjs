import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:4500/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1400);
const go = (y) => p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
const at = async (id, f) => p.evaluate(({id, f}) => {
  const el = document.getElementById(id);
  scrollTo({ top: el.offsetTop + (el.offsetHeight - innerHeight) * f, behavior: 'instant' });
}, {id, f});
await p.screenshot({ path: 'lab/p-hero.png' });
await at('readout', 0.5); await p.waitForTimeout(500);
await p.screenshot({ path: 'lab/p-readout.png' });
await at('readout', 0.85); await p.waitForTimeout(400);
await p.screenshot({ path: 'lab/p-readout-late.png' });
await p.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
await p.waitForTimeout(500);
await p.screenshot({ path: 'lab/p-close.png' });
const d = await p.evaluate(() => ({
  canvas: getComputedStyle(document.body).backgroundColor,
  dark: document.body.hasAttribute('data-dark')
}));
console.log(JSON.stringify(d));
await b.close();
