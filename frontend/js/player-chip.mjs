// player-chip.mjs — T2-4. Naam plus een tijdelijke kleur/symboolidentiteit
// (`05` §8, besluit `D-022`).
//
// Een lijst namen wordt hiermee een groepje mensen. Het kost geen account,
// geen avatar en geen opslag: kleur en symbool worden berekend uit de
// `playerId`, dus dezelfde speler krijgt op elk apparaat en bij elke render
// hetzelfde — zonder dat er iets bewaard hoeft te worden.
//
// Geen emoji en geen figuurtjes: `05` §3 vraagt om geometrische vormen, en
// `D-022` sluit avatars en kinderkarakters uit. De acht vormen hieronder zijn
// pure CSS (`clip-path`), dus geen SVG, geen `innerHTML`, geen extra assets.
//
// Botsingen zijn geen bug. Bij twintig spelers en acht kleuren delen mensen een
// kleur; de naam blijft de dragende informatie, kleur en symbool versnellen
// alleen de herkenning. Bouw er dus geen uniciteitsgarantie omheen.

/** Acht tinten die op zowel het donkere als het lichte oppervlak leesbaar zijn. */
export const PALET = Object.freeze([
  '#e2574c',
  '#e59f3a',
  '#6cbf5a',
  '#3fb6a8',
  '#4a9fe0',
  '#8b7fe8',
  '#d472c4',
  '#9aa3b8',
]);

/** Namen komen overeen met de `clip-path`-vormen in components.css. */
export const VORMEN = Object.freeze([
  'cirkel',
  'vierkant',
  'driehoek',
  'ruit',
  'vijfhoek',
  'zeshoek',
  'ster',
  'kruis',
]);

/**
 * Kleine, stabiele hash (FNV-1a). Bewust geen `Math.random` en geen opslag:
 * de identiteit moet reproduceerbaar zijn op elk apparaat.
 *
 * @param {string} waarde
 * @returns {number} niet-negatief geheel getal
 */
export function hash(waarde) {
  const tekst = typeof waarde === 'string' ? waarde : String(waarde ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * @param {string} playerId
 * @returns {{ kleur: string, vorm: string, kleurIndex: number, vormIndex: number }}
 */
export function identiteitVoor(playerId) {
  const h = hash(playerId);
  const kleurIndex = h % PALET.length;
  // Een tweede, andere afgeleide zodat kleur en vorm niet aan elkaar
  // vastzitten — anders krijgt elke rode speler ook altijd dezelfde vorm en
  // heb je acht combinaties in plaats van vierenzestig.
  const vormIndex = Math.floor(h / PALET.length) % VORMEN.length;
  return { kleur: PALET[kleurIndex], vorm: VORMEN[vormIndex], kleurIndex, vormIndex };
}

/**
 * Serverkleuren (feedbackronde 4 aug, `player:recolor`): het gesloten palet
 * van de server, gemapt op de 1c-merkkleuren. Als de server (of een oudere
 * snapshot) geen kleur meegeeft valt de chip terug op de bestaande
 * hash-identiteit — nooit kleurloos.
 *
 * Sleutels én volgorde moeten exact `PLAYER_COLORS` volgen (bewaakt door
 * `player-chip.test.mjs`): dit is een weergave van een gesloten enum, geen
 * eigen lijst.
 *
 * Zestien sinds besluit 42 (5 aug 2026). De eerste acht zijn ongewijzigd — er
 * leven rooms met een speler die `purple` heeft. De acht nieuwe zijn dieper:
 * de heldere acht halen 5,7–16:1 op donker maar 1,05–2,96:1 op licht, de
 * nieuwe halen ≥3,3:1 op béíde. Dat lichtheidsverschil is meteen ook wat ze
 * onderscheidbaar houdt van hun heldere buur (blue naast cyan, rose naast
 * magenta) — de kleinste onderlinge afstand in het palet van zestien is nog
 * altijd het bestaande paar magenta/red (OKLab 0,097).
 */
export const SERVER_KLEUREN = Object.freeze({
  orange: '#ff8a3e',
  magenta: '#ff3ea5',
  cyan: '#4ad2ff',
  green: '#3ec97f',
  yellow: '#ffd23e',
  purple: '#b98aff',
  lime: '#d8ff3e',
  red: '#ff4d67',
  blue: '#1f7ae0',
  teal: '#0f9285',
  indigo: '#6a4fe6',
  violet: '#b34ad6',
  rose: '#c8377e',
  moss: '#4f9422',
  rust: '#b8542a',
  slate: '#63718c',
});

/**
 * @param {{ name: string, playerId: string, isSelf?: boolean, color?: string | null, flagUrl?: string | null }} speler
 * @returns {HTMLElement}
 */
export function createPlayerChip({ name, playerId, isSelf = false, color = null, flagUrl = null }) {
  const chip = document.createElement('span');
  chip.className = isSelf ? 'player-chip is-self' : 'player-chip';

  let { kleur, vorm } = identiteitVoor(playerId);
  if (typeof color === 'string' && color in SERVER_KLEUREN) {
    kleur = SERVER_KLEUREN[color];
  }

  const merk = document.createElement('span');
  merk.className = `player-chip-mark is-${vorm}`;
  merk.style.backgroundColor = kleur;
  // Puur decoratief: de naam ernaast draagt de betekenis. `08` §2.3 — kleur
  // mag nooit de enige drager zijn, en dat is hij hier ook niet.
  merk.setAttribute('aria-hidden', 'true');

  chip.append(merk);

  // spelersidentiteit.md, stap 5: vlag bij een gegenereerde identiteit
  // ("Bulgaarse Koe") — `null` bij een zelfgekozen naam, dus dan blijft dit
  // gewoon weg i.p.v. een lege plek te reserveren.
  if (typeof flagUrl === 'string') {
    const flag = document.createElement('img');
    flag.className = 'player-chip-flag';
    flag.src = flagUrl;
    flag.alt = '';
    chip.append(flag);
  }

  const label = document.createElement('span');
  label.className = 'player-chip-name';
  // Altijd `textContent`: dit is gebruikersinvoer.
  label.textContent = name;
  // De naam kapt visueel af (CSS), maar blijft volledig beschikbaar voor een
  // screenreader en als tooltip — `05` §8.
  label.title = name;

  chip.append(label);
  return chip;
}
