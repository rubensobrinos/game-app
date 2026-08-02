// Canoniek beleidsregister, letterlijk overgenomen uit
// `docs/multiplayer/PRODUCT.md` §"Nadrukkelijk niet in de MVP" (12 items). Dit is
// de primaire waarde van deze module.
//
// Zie `docs/product-plan/README.md` (bouwsteen `mvp-scope-guard`) en
// `docs/product-plan/prompts/PD1-hard-rules-and-scope-guard.md` voor de herkomst
// en de testverplichtingen van deze module.
export const EXCLUDED_FROM_MVP = [
  { id: 'accounts_and_registration', text: 'accounts, profielen, e-mail, wachtwoorden' },
  { id: 'native_app', text: 'native iOS- of Android-app' },
  { id: 'global_leaderboard', text: 'globaal leaderboard over rooms heen' },
  { id: 'friends_or_chat', text: 'vriendenlijsten of chat' },
  { id: 'mandatory_avatars', text: 'verplichte avatars' },
  { id: 'co_host_or_moderator_roles', text: 'co-host- en moderatorrollen' },
  { id: 'user_generated_quizzes', text: 'user-generated quizsets' },
  { id: 'payments_or_premium', text: 'betalingen of premium' },
  { id: 'extended_group_history', text: 'uitgebreide groepshistorie' },
  { id: 'spectator_screen_required', text: 'spectator-scherm als vereiste' },
  { id: 'persistent_player_names', text: 'permanente opslag van spelersnamen' },
  { id: 'one_container_per_game', text: 'één container of proces per game' },
];

const EXCLUDED_IDS = new Set(EXCLUDED_FROM_MVP.map((item) => item.id));

/**
 * Herkent UITSLUITEND een exacte canonieke ID uit EXCLUDED_FROM_MVP. Vangt geen
 * synoniemen, vertalingen of typefouten (bv. 'premium' of 'email_accounts' geven
 * false, ook al vallen ze inhoudelijk onder een uitsluiting). Voor een sterkere
 * garantie is een gesloten, gedeeld feature-ID-enum nodig, afgesproken met de
 * eigenaren van PROTOCOL.md/DATA-MODEL.md/GAME-FLOW.md — dat is geen PD1-beslissing.
 * @param {string} id
 * @returns {boolean}
 */
export function isExplicitlyExcluded(id) {
  if (typeof id !== 'string') {
    throw new TypeError('isExplicitlyExcluded: id must be a string');
  }
  return EXCLUDED_IDS.has(id);
}

/**
 * Dunne convenience-wrapper rond isExplicitlyExcluded voor een lijst kandidaat-ID's.
 * Zelfde beperking als isExplicitlyExcluded: alleen exacte canonieke matches.
 * Gooit bij een niet-array-argument of een niet-string item. Duplicaten in de
 * invoer worden gededupliceerd in de foutmelding; de volgorde in de melding volgt
 * de volgorde van eerste voorkomen in de invoer.
 * @param {string[]} featureIds
 * @throws {TypeError} als featureIds geen array van strings is
 * @throws {Error} met alle unieke overtredingen in `.violations` als er een match is
 */
export function assertNoneExcluded(featureIds) {
  if (!Array.isArray(featureIds)) {
    throw new TypeError('assertNoneExcluded: featureIds must be an array');
  }
  if (featureIds.some((id) => typeof id !== 'string')) {
    throw new TypeError('assertNoneExcluded: every featureId must be a string');
  }
  const violations = [...new Set(featureIds.filter((id) => isExplicitlyExcluded(id)))];
  if (violations.length > 0) {
    const err = new Error(`Buiten MVP-scope volgens PRODUCT.md: ${violations.join(', ')}`);
    err.violations = violations;
    throw err;
  }
}
