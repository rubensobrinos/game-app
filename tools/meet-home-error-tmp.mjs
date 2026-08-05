import { chromium, devices } from 'playwright';

const VIEWPORT = { width: 390, height: Number(process.env.HOOGTE ?? 650) };
const BASIS = process.env.BASIS ?? 'http://localhost:3992';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: VIEWPORT, deviceScaleFactor: 3 });
const page = await context.newPage();
await page.goto(`${BASIS}/?mock=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const cells = await page.$$('.home-code-input');
for (let i = 0; i < 5; i += 1) {
  await cells[i].fill(String(i));
}
await page.click('.home-code-go');
await page.waitForTimeout(500);

const rows = await page.evaluate(() => {
  const root = document.querySelector('.home-screen');
  const out = [];
  for (const kind of root.children) {
    const r = kind.getBoundingClientRect();
    const cs = getComputedStyle(kind);
    out.push({
      klasse: kind.className,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      hoogte: Math.round(r.height),
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      hidden: kind.hidden,
    });
  }
  const screenCs = getComputedStyle(root);
  return { rows: out, screenGap: screenCs.gap, screenPaddingTop: screenCs.paddingTop, screenPaddingBottom: screenCs.paddingBottom };
});
console.log(JSON.stringify(rows, null, 2));
await browser.close();
