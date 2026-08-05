// tools/meet.mjs — meet het échte scherm in een échte browser op telefoonformaat.
//
// WAAROM DIT BESTAAT. "Past binnen één viewport, zonder scrollen" is niet uit
// code af te lezen, en "ziet er compacter uit" is geen review. Dit script maakt
// er een meting van. Het vervangt de drie losse scripts uit de UX-ronde
// (meet-viewport, meet-boxen, meet-timer): die deelden hun halve inhoud —
// browser opstarten, naar het juiste scherm klikken — en liepen daardoor uit de
// pas zodra een selector veranderde.
//
// GEEN TESTRUNNER, GEEN CI. Gereedschap voor de reviewer. Het draait niet mee
// in `npm test` (die suite mag geen browser nodig hebben) en het beoordeelt
// niets over inhoud — alleen over ruimte en tijd.
//
// GEBRUIK
//   node tools/meet.mjs <modus> [scherm]
//
//   modus   past | boxen | timer
//   scherm  home | lobby | aftellen | spel | reveal | podium | hostmenu
//
//   past      zegt PAST / PAST NIET, noemt de elementen uit het ruimtebudget
//             en alles wat onder de vouw valt. Schrijft een PNG. Exitcode 1
//             als het scherm scrolt — bruikbaar in een lus.
//   boxen     loopt de hele boom af met top/bottom/hoogte/marge/padding. Geen
//             oordeel, alleen getallen: hiermee zoek je wélke doos de ruimte
//             opeet als `past` nee zegt.
//   timer     leest het cijfer en het aantal brandende segmenten uit de
//             levende pagina, herhaald. Voor vragen over de aftelling zelf.
//
// VOORBEELDEN
//   node server/index.mjs &
//   node tools/meet.mjs past spel
//   HOOGTE=844 node tools/meet.mjs past lobby     # het volle iPhone-scherm
//   KLIK=1 node tools/meet.mjs boxen spel         # ná een tik op een antwoord
//   MOCK=0 node tools/meet.mjs timer spel         # over de echte socket
//   PAUZE=4000 node tools/meet.mjs timer spel     # pauzeren en hervatten
//
// OMGEVING
//   BASIS     url van de app (standaard http://localhost:3992)
//   HOOGTE    viewporthoogte (standaard 650)
//   MOCK=0    over de echte server en socket in plaats van de mocktransport
//   KLIK=1    tik eerst op het eerste antwoord
//   NAWACHT   extra wachttijd in ms voordat er gemeten wordt
//   MONSTERS  aantal metingen bij `timer` (standaard 24)
//   PAUZE     pauzeer bij `timer` zoveel ms en hervat daarna

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * De referentie uit docs/agent-opdrachten/ronde-2/README.md §1.
 *
 * 844 px is het VOLLE scherm van een iPhone 13. Zo meet je te mild: in Safari
 * gaan de adresbalk en de onderbalk eraf en houdt een speler ~650 px over. Dat
 * is de maat waarop het contract is geschreven, dus daarop meten we.
 */
const VIEWPORT = { width: 390, height: Number(process.env.HOOGTE ?? 650) };
const BASIS = process.env.BASIS ?? 'http://localhost:3992';

/**
 * De elementen waarvan de hoogte in het ruimtebudget staat. Ontbreekt er een op
 * dit scherm, dan komt hij niet in het rapport — dat is geen fout, alleen "niet
 * aanwezig hier".
 */
const GEMETEN = [
  ['chrome', '#app-header'],
  // Sinds A1 is `.room-header` `display: contents` — hij heeft geen eigen box
  // meer en mat dus altijd 0. De code zelf is wél een element, en dat getal
  // zegt iets over "hoe dominant is de code hier".
  ['codewaarde', '.room-header-code-value'],
  ['hostbalk', '.session-hostbar'],
  ['vraag', '.gameplay-question'],
  ['vlag', '.gameplay-flag'],
  ['antwoorden', '.gameplay-options'],
  ['startknop', '.lobby-start'],
  ['minigame', '.rounda-flag-card'],
  ['tussenstand', '.scoreboard-list'],
  ['revealkaart', '.reveal-card'],
  ['podium', '.podium-steps'],
  ['podiumacties', '.podium-action'],
];

/**
 * De weg naar elk scherm. Bewust via de ECHTE knoppen: dan meet je wat een
 * speler ziet, niet een handmatig samengestelde DOM.
 */
const SCHERMEN = {
  home: async () => {},
  lobby: async (page) => {
    await page.click('.home-quick-start');
    await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
  },
  aftellen: async (page) => {
    await SCHERMEN.lobby(page);
    await page.click('.lobby-start button, button.lobby-start');
    // Dit scherm bestaat één keer per potje en is voorbij zodra ronde 1 begint.
    await page.waitForSelector('.gameplay-countdown:not([hidden])', { timeout: 20_000 });
    await page.waitForTimeout(300);
  },
  spel: async (page) => {
    await SCHERMEN.lobby(page);
    await page.click('.lobby-start button, button.lobby-start');
    await page.waitForSelector('.gameplay-options .gameplay-option', { timeout: 20_000 });
  },
  reveal: async (page) => {
    await SCHERMEN.spel(page);
    // De mockronde duurt 8 s. Wachten op het element zelf, niet op een vaste tijd.
    await page.waitForSelector('.reveal-card:not([hidden])', { timeout: 30_000 });
  },
  podium: async (page) => {
    await SCHERMEN.spel(page);
    // Vijf rondes van ~14 s in de mock. Traag, maar dit is de enige manier om
    // het echte eindscherm te zien in plaats van een nagebouwd scherm.
    await page.waitForSelector('.podium-steps', { timeout: 180_000 });
  },
  hostmenu: async (page) => {
    await SCHERMEN.spel(page);
    await page.click('.app-menu-trigger');
    await page.waitForTimeout(300);
  },
};

