import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 650 }, deviceScaleFactor: 3 });
const page = await context.newPage();
await page.goto('http://localhost:3992/?mock=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// Freeze animation for stable measurement
await page.addStyleTag({ content: '.app-logo, .app-logo::before, .app-logo::after { animation: none !important; }' });

async function snap(label) {
  const rapport = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    const root = document.querySelector('.home-screen');
    const rows = [];
    for (const kind of root.children) {
      const r = kind.getBoundingClientRect();
      rows.push({ klasse: kind.className, top: Math.round(r.top), bottom: Math.round(r.bottom), hoogte: Math.round(r.height), hidden: kind.hidden });
    }
    return { paginahoogte: el.scrollHeight, rows };
  });
  console.log(label, JSON.stringify(rapport, null, 2));
}

await snap('VOOR (geen fout)');

const cells = await page.$$('.home-code-input');
for (let i = 0; i < 5; i += 1) await cells[i].fill(String(i));
await page.click('.home-code-go');
await page.waitForTimeout(300);

await snap('NA (met fout)');

await browser.close();
