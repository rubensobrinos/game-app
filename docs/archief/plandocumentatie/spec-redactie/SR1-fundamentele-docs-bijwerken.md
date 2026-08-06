# SR1 — fundamentele specdocs in lijn brengen met DECISIONS.md

**Nieuw domein, prefix `SR` (specredactie).** `docs/multiplayer/DECISIONS.md`
zegt: het besluit geldt "totdat de betreffende fundamentele specificatie is
bijgewerkt". Voor PROTOCOL.md is dat bijwerken al belegd bij de PR-agent
(PR-RESUME, opdracht 2). Voor de overige documenten is het niemands opdracht —
dit lost dat op. Zonder deze redactie ontstaat opnieuw source-of-truth-drift
(zoals eerder bij mix vs. single en de 4-vs-5-preset).

Lees eerst `docs/multiplayer/DECISIONS.md` — bindend, inclusief #35.

## Opdracht

Werk `PRODUCT.md`, `GAME-FLOW.md`, `GAME-RULES.md` en `DATA-MODEL.md` bij
(PROTOCOL.md niet — dat doet de PR-agent):

1. **Mix → één gameType per match** (#32): mix overal uit de MVP-tekst; verplaats
   naar "Latere uitbreidingen". Raakt o.a. PRODUCT.md §Spelvormen ("één spelvorm
   of een mix"), GAME-FLOW.md §Game instellen, GAME-RULES.md §Vraagselectie
   ("mixgames verdelen rondes...").
2. **Groepsbattle-preset → quick-start-default** (#31 + #35): vervang de
   Groepsbattle-beschrijving in PRODUCT.md door de bevestigde default
   (`flags_mc`, 10 rondes, normaal, individueel, auto-tempo, snelheidspunten aan,
   late join aan). Succescriteria 1–2 blijven onverkort staan.
3. **DATA-MODEL.md voorbeeldconfiguratie:** `gameTypes` met vijf vormen vervangen
   door de single-game-type-lezing. Stem de exacte veldvorm (`gameType` vs.
   `gameTypes` met exact één element) af op wat de DM-agent in
   `server/data/types/` heeft gebouwd — documenteer de bestaande implementatie,
   verzin geen nieuw contract.
4. **inviteId-voorbeeld** in DATA-MODEL.md: `"N4x7pQm2K8tW"` (12 tekens ≈ 72
   bits) vervangen door een 22-tekens base64url-voorbeeld, conform de
   96-bits-eis uit ARCHITECTURE.md en de gebouwde `room-codes.js`.
5. **Overige bevestigde besluiten** die deze vier docs raken (leave-semantiek #4/5,
   pauzeredenen #11, grace #13, 1-based `roundNumber` #16, `share:opened` #18,
   pre-join preview #7, teams/spectators als latere uitbreiding #8/9): controleer
   per doc en werk bij waar de tekst nu iets anders zegt.

## Werkwijze

- Volg de wijzigingsdiscipline uit `docs/multiplayer/README.md`: elke wijziging
  cross-checken op gevolgen voor de andere documenten.
- Kleine, reviewbare diffs; geen herformulering van tekst die niet door een
  besluit wordt geraakt.
- Geschrapte MVP-onderdelen verhuizen naar "Latere uitbreidingen" — niets
  stilzwijgend verwijderen (#32: "scopekeuze, geen verwijdering").
- Meld afronding in een kort SR-PROGRESS.md in deze map, met per document welke
  besluiten zijn verwerkt.
