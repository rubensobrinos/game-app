// preferences.mjs — UI1. Voorkeuren die los staan van elke spelsessie: de
// apptaal van de UI zelf (NIET de taal waarin vragen gesteld worden — dat is
// `host-setup-state`'s `config.language`, een game-instelling) en het
// licht/donker-thema. Puur lezen/schrijven/valideren; de daadwerkelijke
// toepassing (DOM, i18n.mjs, `data-theme`-attribuut) gebeurt in
// `app-menu.mjs`/`app.mjs`.

const LANG_KEY = 'mp:lang';
const THEME_KEY = 'mp:theme';
const MUTED_KEY = 'mp:muted';
const VALID_LANGS = new Set(['nl', 'en', 'es']);
const VALID_THEMES = new Set(['light', 'dark']);

/** @param {{getItem:(k:string)=>string|null}} storage @returns {string|null} null als er niets geldigs is opgeslagen */
export function loadLang(storage) {
  const value = safeGet(storage, LANG_KEY);
  return VALID_LANGS.has(value) ? value : null;
}

/** @param {{setItem:(k:string,v:string)=>void}} storage @param {string} lang */
export function saveLang(storage, lang) {
  if (VALID_LANGS.has(lang)) {
    safeSet(storage, LANG_KEY, lang);
  }
}

/** @param {{getItem:(k:string)=>string|null}} storage @returns {'light'|'dark'|null} null als er niets geldigs is opgeslagen */
export function loadTheme(storage) {
  const value = safeGet(storage, THEME_KEY);
  return VALID_THEMES.has(value) ? value : null;
}

/** @param {{setItem:(k:string,v:string)=>void}} storage @param {string} theme */
export function saveTheme(storage, theme) {
  if (VALID_THEMES.has(theme)) {
    safeSet(storage, THEME_KEY, theme);
  }
}

/**
 * Voorkeurlaag voor geluid-mute. Nog geen zichtbare schakelaar (die komt
 * pas met het eerste echte audiosignaal) — alleen lezen/schrijven/valideren,
 * zodat toekomstig geluidswerk hier meteen op kan bouwen.
 * @param {{getItem:(k:string)=>string|null}} storage @returns {boolean|null} null als er niets geldigs is opgeslagen
 */
export function loadMuted(storage) {
  const value = safeGet(storage, MUTED_KEY);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/** @param {{setItem:(k:string,v:string)=>void}} storage @param {boolean} muted */
export function saveMuted(storage, muted) {
  if (typeof muted === 'boolean') {
    safeSet(storage, MUTED_KEY, String(muted));
  }
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Een gooiende storage (privacymodus, vol quotum) mag de rest van de UI niet
 * blokkeren — de voorkeur blijft dan gewoon niet bewaard.
 */
function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // stil falen, zie doc-comment hierboven
  }
}
