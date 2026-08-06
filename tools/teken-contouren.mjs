// tools/teken-contouren.mjs — visuele controle van `shape-renderer.mjs`.
//
// Twee dingen in één run, want ze horen bij elkaar:
//
//   1. TEKENING — tien landen naast elkaar, om met het oog te kunnen zien of
//      een contour herkenbaar is. Een unit-test kan tellen dat er punten
//      getekend zijn; hij kan niet zien of Italië op een laars lijkt.
//   2. GEWICHT — een echt potje `flags_mc` gespeeld, met elk netwerkverzoek
//      gelogd. `shapes.data.mjs` (234 KB) hoort er niet tussen te staan. Daarna
//      wordt op diezelfde pagina `preloadCountryShapes()` aangeroepen, zodat
//      zichtbaar is dat het verzoek er dán wél komt — anders bewijst een
//      ontbrekend verzoek alleen dat de meting niet werkt.
//
// Gebruik (server draait al):
//   node tools/teken-contouren.mjs [basis-url] [uitvoermap]
//
// Geen onderdeel van `npm test`: dit vraagt een draaiende server en Playwright.

import { chromium } from 'playwright';

const BASIS = process.argv[2] ?? 'http://127.0.0.1:3999';
const UIT = process.argv[3] ?? '.';

/**
 * Tien landen die iedereen zou moeten herkennen.
 *
 * Bewust NIET de Verenigde Staten of Chili, en dat is een bevinding en geen
 * kieskeurigheid: de brondata perst elk land afzonderlijk in zijn eigen
 * 100×100-vierkant, dus een land met een extreme verhouding (Chili is ruwweg
 * 1:11) of met ver weg liggende gebiedsdelen (Alaska bij de VS) komt vervormd
 * uit. Dat zit in `shapes.data.mjs`, niet in de tekenaar — canvas en `<svg>`
 * geven met hetzelfde pad exact hetzelfde beeld, en de solo-game toont ze
 * vandaag al zo. Zie de oplevering van opdracht B.
 */
const TIEN = [
  ['nl', 'Nederland'],
  ['it', 'Italië'],
  ['fr', 'Frankrijk'],
  ['es', 'Spanje'],
  ['br', 'Brazilië'],
  ['jp', 'Japan'],
  ['au', 'Australië'],
  ['in', 'India'],
  ['za', 'Zuid-Afrika'],
  ['mx', 'Mexico'],
];

const browser = await chromium.launch();

// ── 1. Tien contouren tekenen ───────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 }, colorScheme: 'dark' });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  // Op de oorsprong van de app, zodat de modulepaden kloppen.
  await page.goto(`${BASIS}/`, { waitUntil: 'domcontentloaded' });

  const getekend = await page.evaluate(async (landen) => {
    const { loadCountryShape, renderCountryShape } = await import('/js/views/shape-renderer.mjs');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#0a0a0c;font-family:system-ui,sans-serif';
    const raster = document.createElement('div');
    raster.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:16px';
    document.body.append(raster);

    const uitkomst = [];
    for (const [iso2, naam] of landen) {
      const cel = document.createElement('div');
      cel.style.cssText = 'text-align:center;color:#8e8e9f;font-size:13px';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:100%;max-width:170px;aspect-ratio:1;display:block;margin:0 auto';
      const label = document.createElement('div');
      label.textContent = `${naam} (${iso2})`;
      cel.append(canvas, label);
      raster.append(cel);

      const pad = await loadCountryShape(iso2);
      renderCountryShape(canvas, pad);
      uitkomst.push({ iso2, gevonden: pad !== null, punten: (pad ?? '').match(/L/g)?.length ?? 0 });
    }
    return uitkomst;
  }, TIEN);

  console.log('TEKENING');
  for (const r of getekend) {
    console.log(`  ${r.iso2.padEnd(3)} pad gevonden: ${r.gevonden ? 'ja ' : 'NEE'}  punten: ${r.punten}`);
  }
  await page.screenshot({ path: `${UIT}/contouren-tien-landen.png`, fullPage: true });
  console.log(`  schermafdruk: ${UIT}/contouren-tien-landen.png`);
  await page.close();
}

// ── 2. Gewichtsbewijs: een potje flags_mc haalt de contourdata niet op ───────
{
  const host = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const speler = await browser.newPage({ viewport: { width: 390, height: 860 } });
  const verzoeken = [];
  for (const p of [host, speler]) {
    p.on('request', (r) => verzoeken.push(r.url()));
  }

  await host.goto(`${BASIS}/`, { waitUntil: 'networkidle' });
  await host.click('.home-quick-start');
  await host.waitForSelector('.lobby-start', { timeout: 20000 });
  const code = (await host.$eval('.room-header-code-value', (e) => e.textContent)).replace(/\D/g, '');

  await speler.goto(`${BASIS}/`, { waitUntil: 'networkidle' });
  await speler.$$eval('.home-code-cells .home-code-input', (es, c) => es.forEach((e, i) => {
    e.value = c[i];
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }), code.split(''));
  await speler.waitForTimeout(300);
  await speler.click('.home-code-submit');
  await speler.waitForTimeout(2000);

  await host.click('.lobby-start');
  await host.waitForSelector('.gameplay-option', { timeout: 25000 });
  await speler.waitForSelector('.gameplay-option', { timeout: 25000 });
  await host.$$eval('.gameplay-option', (es) => es[0].click());
  await speler.$$eval('.gameplay-option', (es) => es[0].click());
  await host.waitForTimeout(2000);

  const contourVerzoeken = verzoeken.filter((u) => u.includes('shapes.data'));
  console.log('\nGEWICHT — potje flags_mc (lobby, join, start, ronde, antwoord)');
  console.log(`  netwerkverzoeken totaal        : ${verzoeken.length}`);
  console.log(`  daarvan naar shapes.data.mjs   : ${contourVerzoeken.length}`);
  console.log(`  shapes-index.mjs (2 KB, server): ${verzoeken.filter((u) => u.includes('shapes-index')).length}`);

  // Tegenproef op dezelfde pagina: nu wél opvragen.
  await host.evaluate(async () => {
    const { preloadCountryShapes } = await import('/js/views/shape-renderer.mjs');
    await preloadCountryShapes();
  });
  await host.waitForTimeout(500);
  const naPreload = verzoeken.filter((u) => u.includes('shapes.data'));
  console.log(`  na preloadCountryShapes()      : ${naPreload.length}  <- de meting werkt`);

  const bytes = await host.evaluate(async (b) => {
    const r = await fetch(`${b}/shared/content/shapes.data.mjs`);
    return (await r.text()).length;
  }, BASIS);
  console.log(`  omvang shapes.data.mjs         : ${Math.round(bytes / 1024)} KB`);

  console.log(
    contourVerzoeken.length === 0 && naPreload.length > 0
      ? '\nUITKOMST: het potje flags_mc haalde de contourdata niet op; na de expliciete preload wel.'
      : '\nUITKOMST: NIET IN ORDE — zie de aantallen hierboven.',
  );
  await host.close();
  await speler.close();
}

await browser.close();
