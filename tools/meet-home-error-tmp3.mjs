import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 650 }, deviceScaleFactor: 3 });
const page = await context.newPage();
await page.goto('http://localhost:3992/?mock=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.addStyleTag({ content: '.app-logo, .app-logo::before, .app-logo::after { animation: none !important; }' });

async function snap(label) {
  const rapport = await page.evaluate(() => {
    const btn = document.querySelector('.home-quick-start');
    const cs = getComputedStyle(btn);
    const screen = document.querySelector('.home-screen');
    const screenRect = screen.getBoundingClientRect();
    return {
      marginTopComputed: cs.marginTop,
      screenHeight: Math.round(screenRect.height),
      screenTop: Math.round(screenRect.top),
      screenBottom: Math.round(screenRect.bottom),
      docScrollHeight: (document.scrollingElement ?? document.documentElement).scrollHeight,
    };
  });
  console.log(label, JSON.stringify(rapport));
}

await snap('VOOR');
const cells = await page.$$('.home-code-input');
for (let i = 0; i < 5; i += 1) await cells[i].fill(String(i));
await page.click('.home-code-go');
await page.waitForTimeout(300);
await snap('NA');
await browser.close();