const modus = process.argv[2] ?? 'past';
const scherm = process.argv[3] ?? 'home';
const MODI = ['past', 'boxen', 'timer'];
if (!MODI.includes(modus)) {
  console.error(`onbekende modus "${modus}" — kies uit: ${MODI.join(', ')}`);
  process.exit(2);
}
if (!(scherm in SCHERMEN)) {
  console.error(`onbekend scherm "${scherm}" — kies uit: ${Object.keys(SCHERMEN).join(', ')}`);
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: VIEWPORT,
  deviceScaleFactor: 3,
});
const page = await context.newPage();

const url = process.env.MOCK === '0' ? BASIS : `${BASIS.replace(/\/$/, '')}/?mock=1`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await SCHERMEN[scherm](page);
// Even laten bedaren: de app mount zijn views na de eerste render.
await page.waitForTimeout(700);

if (process.env.KLIK === '1') {
  await page.click('.gameplay-options .gameplay-option');
  await page.waitForTimeout(800);
}
if (process.env.NAWACHT !== undefined) {
  await page.waitForTimeout(Number(process.env.NAWACHT));
}

/** Waar de screenshots heen gaan; ze zijn wegwerpbaar en staan in .gitignore. */
async function schrijfSchermafdruk(naam) {
  const map = path.join('tools', 'shots');
  await mkdir(map, { recursive: true });
  const bestand = path.join(map, `${naam}.png`);
  await page.screenshot({ path: bestand, fullPage: false });
  return bestand;
}

if (modus === 'past') {
  const rapport = await page.evaluate((selectors) => {
    const el = document.scrollingElement ?? document.documentElement;
    const meting = {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      paginahoogte: el.scrollHeight,
      scrolt: el.scrollHeight > window.innerHeight + 1,
      teveel: Math.max(0, el.scrollHeight - window.innerHeight),
      elementen: {},
      onderDeVouw: [],
    };

    for (const [label, selector] of selectors) {
      const node = document.querySelector(selector);
      if (node === null) continue;
      const r = node.getBoundingClientRect();
      meting.elementen[label] = { top: Math.round(r.top), hoogte: Math.round(r.height) };
    }

    // Alles wat een gebruiker zonder scrollen niet ziet. Alleen zichtbare,
    // betekenisvolle elementen — geen lege wrappers.
    const kandidaten = document.querySelectorAll(
      'button, a, input, .gameplay-option, .scoreboard-entry, .lobby-player, h1, h2, p',
    );
    for (const node of kandidaten) {
      const r = node.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) continue;
      if (r.top >= window.innerHeight) {
        const tekst = (node.textContent ?? '').trim().slice(0, 40);
        meting.onderDeVouw.push({
          tag: node.tagName.toLowerCase(),
          klasse: node.className || null,
          tekst: tekst.length > 0 ? tekst : null,
          top: Math.round(r.top),
        });
      }
    }
    return meting;
  }, GEMETEN);

  const bestand = await schrijfSchermafdruk(scherm);
  await browser.close();
  const oordeel = rapport.scrolt ? 'PAST NIET' : 'PAST';
  console.log(JSON.stringify({ scherm, url, oordeel, ...rapport, screenshot: bestand }, null, 2));
  process.exit(rapport.scrolt ? 1 : 0);
}

if (modus === 'boxen') {
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

  await schrijfSchermafdruk(scherm);
  await browser.close();
  console.log(`pagina=${out.paginahoogte} vh=${out.vh}`);
  for (const r of out.rijen) {
    if (r.h === 0) continue;
    console.log(
      `${'  '.repeat(r.d)}${r.tag}.${r.cls} top=${r.top} bot=${r.bot} h=${r.h} m=${r.m} p=${r.p} ${r.disp}`,
    );
  }
  process.exit(0);
}

// modus === 'timer'
//
// PAUZE=<ms> pauzeert de ronde zodra hij loopt en hervat daarna: zo meet je de
// staat die een host in handen heeft nadat hij de knop indrukte.
if (process.env.PAUZE !== undefined) {
  await page.click('.session-hostbar-pause');
  await page.waitForTimeout(Number(process.env.PAUZE));
  await page.click('.session-hostbar-pause');
  await page.waitForTimeout(300);
  console.log(`[meet] gepauzeerd en hervat na ${process.env.PAUZE} ms`);
}

console.log('ms\tcijfer\tbrandend/12\tronde');
const t0 = Date.now();
for (let i = 0; i < Number(process.env.MONSTERS ?? 24); i++) {
  const monster = await page.evaluate(() => ({
    // `.timer-value` is visueel verborgen maar staat wél in de DOM.
    cijfer: document.querySelector('.timer-value')?.textContent ?? null,
    aan: document.querySelectorAll('.timer-segment.is-on').length,
    totaal: document.querySelectorAll('.timer-segment').length,
    ronde: document.querySelector('.gameplay-round-text')?.textContent ?? null,
  }));
  console.log(`${Date.now() - t0}\t${monster.cijfer}\t${monster.aan}/${monster.totaal}\t${monster.ronde}`);
  await page.waitForTimeout(250);
}

await browser.close();
