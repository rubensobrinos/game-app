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
// MOCK=0 rijdt dezelfde weg over de échte server en socket.
await page.goto(process.env.MOCK === '0' ? BASIS : `${BASIS}/?mock=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('.home-quick-start');
await page.waitForSelector('.lobby-screen', { timeout: 10_000 });
// MENUSCHERM=lobby meet het hostmenu in de LOBBY in plaats van tijdens het
// spel — daar hoort "Game beëindigen" al helemaal niet als eerste te staan.
if (process.env.MENUSCHERM === 'lobby') {
  await page.click('.app-menu-trigger');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/shots/hostmenu-lobby.png', fullPage: false });
  const inhoud = await page.evaluate(() =>
    [...document.querySelectorAll('#app-menu-host button, #app-menu-host li')]
      .filter((n) => n.getBoundingClientRect().height > 0)
      .map((n) => `${n.className.split(' ').at(-1)}:${(n.textContent ?? '').trim().slice(0, 24)}`));
  console.log(`[menu-lobby] ${JSON.stringify(inhoud)}`);
  await browser.close();
  process.exit(0);
}

await page.click('.lobby-start button, button.lobby-start');

// AFTELLEN=1 meet het aftelscherm (R2-8) i.p.v. de vraag: dat scherm bestaat
// maar één keer per potje en is voorbij zodra de eerste ronde begint.
if (process.env.AFTELLEN === '1') {
  await page.waitForSelector('.gameplay-countdown:not([hidden])', { timeout: 20_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/shots/aftellen.png', fullPage: false });
  const scherm = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.screen-top'));
    return { justify: cs.justifyContent, minH: cs.minHeight, gap: cs.rowGap };
  });
  console.log(`[aftellen] justify-content=${scherm.justify} min-height=${scherm.minH} gap=${scherm.gap}`);
} else {
  await page.waitForSelector('.gameplay-options .gameplay-option', { timeout: 20_000 });
  await page.waitForTimeout(800);
}
// MENU=1 opent het hostmenu op het spelscherm (D3, punt 51): meet hoeveel van
// de vraag, de vlag en de antwoorden het paneel bedekt.
if (process.env.MENU === '1') {
  await page.click('.app-menu-trigger');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/shots/hostmenu.png', fullPage: false });
  const dekking = await page.evaluate(() => {
    const paneel = document.querySelector('.app-menu-panel, #app-menu-panel');
    if (paneel === null) return null;
    const p = paneel.getBoundingClientRect();
    const overlap = (sel) => {
      const n = document.querySelector(sel);
      if (n === null) return null;
      const r = n.getBoundingClientRect();
      const h = Math.max(0, Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top));
      const b = Math.max(0, Math.min(p.right, r.right) - Math.max(p.left, r.left));
      return { hoogte: Math.round(r.height), bedekt: Math.round((h * b) / (r.height * r.width || 1) * 100) };
    };
    const host = document.getElementById('app-menu-host');
    return {
      paneel: { top: Math.round(p.top), hoogte: Math.round(p.height), breedte: Math.round(p.width) },
      hostsectie: host === null ? null : Math.round(host.getBoundingClientRect().height),
      vraag: overlap('.gameplay-question'),
      vlag: overlap('.gameplay-flag'),
      antwoorden: overlap('.gameplay-options'),
      zichtbaar: [...document.querySelectorAll('#app-menu-host button, #app-menu-host li')]
        .filter((n) => n.getBoundingClientRect().height > 0)
        .map((n) => `${n.className.split(' ').at(-1)}:${(n.textContent ?? '').trim().slice(0, 24)}`),
    };
  });
  console.log(`[menu] ${JSON.stringify(dekking, null, 2)}`);

  // MENUDIEP=1 klikt door naar de bevestigingsstap van "Game beëindigen":
  // dát is de stap die de producteigenaar moet kunnen beoordelen.
  // MENUDIEP=sluiten toetst de belofte "als je verkeerd klikt moet je weer
  // opnieuw beginnen": een half ingezette bevestiging mag een menusluiting
  // niet overleven, én het menu moet daarna gewoon weer gevuld opengaan.
  if (process.env.MENUDIEP === 'sluiten') {
    await page.click('.session-hostbar-settings-toggle');
    await page.click('.session-hostbar-finish');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.click('.app-menu-trigger');
    await page.waitForTimeout(250);
    const naHeropenen = await page.evaluate(() => ({
      menuOpen: document.querySelector('.app-menu')?.hidden === false,
      slotVerborgen: document.getElementById('app-menu-host')?.hidden,
      paneelVerborgen: document.querySelector('.session-hostbar-panel')?.hidden,
      zichtbaar: [...document.querySelectorAll('#app-menu-host button')]
        .filter((n) => n.getBoundingClientRect().height > 0)
        .map((n) => n.className.split(' ').at(-1)),
      ladeOpen: document.querySelector('.session-hostbar-settings')?.hidden === false,
      bevestigingOpen: document.querySelector('.session-hostbar-settings .session-hostbar-confirm')?.hidden === false,
    }));
    console.log(`[menu-sluiten] ${JSON.stringify(naHeropenen)}`);
  }

  // MENUDIEP=spelers loopt dezelfde weg af voor "Verwijder".
  if (process.env.MENUDIEP === 'spelers') {
    await page.click('.session-hostbar-players-toggle');
    await page.waitForTimeout(150);
    await page.click('.session-hostbar-player-menu');
    await page.waitForTimeout(150);
    await page.click('.session-hostbar-kick');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'tools/shots/hostmenu-verwijder.png', fullPage: false });
    const vraag = await page.textContent('.session-hostbar-confirm-row .session-hostbar-confirm-question');
    console.log(`[menu-verwijder] "${vraag}"`);
  }
  if (process.env.MENUDIEP === '1') {
    await page.click('.session-hostbar-settings-toggle');
    await page.waitForTimeout(150);
    await page.click('.session-hostbar-finish');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'tools/shots/hostmenu-bevestiging.png', fullPage: false });
    const vraag = await page.textContent('.session-hostbar-settings .session-hostbar-confirm-question');
    console.log(`[menu-bevestiging] "${vraag}"`);
  }
}

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
