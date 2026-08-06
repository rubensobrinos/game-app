// views/identity-display.mjs — UI2/UI3/UI4. De ENE plek die een
// `identity: { country, word }`-paar (server, spelersidentiteit.md stap 4)
// omzet naar wat een scherm nodig heeft: gerenderde tekst in de EIGEN
// apptaal (punt 8) en een vlagpad. Elke plek waar een speler wordt getoond —
// lobby (zelf.mjs/spelers.mjs), tussenstand, podium — roept dit aan i.p.v.
// zelf de grammatica/data samen te rapen.
//
// `null` (zelfgekozen naam, of een speler van vóór stap 6) geeft hier
// overal `null` terug — de aanroeper valt dan terug op `effectiveName`,
// precies zoals de server dat zelf ook doet voor zijn servertalige afdruk.

import { renderIdentityNl, renderIdentityEn, renderIdentityEs } from '../../../client/flow/identity-render.mjs';
import { countryAdjectives } from '../../../shared/content/country-adjectives.mjs';
import { identityWords } from '../../../shared/content/identity-word-lists.mjs';
import { countryName, flagAssetPath } from './country-names.mjs';

const RENDER_BY_LANGUAGE = Object.freeze({
  nl: renderIdentityNl,
  en: renderIdentityEn,
  es: renderIdentityEs,
});

/**
 * @param {{country: string, word: string} | null | undefined} identity
 * @param {string} language - 'nl' | 'en' | 'es'
 * @returns {string | null}
 */
export function identityText(identity, language) {
  if (identity === null || identity === undefined) {
    return null;
  }
  const render = RENDER_BY_LANGUAGE[language] ?? renderIdentityEn;
  const wordEntry = identityWords[identity.word]?.[language];
  if (wordEntry === undefined) {
    return null;
  }
  return render({
    countryName: countryName(identity.country, language),
    adjective: countryAdjectives[identity.country]?.[language],
    word: wordEntry,
  });
}

/**
 * @param {{country: string, word: string} | null | undefined} identity
 * @returns {string | null}
 */
export function identityFlagUrl(identity) {
  if (identity === null || identity === undefined) {
    return null;
  }
  return flagAssetPath(identity.country);
}
