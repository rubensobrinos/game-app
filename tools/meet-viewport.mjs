// tools/meet-viewport.mjs — meet of een scherm binnen één telefoonviewport past.
//
// WAAROM DIT BESTAAT. De harde eisen van de mobiele UX-ronde (punt 1, 33, 58)
// luiden "past binnen één viewport, zonder scrollen". Dat is niet uit code af
// te lezen en "ziet er compacter uit" is geen review. Dit script maakt er een
// meting van: het opent het echte scherm in een echte browser op een echt
// telefoonformaat en zegt PAST / PAST NIET, met de getallen erbij.
//
// GEEN TESTRUNNER, GEEN CI. Dit is gereedschap voor de reviewer. Het draait
// niet mee in `npm test` (die suite mag geen browser nodig hebben) en het
// beoordeelt niets over inhoud — alleen over ruimte.
//
// GEBRUIK
//   node tools/meet-viewport.mjs <basisurl> <flow>
//
// `flow` is een van: home | lobby | spel | tussenstand | podium. Het script
// klikt zelf naar dat scherm toe in mockmodus, zodat er geen tweede telefoon en
// geen backend aan te pas komt. `podium` speelt een hele partij uit en duurt
// daardoor ruim een minuut — dat is de prijs van meten op het echte scherm in
// plaats van op een nagebouwde DOM.
//
// Bijvoorbeeld, tegen een lokaal draaiende server in mockmodus (geen backend
// nodig — de mocktransport speelt de hele keten na):
//   node server/index.mjs &                       # of in een worktree
//   node tools/meet-viewport.mjs http://localhost:3000/samen?mock=1 home
//
// Schrijft een PNG naar `tools/shots/<naam>.png` en print een JSON-rapport.

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * De referentie uit docs/agent-opdrachten/README.md §1.
 *
 * 844 px is het VOLLE scherm van een iPhone 13. Zo meet je te mild: in Safari
 * gaan de adresbalk en de onderbalk eraf en houdt een speler ~650 px over.
 * Dat is de maat waarop het contract is geschreven, dus daarop meten we. Met
 * `HOOGTE=844` meet je desgewenst het volle scherm.
 */
const VIEWPORT = { width: 390, height: Number(process.env.HOOGTE ?? 650) };
const SCALE = 3;

/**
 * De elementen waarvan de hoogte in het ruimtebudget staat. Ontbreekt er een
 * op dit scherm, dan komt hij simpelweg niet in het rapport — dat is geen
 * fout, alleen "niet aanwezig hier".
 */
const GEMETEN = [
  ['chrome', '#app-header'],
  // Sinds A1 is `.room-header` `display: contents` — hij heeft geen eigen box
  // meer en mat dus altijd 0. De code zelf is wél een element, en dat is het
  // getal dat iets zegt over "hoe dominant is de code hier".
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

const basis = process.argv[2];
const flow = process.argv[3] ?? 'home';
if (typeof basis !== 'string' || basis.length === 0) {
  console.error('gebruik: node tools/meet-viewport.mjs <basisurl> <home|lobby|spel>');
  process.exit(2);
}

/**
 * De weg naar elk scherm, in mockmodus. Bewust via de ECHTE knoppen: dan meet
 * je wat een speler ziet, niet een handmatig samengestelde DOM.
 */
const FLOWS = {
  home: async () => {},
  lobby: async (page) => {
    await page.click('.home-quick-start');
    await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
  },
  spel: async (page) => {
    await naarSpel(page);
  },
  tussenstand: async (page) => {
    await naarSpel(page);
    // De mockronde duurt 8 s; daarna komt de reveal. Wachten op het element
    // zelf, niet op een vaste tijd.
    await page.waitForSelector('.reveal-card:not([hidden])', { timeout: 30_000 });
  },
  podium: async (page) => {
    await naarSpel(page);
    // Vijf rondes van ~14 s in de mock. Traag, maar dit is de enige manier om
    // het echte eindscherm te zien in plaats van een nagebouwd scherm.
    await page.waitForSelector('.podium-steps', { timeout: 180_000 });
  },
};

/** De gedeelde weg naar een lopende ronde. */
async function naarSpel(page) {
  await page.click('.home-quick-start');
  await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
  await page.click('.lobby-start button, button.lobby-start');
  await page.waitForSelector('.gameplay-options .gameplay-option', { timeout: 20_000 });
}
if (!(flow in FLOWS)) {
  console.error(`onbekende flow "${flow}" — kies uit: ${Object.keys(FLOWS).join(', ')}`);
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
});
const page = await context.newPage();

const url = `${basis.replace(/\/$/, '')}/?mock=1`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await FLOWS[flow](page);
// Even laten bedaren: de app mount zijn views na de eerste render.
await page.waitForTimeout(700);

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

const map = path.join('tools', 'shots');
await mkdir(map, { recursive: true });
const bestand = path.join(map, `${flow}.png`);
await page.screenshot({ path: bestand, fullPage: false });

await browser.close();

const oordeel = rapport.scrolt ? 'PAST NIET' : 'PAST';
console.log(JSON.stringify({ flow, url, oordeel, ...rapport, screenshot: bestand }, null, 2));
process.exit(rapport.scrolt ? 1 : 0);
