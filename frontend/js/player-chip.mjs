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
 * @param {{ name: string, playerId: string, isSelf?: boolean }} speler
 * @returns {HTMLElement}
 */
export function createPlayerChip({ name, playerId, isSelf = false }) {
  const chip = document.createElement('span');
  chip.className = isSelf ? 'player-chip is-self' : 'player-chip';

  const { kleur, vorm } = identiteitVoor(playerId);

  const merk = document.createElement('span');
  merk.className = `player-chip-mark is-${vorm}`;
  merk.style.backgroundColor = kleur;
  // Puur decoratief: de naam ernaast draagt de betekenis. `08` §2.3 — kleur
  // mag nooit de enige drager zijn, en dat is hij hier ook niet.
  merk.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'player-chip-name';
  // Altijd `textContent`: dit is gebruikersinvoer.
  label.textContent = name;
  // De naam kapt visueel af (CSS), maar blijft volledig beschikbaar voor een
  // screenreader en als tooltip — `05` §8.
  label.title = name;

  chip.append(merk, label);
  return chip;
}
