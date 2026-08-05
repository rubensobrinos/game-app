// tools/meet-boxen.mjs — diagnostisch hulpje naast meet-viewport.mjs.
//
// WAAROM: meet-viewport.mjs zegt PAST / PAST NIET en noemt een handvol
// elementen. Als het niet past, wil je weten WELKE doos de ruimte opeet.
// Dit script loopt de hele boom van het spelscherm af en print per element
// top/bottom/hoogte/marge/padding. Geen oordeel, alleen getallen.
//
//   node tools/meet-boxen.mjs            # 390x650, wachtend op antwoord
//   HOOGTE=844 node tools/meet-boxen.mjs
//   KLIK=1 node tools/meet-boxen.mjs     # ná een tik op het eerste antwoord
//
// `KLIK=1` meet de tweede staat van hetzelfde scherm: de statusregel is dan
// gevuld ("VERZONDEN") en de antwoordteller staat in de kop. Die staat moet
// óók binnen de viewport blijven, anders schuift het scherm weg onder je duim.
//
// Draait niet mee in `npm test` (die suite mag geen browser nodig hebben).

import { chromium, devices } from 'playwright';

const H = Number(process.env.HOOGTE ?? 650);
const BASIS = process.env.BASIS ?? 'http://localhost:3992';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: H },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(`${BASIS}/?mock=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('.home-quick-start');
await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
await page.click('.lobby-start button, button.lobby-start');
await page.waitForSelector('.gameplay-options .gameplay-option', { timeout: 20_000 });
await page.waitForTimeout(800);
if (process.env.KLIK === '1') {
  await page.click('.gameplay-options .gameplay-option');
  await page.waitForTimeout(800);
}
// NAWACHT laat de ronde desgewenst aflopen, zodat je ook de reveal-staat meet.
if (process.env.NAWACHT !== undefined) {
  await page.waitForTimeout(Number(process.env.NAWACHT));
}

const out = await page.evaluate(() => {
  const rijen = [];
  function loop(node, diepte) {
    for (const kind of node.children) {
      const r = kind.getBoundingClientRect();
      const cs = getComputedStyle(kind);
      rijen.push({
        d: diepte,
        tag: kind.tagName.toLowerCase(),
        cls: (kind.className || '').toString().slice(0, 44),
        top: Math.round(r.top),
        bot: Math.round(r.bottom),
        h: Math.round(r.height),
        m: `${cs.marginTop}/${cs.marginBottom}`,
        p: `${cs.paddingTop}/${cs.paddingBottom}`,
        disp: cs.display,
      });
      if (diepte < 4) loop(kind, diepte + 1);
    }
  }
  loop(document.body, 0);
  const el = document.scrollingElement;
  return { paginahoogte: el.scrollHeight, vh: window.innerHeight, rijen };
});

console.log(`pagina=${out.paginahoogte} vh=${out.vh}`);
for (const r of out.rijen) {
  if (r.h === 0) continue;
  console.log(
    `${'  '.repeat(r.d)}${r.tag}.${r.cls} top=${r.top} bot=${r.bot} h=${r.h} m=${r.m} p=${r.p} ${r.disp}`,
  );
}

await browser.close();
