// contrast-1c.test.mjs — WCAG-contrastcontrole voor `rounda-1c.css` (ronde 3,
// agent 3, fase 2). `contrast.test.mjs` dekt alleen de kleurtokens in
// `base.css`/`components.css`; de hardgecodeerde 1c-kleuren daarbuiten hadden
// geen enkele controle — zo kon een labelkleur op de magenta revealkaart
// ongemerkt op 4,30:1 zakken (AA eist 4,5:1).
//
// Andere methode dan de brede token-sweep in `contrast.test.mjs`: de meeste
// 1c-kleuren zijn geen tokens maar losse hex-waarden per selector, dus is er
// geen generieke lijst "tekstkleuren × achtergrondkleuren" te draaien zonder
// onzincombinaties te testen. In plaats daarvan leest elk paar hieronder de
// écht gedeclareerde `color`/`background` uit `rounda-1c.css` zelf (en uit
// `base.css` voor tokens) — geen losstaande kopie van wat de kleur "hoort" te
// zijn. Zo faalt de test ook echt als iemand een van deze regels per ongeluk
// terugdraait (geverifieerd door de fix tijdelijk te stashen: alle paren die
// deze fase repareert, faalden toen op precies de gemeten verhoudingen uit de
// oplevering).
//
// Wat hier bewust NIET in zit (zie de oplevering bij deze fase voor de
// volledige lijst met gemeten verhoudingen):
// - het bredere grijzenpalet (#5c5c6b/#8e8e9c/#7c7c8b/#9a9aa8/#d4d4de/#b9b9c6)
//   dat op tientallen plekken rechtstreeks op het canvas staat: zakt op
//   meerdere plekken door AA — óók al in het donkere thema — maar welke
//   grijstrap welke vervangt is een ontwerpbeslissing, geen bugfix.
// - `.lobby-start-sub` op de startknop in het lichte thema (2,71:1): er
//   bestaat geen eerder-goedgekeurde vervangkleur voor dit paar.
// - `.lobby-seg-option.is-soon`: bewust uitgeschakeld ("SOON"), zoals de
//   uitgeschakelde-knop-uitzondering uit de opdracht.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const basePath = fileURLToPath(new URL('./base.css', import.meta.url));
const baseCss = readFileSync(basePath, 'utf8');
const oneCPath = fileURLToPath(new URL('./rounda-1c.css', import.meta.url));
const oneCCss = readFileSync(oneCPath, 'utf8');

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

// Vindt de body van de eerste regel na `needle` in `source` (niet-geneste
// CSS-regels, wat hier overal het geval is). `needle` mag een fragment van
// een gegroepeerde selector zijn (bv. één regel uit een kommalijst).
function ruleBodyAfter(source, needle) {
  const idx = source.indexOf(needle);
  if (idx === -1) {
    throw new Error(`Selector-fragment niet gevonden: ${needle}`);
  }
  const braceStart = source.indexOf('{', idx);
  const braceEnd = source.indexOf('}', braceStart);
  return source.slice(braceStart + 1, braceEnd);
}

function declValue(body, prop) {
  const re = new RegExp(`(?:^|;|\\{)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = re.exec(body);
  if (m === null) {
    throw new Error(`Declaratie \`${prop}\` niet gevonden in: ${body}`);
  }
  return m[1].trim();
}

