// passport-store.mjs — besluit 53 (docs/openstaand/paspoort.md): "welke
// landen heb je al gehad". Zelfde patroon als `session-store.mjs`/
// `solo-store.mjs` (vaste sleutel, `safeGet`/`safeSet` vangen een gooiende
// storage op) en `preferences.mjs`.
//
// BEWUST `localStorage`, niet `sessionStorage` en niet de room/sessie: het
// paspoort hoort bij het APPARAAT, niet bij één room (die leeft hooguit
// `ROOM_TTL_SECONDS`) en niet bij één tabblad. Precies de reden die het
// besluit zelf noemt: "je paspoort zou anders verdwijnen op het moment dat
// het interessant wordt".
//
// Deze module weet niets van rondes, gameTypes of `round:ended` — dat is
// contentbeslissing/eventinterpretatie en hoort bij de aanroeper
// (`frontend/js/session/passport-tracker.mjs`). Hier staat alleen de kale
// opslag: welke iso2-codes, en wanneer voor het eerst gezien.

const KEY = 'mp:passport';

/**
 * @typedef {Record<string, number>} Passport iso2 (kleine letters) → epoch-ms
 *   van het eerste moment dat dit land werd gezien.
 */

/**
 * @param {{getItem:(k:string)=>string|null}} storage
 * @returns {Passport} `{}` als er niets (bruikbaars) ligt opgeslagen
 */
export function loadPassport(storage) {
  const raw = safeGet(storage, KEY);
  if (raw === null) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return isPlausiblePassport(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Tekent één land in, idempotent: een land dat al in het paspoort stond
 * behoudt zijn oorspronkelijke `seenAtMs` (het "eerste moment" verandert
 * niet met een latere ronde over hetzelfde land).
 *
 * @param {{getItem:(k:string)=>string|null, setItem:(k:string,v:string)=>void}} storage
 * @param {string} iso2 - hoofdletterongevoelig
 * @param {number} seenAtMs
 * @returns {{ passport: Passport, isNew: boolean }} `isNew` = stond dit land
 *   er nog niet in vóór deze aanroep — dát is wat "eruit gelicht" op het
 *   podium betekent, niet "nieuw deze partij" (zie passport-tracker.mjs).
 */
export function recordCountrySeen(storage, iso2, seenAtMs) {
  const key = typeof iso2 === 'string' ? iso2.toLowerCase() : '';
  const passport = loadPassport(storage);
  if (key.length === 0) {
    return { passport, isNew: false };
  }
  const isNew = !(key in passport);
  if (isNew) {
    const bijgewerkt = { ...passport, [key]: seenAtMs };
    safeSet(storage, KEY, JSON.stringify(bijgewerkt));
    return { passport: bijgewerkt, isNew: true };
  }
  return { passport, isNew: false };
}

function isPlausiblePassport(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(([iso2, seenAtMs]) => typeof iso2 === 'string' && typeof seenAtMs === 'number');
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Een gooiende storage mag de rest van de UI niet blokkeren — zie preferences.mjs. */
function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // stil falen, zie doc-comment hierboven
  }
}
