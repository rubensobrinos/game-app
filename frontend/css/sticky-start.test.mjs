// sticky-start.test.mjs — punt 32 (pakket B).
//
// WAAROM EEN CSS-TEST. De echte meting van dit punt draait in een browser
// (Playwright, 390×650) en kan niet in `npm test`: die suite mag geen browser
// nodig hebben. Wat hier gebeurt is het vastzetten van de UITKOMST van die
// meting, zodat de regel die het probleem oplost niet stilletjes sneuvelt bij
// een volgende opruimronde. Zelfde redenering als `contrast.test.mjs`.
//
// DE METING (5 aug 2026, lobby met de hostinstellingen opengeklapt):
//   - de startknop is 85 px hoog en `position: sticky; bottom: 0`;
//   - tabbend met een toetsenbord landde 9 van de 16 instellingen ACHTER de
//     knop (tot 44 px eronder) — dus onbereikbaar;
//   - met `scroll-padding-bottom` op de scroller: 0 van de 16.
//
// Bewust NIET vastgelegd: een bottom-padding onder de kolom. Gemeten leverde
// die 0 px minder overlap op en 101 px méér scrollhoogte — het tegendeel van
// wat het ruimtebudget vraagt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./rounda-1c.css', import.meta.url)), 'utf8');
const base = readFileSync(fileURLToPath(new URL('./base.css', import.meta.url)), 'utf8');

test('punt 32: de startknop blijft sticky — dat is een productbesluit, geen bug', () => {
  // Beschermt tegen de "fix" die de review zou afkeuren: sticky weghalen.
  assert.match(base, /\.lobby-start \{[^}]*position: sticky;/);
});

test('punt 32: de scroller reserveert de knophoogte, zodat focus er niet achter landt', () => {
  const regel = /html:has\(\.lobby-screen\)\s*\{([^}]*)\}/.exec(css);
  assert.notEqual(regel, null, 'de reserveringsregel ontbreekt');
  assert.match(regel[1], /scroll-padding-bottom:/);

  // Op `html` en nergens anders: de PAGINA is de scroller in de lobby, dus
  // `scroll-padding` op een binnenelement doet niets. Deze test is er vooral
  // om die valkuil vast te leggen voor wie de regel ooit verplaatst.
  assert.equal(
    /\.screen-top:has\(\.lobby-screen\)\s*\{[^}]*scroll-padding-bottom/.test(css),
    false,
    'scroll-padding op .screen-top werkt niet — die is niet de scroller',
  );
});

test('punt 32: de reservering is minstens zo hoog als de knop zelf (85 px)', () => {
  const regel = /html:has\(\.lobby-screen\)\s*\{([^}]*)\}/.exec(css);
  const waarde = /scroll-padding-bottom:\s*([^;]+);/.exec(regel[1])[1];
  const pixels = [...waarde.matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(pixels.length > 0, `geen pixelmaat in "${waarde}"`);
  assert.ok(
    pixels.reduce((a, b) => a + b, 0) >= 85,
    `gemeten knophoogte is 85px, gereserveerd wordt ${waarde}`,
  );
});

// ── B3: de foute revealkaart is magenta; de labels erop moeten leesbaar
//    blijven. `contrast.test.mjs` dekt alleen de tokens in base.css/
//    components.css, dus deze twee hardgecodeerde 1c-kleuren vielen buiten
//    elke controle. De eerste poging (#5c0035) haalde 4,30:1 en zakte door
//    AA heen — precies waarom dit hier staat. ─────────────────────────────

function relatieveLuminantie(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const kanalen = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * kanalen[0] + 0.7152 * kanalen[1] + 0.0722 * kanalen[2];
}

function contrast(a, b) {
  const [licht, donker] = [relatieveLuminantie(a), relatieveLuminantie(b)].sort((x, y) => y - x);
  return (licht + 0.05) / (donker + 0.05);
}

test('B3: de labels op de magenta revealkaart halen AA (4,5:1)', () => {
  const blok = /\.reveal-card\[data-state='wrong'\] \.reveal-card-label,[\s\S]*?\{([^}]*)\}/.exec(css);
  assert.notEqual(blok, null, 'de labelkleur voor de foute kaart ontbreekt');
  const kleur = /color:\s*(#[0-9a-f]{6})/i.exec(blok[1])[1];

  const magenta = /--rounda-magenta:\s*(#[0-9a-f]{6})/i.exec(css)[1];
  const verhouding = contrast(kleur, magenta);
  assert.ok(
    verhouding >= 4.5,
    `${kleur} op ${magenta} haalt ${verhouding.toFixed(2)}:1 — 10-11px tekst vraagt 4,5:1`,
  );
});
