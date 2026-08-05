// solo-store.mjs — ronde 3 fase 3 ("solo overleeft reload"). Zelfde patroon
// als `session-store.mjs` (vaste sleutel per code, defensieve validatie bij
// het laden) en `preferences.mjs` (`safeGet`/`safeSet` vangen een gooiende
// storage op — privémodus, vol quotum — zonder de rest van de UI te breken).
//
// Los bestand van `session-store.mjs`: dat bewaart alleen het "toegangsbewijs"
// (sessionToken/roomCode/playerId) in `localStorage`, dit bewaart de volledige
// mock-roomstate in `sessionStorage`. Bewust een ANDERE storage: een
// solopartij is per definitie het geheugen van één paginalaad — `sessionStorage`
// overleeft een herlaadbeurt (waar dit voor gebouwd is) maar niet het sluiten
// van het tabblad, en bloedt niet mee naar een nieuw tabblad. `localStorage`
// zou een oude, afgelopen solopartij voor onbepaalde tijd laten rondslingeren.
//
// Deze module kent de VORM van een mock-roomsnapshot niet inhoudelijk — dat
// contract (`serializeRoomState`/`deserializeRoomState`) leeft in
// `transport-mock.mjs`. Hier wordt alleen genoeg gevalideerd om een corrupte
// of onbruikbare waarde niet als geldig door te laten (crash in
// `deserializeRoomState` voorkomen), niet om de spelinhoud te beoordelen.

const KEY_PREFIX = 'mp:solo:';

/** @param {string} roomCode @returns {string} */
export function soloStateKeyFor(roomCode) {
  return `${KEY_PREFIX}${roomCode}`;
}

/**
 * @param {{setItem:(k:string,v:string)=>void}} storage
 * @param {string} roomCode
 * @param {object} state
 */
export function saveSoloState(storage, roomCode, state) {
  if (typeof roomCode !== 'string' || roomCode.length === 0) {
    return;
  }
  safeSet(storage, soloStateKeyFor(roomCode), JSON.stringify(state));
}

/**
 * @param {{getItem:(k:string)=>string|null}} storage
 * @param {string} roomCode
 * @returns {object | null} `null` als er niets bruikbaars ligt opgeslagen
 */
export function loadSoloState(storage, roomCode) {
  const raw = safeGet(storage, soloStateKeyFor(roomCode));
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return isPlausibleSoloState(parsed, roomCode) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {{removeItem:(k:string)=>void}} storage
 * @param {string} roomCode
 */
export function clearSoloState(storage, roomCode) {
  if (typeof roomCode !== 'string' || roomCode.length === 0) {
    return;
  }
  safeRemove(storage, soloStateKeyFor(roomCode));
}

// Vormcheck, geen inhoudelijke keuring: `deserializeRoomState` (transport-mock.mjs)
// is de enige plek die weet of dit ook een SPÉELBARE room oplevert (content-
// versie, speelbaar gametype, …) en gooit zelf een fout als dat niet zo is —
// `app.mjs` vangt die af met dezelfde terugval als "niets gevonden".
function isPlausibleSoloState(value, roomCode) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.gameCode === roomCode &&
    typeof value.phase === 'string' &&
    Array.isArray(value.players) &&
    Array.isArray(value.sessions)
  );
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

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // stil falen, zie doc-comment hierboven
  }
}
