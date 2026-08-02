/**
 * @file PR3 — input-safety: normalisatie en validatie van een door de client
 *   aangeleverde `displayName` (PROTOCOL.md §Inputveiligheid):
 *   "displaynamen worden Unicode NFKC-genormaliseerd; control characters en
 *   onzichtbare misbruiktekens worden verwijderd; maximaal 20 zichtbare
 *   tekens; server bewaart en verstuurt naam als platte tekst."
 * @see docs/protocol-plan/prompts/PR3-rest-schemas.md, module 1 (input-safety).
 *
 * Foutcodes (uit de PR2-`ErrorCode`-enum, `./error-codes.mjs` — geen eigen
 * stringliteral): `NAME_INVALID` wanneer de string na normalisatie/opschoning
 * leeg is (bijvoorbeeld: alleen control characters/onzichtbare tekens, of
 * alleen whitespace); `NAME_TOO_LONG` wanneer het resultaat langer is dan 20
 * zichtbare tekens.
 *
 * `null` zelf is altijd geldig ("server genereert een naam") — buiten scope
 * van deze module; de aanroeper roept `normalizeAndValidateDisplayName`
 * alleen aan wanneer `displayName` een string is.
 */

/** @typedef {import('./error-codes.mjs').ErrorCode} ErrorCode */

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: ErrorCode }} ValidationResult
 */

/**
 * Control characters (Unicode-categorie `Cc`) en onzichtbare/opmaaktekens
 * (Unicode-categorie `Cf` — zero-width space, zero-width joiner/non-joiner,
 * BOM/zero-width no-break space, bidi-overrides e.d.) die uit een
 * displaynaam worden verwijderd. Geen citaat uit `PROTOCOL.md` — de keuze om
 * "onzichtbare misbruiktekens" via deze twee Unicode-categorieën af te
 * dekken is een toepassingskeuze van deze validator.
 * @type {RegExp}
 */
const CONTROL_AND_INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu;

/** Maximaal aantal zichtbare tekens (Unicode-codepoints, ná normalisatie/opschoning). */
const MAX_VISIBLE_CHARACTERS = 20;

/**
 * Normaliseert en valideert een door de client aangeleverde `displayName`
 * (PROTOCOL.md §Inputveiligheid): NFKC-normalisatie, verwijdering van control
 * characters en onzichtbare misbruiktekens (bv. zero-width space), maximaal
 * 20 zichtbare tekens. `null` zelf is altijd geldig ("server genereert een
 * naam" — buiten scope van deze functie, zie 'Niet in scope'); de aanroeper
 * roept deze functie alleen aan wanneer `displayName` een string is.
 *
 * Telt "zichtbare tekens" als Unicode-codepoints ná normalisatie/opschoning
 * (`Array.from(str).length`, niet `str.length`), zodat bv. een enkel emoji
 * niet als twee tekens meetelt. `PROTOCOL.md` specificeert geen telmethode
 * voor grapheme-clusters (samengestelde emoji, combinerende diakrieten);
 * codepoint-telling is de keuze van deze validator, geen citaat.
 *
 * @param {string} rawDisplayName - nooit `null`/`undefined` hier.
 * @returns {ValidationResult<string>} bij succes: de genormaliseerde,
 *   opgeschoonde naam.
 */
export function normalizeAndValidateDisplayName(rawDisplayName) {
  const cleaned = rawDisplayName
    .normalize('NFKC')
    .replace(CONTROL_AND_INVISIBLE_CHARS, '')
    .trim();

  if (cleaned.length === 0) {
    return { ok: false, code: 'NAME_INVALID' };
  }

  if (Array.from(cleaned).length > MAX_VISIBLE_CHARACTERS) {
    return { ok: false, code: 'NAME_TOO_LONG' };
  }

  return { ok: true, value: cleaned };
}
