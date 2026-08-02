# Prompt — PD1: Hard rules & MVP scope guard

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD1. Vereist dat PD0
is afgerond (locatie + moduleformaat bevestigd, testrunner-aanroep geverifieerd met
een expliciet bestand). Doel: de drie harde productregels en de "nadrukkelijk niet in
de MVP"-lijst uit `PRODUCT.md` omzetten in `.mjs`-modules met de volledige brontekst —
het laagste-risicovertrekpunt, want dit is een traceerbare representatie van
bestaande tekst, geen nieuwe interpretatie. Bijgewerkt na
[`REVIEW.md`](REVIEW.md); zie [`../README.md#verwerkte-review`](../README.md) voor de
volledige lijst correcties (telfout 11→12, CommonJS→ESM, guard-scope, expliciete
testbestanden i.p.v. mapaanroep, `{ id, text }` i.p.v. losse strings).

## Brondocument

[`docs/multiplayer/PRODUCT.md`](../../multiplayer/PRODUCT.md), secties "Harde
productregels" en "Nadrukkelijk niet in de MVP".

### Harde productregels — volledige brontekst (3 items)

1. `no-mandatory-account`: "Iedere gebruiker kan binnen enkele seconden een game
   starten of joinen zonder account, e-mailadres of andere verplichte registratie."
2. `always-visible-name`: "Iedere speler heeft tijdens het spel een zichtbare naam.
   Zelf invullen is optioneel; bij een leeg veld genereert de server direct een
   unieke naam. Een host hoeft alleen een spelersnaam te hebben wanneer die zelf
   meespeelt."
3. `own-phone-only`: "Elke rol werkt volledig op een eigen telefoon. Een laptop,
   televisie, beamer of centraal scherm mag de ervaring verbeteren, maar is nooit
   vereist."

### Nadrukkelijk niet in de MVP — volledige brontekst (**12** items, niet 11)

1. `accounts_and_registration`: "accounts, profielen, e-mail, wachtwoorden"
2. `native_app`: "native iOS- of Android-app"
3. `global_leaderboard`: "globaal leaderboard over rooms heen"
4. `friends_or_chat`: "vriendenlijsten of chat"
5. `mandatory_avatars`: "verplichte avatars"
6. `co_host_or_moderator_roles`: "co-host- en moderatorrollen"
7. `user_generated_quizzes`: "user-generated quizsets"
8. `payments_or_premium`: "betalingen of premium"
9. `extended_group_history`: "uitgebreide groepshistorie"
10. `spectator_screen_required`: "spectator-scherm als vereiste"
11. `persistent_player_names`: "permanente opslag van spelersnamen"
12. `one_container_per_game`: "één container of proces per game"

Tel dit na tegen de brontekst vóór je begint — dit was precies de fout in de vorige
versie van dit plan.

## Te bouwen

Bestanden (locatie per bevestiging in PD0, hier als `shared/product/` genoteerd):
`shared/product/hard-rules.mjs` + `.test.mjs`,
`shared/product/mvp-scope-guard.mjs` + `.test.mjs`.

```js
// hard-rules.mjs
export const HARD_RULES = [
  {
    id: 'no-mandatory-account',
    text: 'Iedere gebruiker kan binnen enkele seconden een game starten of joinen zonder account, e-mailadres of andere verplichte registratie.',
  },
  {
    id: 'always-visible-name',
    text: 'Iedere speler heeft tijdens het spel een zichtbare naam. Zelf invullen is optioneel; bij een leeg veld genereert de server direct een unieke naam. Een host hoeft alleen een spelersnaam te hebben wanneer die zelf meespeelt.',
  },
  {
    id: 'own-phone-only',
    text: 'Elke rol werkt volledig op een eigen telefoon. Een laptop, televisie, beamer of centraal scherm mag de ervaring verbeteren, maar is nooit vereist.',
  },
];
```

```js
// mvp-scope-guard.mjs

// Canoniek beleidsregister, letterlijk overgenomen uit PRODUCT.md §"Nadrukkelijk
// niet in de MVP" (12 items). Dit is de primaire waarde van deze module.
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
```

Deze functiehandtekeningen zijn een voorstel, geen bindende API. Andere eigenaren
gebruiken `isExplicitlyExcluded()`/`assertNoneExcluded()` optioneel in hún eigen
tests; ik bouw geen enforcement in hún modules in.

## Verplichte testgevallen

### `hard-rules.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `HARD_RULES.length` | `3` |
| 2 | elk item heeft de exacte `id` (`no-mandatory-account`, `always-visible-name`, `own-phone-only`) in die volgorde | pass |
| 3 | de `text` van elk item is exact gelijk aan de brontekst hierboven (geen parafrase) | pass |

### `mvp-scope-guard.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `EXCLUDED_FROM_MVP.length` | `12` |
| 2 | `EXCLUDED_FROM_MVP.map(i => i.id)` komt exact overeen met de 12 canonieke ID's hierboven, in die volgorde | pass |
| 3 | de `text` van elk item is exact gelijk aan de brontekst hierboven | pass |
| 4 | `isExplicitlyExcluded('payments_or_premium')` | `true` |
| 5 | `isExplicitlyExcluded('premium')` (synoniem, geen canonieke ID) | `false` — documenteert bewust de grens van deze functie |
| 6 | `isExplicitlyExcluded(123)` | throws `TypeError` |
| 7 | `assertNoneExcluded([])` | geen throw |
| 8 | `assertNoneExcluded(['flags_mc'])` | geen throw |
| 9 | `assertNoneExcluded(['payments_or_premium'])` | throws, `.violations` = `['payments_or_premium']` |
| 10 | `assertNoneExcluded(['flags_mc', 'accounts_and_registration'])` | throws, `.violations` bevat alleen `accounts_and_registration` |
| 11 | `assertNoneExcluded(['payments_or_premium', 'payments_or_premium'])` (duplicaat) | throws, `.violations` = `['payments_or_premium']` (gededupliceerd) |
| 12 | `assertNoneExcluded(null)` / `assertNoneExcluded('x')` | throws `TypeError`, niet de scope-Error |
| 13 | `assertNoneExcluded([1, 2])` | throws `TypeError` |

## Niet in scope voor PD1

- Preset-defaultwaarden — dat is PD2.
- Feature-flag-logica voor Golf 2 en logo's — dat is PD3.
- Server- of protocolniveau-enforcement — dit is een hulpmiddel dat andere eigenaren
  *kunnen* aanroepen in hún tests, geen validatie die ik namens hen inbouw op hún
  laag.
- Een gesloten, gedeeld feature-ID-enum dat synoniemen/typefouten wél zou vangen —
  cross-agent afstemming, geen eenzijdige PD1-beslissing (zie README, "Checkpoints").

## Definition of done

- Alle testgevallen hierboven (3 voor hard-rules, 13 voor mvp-scope-guard) staan als
  losse `node:test`-cases en slagen, uitgevoerd met expliciete bestandspaden:
  `node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs`
  (of de door PD0 bevestigde locatie).
- Geen enkele `text` in `hard-rules.mjs`/`mvp-scope-guard.mjs` wijkt af van de
  brontekst in `PRODUCT.md`.
- `EXCLUDED_FROM_MVP.length === 12`, niet 11.