function resolveColor(raw, vars) {
  if (raw.startsWith('--')) {
    if (vars[raw] === undefined) {
      throw new Error(`Onbekende variabele ${raw}`);
    }
    return resolveColor(vars[raw], vars);
  }
  const m = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(raw);
  if (m === null) return raw;
  const [, name, fallback] = m;
  if (vars[name] !== undefined) return resolveColor(vars[name], vars);
  if (fallback !== undefined) return resolveColor(fallback.trim(), vars);
  throw new Error(`Kan ${raw} niet oplossen — geen var en geen fallback`);
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

// Voor `.reveal-card-why`: ink op minder dan volledige dekking bovenop de
// lime kaart — de effectief zichtbare kleur is het mengsel, niet de losse hex.
function blend(fgHex, bgHex, alpha) {
  const [fr, fg, fb] = hexToRgb(fgHex);
  const [br, bg, bb] = hexToRgb(bgHex);
  const mix = (f, b) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg, bg), mix(fb, bb)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const darkBase = parseVars(extractBlock(baseCss, /:root\s*\{/));
const lightBase = { ...darkBase, ...parseVars(extractBlock(baseCss, /:root\[data-theme=['"]light['"]\]\s*\{/)) };
const oneCVars = parseVars(extractBlock(oneCCss, /:root\s*\{/));
const darkVars = { ...darkBase, ...oneCVars };
const lightVars = { ...lightBase, ...oneCVars };

const AA_NORMAL_TEXT = 4.5;

function assertPair(name, fgRaw, bgRaw, vars) {
  const fg = resolveColor(fgRaw, vars);
  const bg = resolveColor(bgRaw, vars);
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= AA_NORMAL_TEXT,
    `${name}: ${fgRaw} → ${fg} op ${bgRaw} → ${bg} = ${ratio.toFixed(2)}:1, AA eist ${AA_NORMAL_TEXT}:1`,
  );
}

for (const [themeName, vars] of [['donker', darkVars], ['licht', lightVars]]) {
  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .home-code-input tekst op eigen kaartachtergrond (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const body = isLight
      ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .home-code-input")
      : ruleBodyAfter(oneCCss, '.home-code-input {');
    const darkOnlyBody = ruleBodyAfter(oneCCss, '.home-code-input {');
    const fg = declValue(darkOnlyBody, 'color'); // tekstkleur wisselt zelf niet, alleen via het token
    const bg = declValue(body, 'background');
    assertPair('.home-code-input', fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .reveal-card[noanswer] .reveal-card-answer, kaart blijft bewust donker (${themeName})`, () => {
    const fg = declValue(ruleBodyAfter(oneCCss, ".reveal-card[data-state='noanswer'] .reveal-card-answer {"), 'color');
    const bg = declValue(ruleBodyAfter(oneCCss, ".reveal-card[data-state='noanswer'] {"), 'background');
    assertPair(".reveal-card[noanswer] .reveal-card-answer", fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .scoreboard-score / .podium-score (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const fg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .scoreboard-score,")
        : ruleBodyAfter(oneCCss, '.scoreboard-score, .podium-score {'),
      'color',
    );
    const bg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .scoreboard-entry,")
        : ruleBodyAfter(oneCCss, '.scoreboard-entry, .podium-step {'),
      'background',
    );
    assertPair('.scoreboard-score/.podium-score', fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .reveal-self-points, goed antwoord (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const fg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .reveal-self-points")
        : ruleBodyAfter(oneCCss, '.reveal-self-points {'),
      'color',
    );
    const bg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .reveal-self {")
        : ruleBodyAfter(oneCCss, '.reveal-self {'),
      'background',
    );
    assertPair('.reveal-self-points', fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .gameplay-countdown-players (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const fg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .gameplay-countdown-players")
        : ruleBodyAfter(oneCCss, '.gameplay-countdown-players {'),
      'color',
    );
    assertPair('.gameplay-countdown-players (op canvas, geen kaart)', fg, '--color-bg-canvas', vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .gameplay-countdown-value (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const fg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .gameplay-countdown-value")
        : ruleBodyAfter(oneCCss, '.gameplay-countdown-value {'),
      'color',
    );
    assertPair('.gameplay-countdown-value (op canvas, geen kaart)', fg, '--color-bg-canvas', vars);
  });

  // Regressiebewakers voor bestaande (niet door deze fase gewijzigde) paren
  // die tot nu toe ongetest waren, inclusief het bekende bijna-mis-geval.
  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — reveal-card[wrong] labels op de magenta kaart (${themeName})`, () => {
    const fg = declValue(ruleBodyAfter(oneCCss, ".reveal-card[data-state='wrong'] .reveal-card-label,"), 'color');
    const bg = declValue(ruleBodyAfter(oneCCss, ".reveal-card[data-state='wrong'] {"), 'background');
    assertPair('reveal-card[wrong] labels', fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — inkt op lime: .gameplay-option.is-selected (${themeName})`, () => {
    const body = ruleBodyAfter(oneCCss, '.gameplay-option.is-selected {');
    assertPair('.gameplay-option.is-selected', declValue(body, 'color'), declValue(body, 'background'), vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — inkt op lime: .lobby-seg-option.is-active (${themeName})`, () => {
    const body = ruleBodyAfter(oneCCss, '.lobby-seg-option.is-active {');
    assertPair('.lobby-seg-option.is-active', declValue(body, 'color'), declValue(body, 'background'), vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .reveal-card-label/.reveal-card-count tegen de lime kaart (${themeName})`, () => {
    const isLight = themeName === 'licht';
    const fg = declValue(
      isLight
        ? ruleBodyAfter(oneCCss, ":root[data-theme='light'] .reveal-card-label,")
        : ruleBodyAfter(oneCCss, '.reveal-card-label {'),
      'color',
    );
    const bg = declValue(ruleBodyAfter(oneCCss, '.reveal-card {'), 'background');
    assertPair('.reveal-card-label/.reveal-card-count', fg, bg, vars);
  });

  test(`WCAG AA (${AA_NORMAL_TEXT}:1) — .lobby-gamecard-title tegen elk punt van de lime-gradient (${themeName})`, () => {
    const bgRaw = declValue(ruleBodyAfter(oneCCss, '.lobby-gamecard {'), 'background');
    const fg = declValue(ruleBodyAfter(oneCCss, '.lobby-gamecard-title {'), 'color');
    const stops = bgRaw.match(/#[0-9a-fA-F]{3,6}/g);
    assert.ok(stops && stops.length > 0, `Geen kleurstops gevonden in gradient: ${bgRaw}`);
    const fgResolved = resolveColor(fg, vars);
    const failures = stops
      .map((stop) => [stop, contrastRatio(fgResolved, stop)])
      .filter(([, ratio]) => ratio < AA_NORMAL_TEXT);
    assert.deepEqual(failures, [], `.lobby-gamecard-title (${fgResolved}) faalt tegen: ${failures.map(([s, r]) => `${s} (${r.toFixed(2)}:1)`).join(', ')}`);
  });
}

test('WCAG AA — .reveal-card-why (ink met opacity op de lime kaart)', () => {
  const whyBody = ruleBodyAfter(oneCCss, '.reveal-card-why {');
  const fg = declValue(whyBody, 'color');
  const alpha = Number.parseFloat(declValue(whyBody, 'opacity'));
  const bg = resolveColor(declValue(ruleBodyAfter(oneCCss, '.reveal-card {'), 'background'), darkVars);
  const blended = blend(fg, bg, alpha);
  const ratio = contrastRatio(blended, bg);
  assert.ok(
    ratio >= AA_NORMAL_TEXT,
    `.reveal-card-why: ${fg}@${alpha} (${blended}) op ${bg} = ${ratio.toFixed(2)}:1, AA eist ${AA_NORMAL_TEXT}:1`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// VOLLEDIGHEIDSCONTROLE (review fase 2, lead)
// ─────────────────────────────────────────────────────────────────────────────
//
// De tests hierboven zijn een handmatige lijst paren. Dat vangt wat erin staat
// en niets daarbuiten — en precies dáár ging het mis: `.home-code-go` (de
// Go-knop op home) stond op lime tekst zonder lichte tegenhanger en kwam op
// **1,15:1** uit. Onleesbaar, en geen enkele test die het merkte.
//
// Deze controle draait het om. In plaats van te toetsen wat we hebben
// opgeschreven, leest hij ÉLKE regel in `rounda-1c.css` die lime als
// tekstkleur zet, en eist per regel een van tweeën:
//
//   1. een `:root[data-theme='light']`-tegenhanger voor diezelfde selector
//      (lime op wit haalt nooit AA — zie base.css: ~1,2:1), óf
//   2. een expliciete post in `LIME_OP_DONKER` mét reden.
//
// Wie een nieuwe lime-regel toevoegt, moet dus één van beide doen. Vergeten
// kan niet meer.
const LIME_OP_DONKER = {
  '.room-qr-code':
    'staat op de QR-kaart, die met `background: #101015` in beide thema’s donker blijft',
  '.home-solo-link:hover':
    'hoverstaat; de rustkleur is grijs en valt onder de grijzenafweging hieronder',
  '.home-solo-link:focus-visible':
    'idem — zelfde regel als de hover',
  '.rounda-flag-score':
    'staat op de donkere minigamekaart (gemeten 16,51:1 in het lichte thema)',
};

test('Volledigheid: elke lime tekstregel heeft een lichte tegenhanger of een reden', () => {
  const zonderCommentaar = oneCCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const regels = /([^{}]+)\{([^{}]*)\}/g;
  const limeSelectors = [];
  const lichteOverrides = new Set();
  let m;
  while ((m = regels.exec(zonderCommentaar)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@')) continue;
    const kleur = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(m[2]);
    if (kleur === null) continue;
    if (selector.includes("data-theme='light'")) {
      for (const deel of selector.split(',')) {
        lichteOverrides.add(deel.replace(/:root\[data-theme='light'\]\s*/, '').trim());
      }
      continue;
    }
    if (/--rounda-lime|#d8ff3e/i.test(kleur[1])) {
      for (const deel of selector.split(',')) limeSelectors.push(deel.trim());
    }
  }

  assert.ok(limeSelectors.length > 0, 'geen enkele lime tekstregel gevonden — parser stuk?');

  const onbeschermd = limeSelectors.filter(
    (sel) => !lichteOverrides.has(sel) && LIME_OP_DONKER[sel] === undefined,
  );
  assert.deepEqual(
    onbeschermd,
    [],
    `Lime tekst zonder lichte tegenhanger en zonder reden: ${onbeschermd.join(', ')}. `
    + 'Voeg een `:root[data-theme=\'light\']`-regel toe, of zet de selector in '
    + 'LIME_OP_DONKER met de reden waarom hij ook op licht op een donker vlak staat.',
  );
});
