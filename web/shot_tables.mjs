import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await pg.goto('http://localhost:5173/login');
await pg.evaluate((t) => { localStorage.setItem('nexam.token', t); }, process.env.NXTOKEN);
for (const [name, path] of [
  ['questions', '/questions'], ['materials', '/materials'],
  ['subjects_table', '/subjects'], ['attention', '/needs-attention'],
]) {
  await pg.goto(`http://localhost:5173${path}`);
  await pg.waitForTimeout(1800);
  if (name === 'subjects_table') {
    const t = await pg.$('button[aria-label="Table view"]');
    if (t) { await t.click(); await pg.waitForTimeout(700); }
  }
  await pg.screenshot({ path: `/tmp/tb_${name}.png` });
}
await b.close();
console.log('done');
