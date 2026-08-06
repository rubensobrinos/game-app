// contrast.test.mjs — T5-6 Laag 1: WCAG-contrastcontrole als draaibaar
// onderdeel van `node --test`, niet als eenmalig script (58eba07's
// licht-thema-fix gebeurde toen met een losstaand, niet-gecommit scriptje —
// dit is diezelfde berekening, nu zodat 'm bij élke tokenwijziging in
// `tokens.css` automatisch opnieuw draait i.p.v. met de hand nagerekend te
// worden).
//
// Scope: elke tekenkleurtoken die in de opgesplitste stylesheets als
// `color:` (niet `border-color`) voorkomt, tegen de kaartachtergronden waar
// die tekst in de praktijk op staat (`--color-bg-canvas`, `--color-surface-1`,
// `--color-surface-2`) — geen poging om de exacte DOM-nesting per selector na
// te bootsen, dat zou dit script net zo broos maken als de aanname die het
// moet vervangen. Een token moet AA (4,5:1) halen tegen de zwakste van die
// drie, in beide thema's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cssPath = fileURLToPath(new URL('./tokens.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

function extractBlock(source, startRegex) {
  const match = startRegex.exec(source);
  if (match === null) {
    throw new Error(`Blok niet gevonden voor ${startRegex}`);
  }
  const start = match.index + match[0].length;
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

function parseVars(block) {
  const vars = {};
  const re = /--([\w-]+):\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const num = Number.parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

const darkVars = parseVars(extractBlock(css, /:root\s*\{/));
const lightVars = { ...darkVars, ...parseVars(extractBlock(css, /:root\[data-theme=['"]light['"]\]\s*\{/)) };

// Alleen tokens die ergens als `color:` (tekst) gebruikt worden — zie de
// kop-comment. Geverifieerd tegen `components.css`, niet aangenomen.
const TEXT_TOKENS = [
  '--color-text-primary',
  '--color-text-muted',
  '--color-danger',
  '--color-success',
  '--color-warning',
  '--color-accent-competition',
  '--color-accent-primary-hover',
  // Signaalpalet uit 1c — opgenomen als systeemtoken in `tokens.css` zodat
  // licht en donker één bron delen. Alleen de tinten die als tekst kunnen
  // dienen; `-lime-dim` is een vlakkleur en valt buiten scope.
  '--color-signal-lime',
  '--color-signal-magenta',
  '--color-signal-cyan',
  '--color-signal-warm',
];
const BACKGROUND_TOKENS = ['--color-bg-canvas', '--color-surface-1', '--color-surface-2'];
const AA_NORMAL_TEXT = 4.5;

for (const [themeName, vars] of [['donker', darkVars], ['licht', lightVars]]) {
  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — ${themeName} thema`, () => {
    const failures = [];
    for (const fg of TEXT_TOKENS) {
      const fgValue = vars[fg];
      if (fgValue === undefined || !fgValue.startsWith('#')) {
        continue; // rgba()-tokens zijn hier geen platte tekstkleur, buiten scope
      }
      for (const bg of BACKGROUND_TOKENS) {
        const bgValue = vars[bg];
        const ratio = contrastRatio(fgValue, bgValue);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(`${fg} (${fgValue}) op ${bg} (${bgValue}): ${ratio.toFixed(2)}:1`);
        }
      }
    }
    assert.deepEqual(failures, [], `Contrast onder AA:\n${failures.join('\n')}`);
  });
}

// "Inkt op lime": `.btn-primary`/`.podium-rematch`'s tekst is een hardcoded
// `#0a0a0c` (components.css), geen token — de generieke sweep hierboven mist
// 'm dus, want die kent alleen tokens als achtergrond. Dit is de daadwerkelijk
// voorkomende combinatie (niet elke token-tegen-token-paar, dat zou hier
// grotendeels onzinnige combinaties testen die nergens in de DOM samenkomen),
// vastgelegd zodat een latere hertoewijzing (bv. `--color-text-primary`
// i.p.v. het hardcoded ink-getal) niet stilzwijgend op een bijna-witte tekst
// op lime uitkomt (1,05:1 — geverifieerd dat dát zou falen).
const COMPONENT_PAIRS = [
  { name: '.btn-primary/.podium-rematch tekst op --color-accent-primary ("inkt op lime")', fg: '#0a0a0c', bgToken: '--color-accent-primary' },
];

for (const [themeName, vars] of [['donker', darkVars], ['licht', lightVars]]) {
  test(`WCAG AA (${AA_NORMAL_TEXT}:1) component-paren — ${themeName} thema`, () => {
    const failures = [];
    for (const pair of COMPONENT_PAIRS) {
      const bgValue = vars[pair.bgToken];
      const ratio = contrastRatio(pair.fg, bgValue);
      if (ratio < AA_NORMAL_TEXT) {
        failures.push(`${pair.name}: ${pair.fg} op ${bgValue}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert.deepEqual(failures, [], `Contrast onder AA:\n${failures.join('\n')}`);
  });
}
