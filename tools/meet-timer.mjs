// tools/meet-timer.mjs — R2-7: meet wat de segmententimer werkelijk doet.
//
// WAAROM: de producteigenaar ziet aan het begin van ronde 01 vier van de twaalf
// segmenten branden in plaats van twaalf. `brandendeSegmenten()` rekent
// `ceil(resterend/totaal × 12)`, dus vier betekent dat één van die twee
// getallen niet klopt. Dit script leest ze allebei uit de levende pagina —
// `.timer-value` (het cijfer, visueel verborgen maar wél in de DOM) en het
// aantal `.timer-segment.is-on` — vanaf het moment dat de ronde start.
//
//   node tools/meet-timer.mjs           # mocktransport
//   MOCK=0 node tools/meet-timer.mjs    # de échte server, echte socket
//
// MOCK=0 is de belangrijke variant: de mock zet `startsAt`/`endsAt` zelf en
// heeft geen servertijd-offset, dus hij kan een fout in dat pad niet laten
// zien. De producteigenaar speelt op de echte keten.
//
// Draait niet mee in `npm test` (die suite mag geen browser nodig hebben).

import { chromium, devices } from 'playwright';

const BASIS = process.env.BASIS ?? 'http://localhost:3992';
const MONSTERS = Number(process.env.MONSTERS ?? 24);

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 650 },
});
const page = await context.newPage();
page.on('console', (bericht) => {
  const tekst = bericht.text();
  if (tekst.startsWith('[meet]')) console.log(tekst);
});
await page.goto(process.env.MOCK === '0' ? BASIS : `${BASIS}/?mock=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('.home-quick-start');
await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
await page.click('.lobby-start button, button.lobby-start');
await page.waitForSelector('.gameplay-options .gameplay-option', { timeout: 20_000 });

// PAUZE=<ms>: pauzeer de ronde zodra hij loopt, wacht, en hervat. Zo meet je
// de staat die de producteigenaar in handen had toen hij de knop indrukte.
if (process.env.PAUZE !== undefined) {
  await page.click('.session-hostbar-pause');
  await page.waitForTimeout(Number(process.env.PAUZE));
  await page.click('.session-hostbar-pause');
  await page.waitForTimeout(300);
  console.log(`[meet] gepauzeerd en hervat na ${process.env.PAUZE} ms`);
}

console.log('ms\tcijfer\tbrandend/12\tronde');
const t0 = Date.now();
for (let i = 0; i < MONSTERS; i++) {
  const monster = await page.evaluate(() => ({
    cijfer: document.querySelector('.timer-value')?.textContent ?? null,
    aan: document.querySelectorAll('.timer-segment.is-on').length,
    totaal: document.querySelectorAll('.timer-segment').length,
    ronde: document.querySelector('.gameplay-round-text')?.textContent ?? null,
  }));
  console.log(`${Date.now() - t0}\t${monster.cijfer}\t${monster.aan}/${monster.totaal}\t${monster.ronde}`);
  await page.waitForTimeout(250);
}

await browser.close();
