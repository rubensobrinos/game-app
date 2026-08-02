# Prompt — PR9: PROTOCOL.md bijwerken naar DECISIONS.md

**Herzien na menselijke review (2 aug 2026)** — zie "Verwerkte review-feedback"
onderaan. De vorige versie verzon presentatievormen voor `question`-payloads die
niet overeenkwamen met de al gebouwde `server/rules/question-selection.js`. Deze
versie gebruikt de daadwerkelijke output van dat bestand.

Dekt fase **PR9** — nieuw, volgend op [`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md)
(bindend, producteigenaar, 2 augustus 2026). Dit is de eerste fase in dit hele plan
die `docs/multiplayer/PROTOCOL.md` zélf mag wijzigen: `DECISIONS.md` zegt letterlijk
"Publieke contractwijzigingen in deze lijst zijn expliciet geaccordeerd" — de
`public_api`-ADR-plicht is voor precies déze punten al vervuld door de mens, niet
door jou. Ga niet verder dan wat hieronder staat.

## Brondocument

Nummering hieronder verwijst naar `docs/multiplayer/DECISIONS.md`, tenzij anders
aangegeven. De `question`-vormen hieronder zijn **geen citaat uit `DECISIONS.md`**
maar een letterlijke weergave van de reeds gebouwde en geteste
`server/rules/question-selection.js` (`publicQuestionPayload`/`correctAnswer`) —
lees dat bestand zelf voordat je begint, het is de bron van waarheid voor de
wire-vorm, niet dit promptbestand.

## Wijzigingen aan `PROTOCOL.md` (per sectie)

### §Foutcodes
- Bij `GAME_NOT_FOUND`: voeg een voetnoot toe dat een verlopen room-TTL dit ook
  extern oplevert (**punt 2**).
- Voeg **geen** `INVALID_PAUSE_STATE` toe (**punt 12**: blijft intern).
- Voeg **geen** `INVALID_SERVER_RESPONSE` toe (**punt 19**: "dit wordt geen nieuwe
  wire-foutcode" — lokaal symbool, zie `PR11`).

### §REST-endpoints
- Bij `POST /api/v1/games/{code}/leave`: voeg toe dat dit **niet** het sessietoken
  intrekt (**punt 4**).
- Nieuwe subsectie: **preview-endpoint** vóór join (**punt 7**). Gebruik exact het
  contract dat `PR10` na revisie vastlegt (één previewcontract, geen `valid`-veld
  meer — zie `PR10-preview-endpoint.md`). Schrijf dit tegelijk met of ná `PR10`,
  niet ervoor, zodat spec en validator niet uit elkaar lopen.

### §State-snapshot
- Voeg `eligibleFromRound` toe aan `self` (**punt 3**): **integer ≥ 1**, niet
  zomaar "een getal" — zelfde eis als `PR11`'s validator. Servervalidatie blijft
  leidend; dit veld is alleen voor proactieve clientweergave.
- Voeg een `pausedState`-veld toe aan `room`, in de volledige vorm
  (`previousPhase`, `remainingMs`, `reason`, `pausedAt`), `null` wanneer niet
  gepauzeerd (**punt 10**).

### §Client → server events
- `share:opened`-rij: `method`-enum van 3 naar 4 waarden: `"qr" | "link" |
  "native" | "code"` (**punt 18**).

### §Server → client events
- `game:paused`-rij: volledige `pausedState`-vorm (zelfde als hierboven), plus de
  toegestane `reason`-waarden expliciet: **`host`, `host_disconnected`,
  `no_answers`, `server_recovery`**, met generieke clientfallback voor onbekende
  waarden (**punt 11**).
- `session:revoked`-rij: uitsluitend voor expliciete server-/beheerintrekking;
  kick gebruikt `session:kicked`, vrijwillig verlaten en TTL-verloop gebruiken dit
  event niet (**punt 17**).
- `round:ended`-rij: de rules-/servicelaag berekent de antwoordverdeling; het
  protocol transporteert en valideert alleen de uitkomstvorm (**punt 14**). Wees
  expliciet dat de verdeling **geen** `resultDetails`-achtige velden bevat die
  tijdens de ronde al naar `round:started` hadden mogen lekken — dat mag pas hier,
  ná afloop van de ronde.
- `round:started`-rij: voeg een algemeen `rendererVersion`-veld toe, **naast**
  `contentVersion`, voor **elke** `gameType` (niet alleen `real_or_fake_flag`) —
  zie **punt 21**: "`contentVersion` en `rendererVersion` zijn canoniek en
  onveranderlijk op `Match`; roundpayloads dragen ze mee voor clients."

  **Open ontwerpvraag, niet zelf beslissen:** `question-selection.js` geeft
  `real_or_fake_flag`'s gegenereerde variant al een eigen, geneste
  `rendererVersion` (binnen `publicQuestionPayload`). Is dat dezelfde waarde als
  het nieuwe top-level `round:started.rendererVersion` (Match-breed, altijd
  gelijk), of wordt de geneste variant overbodig zodra het top-level veld bestaat?
  Leg dit voor aan wie de composition-laag bouwt (`server/composition/`) — kies
  hier geen kant, documenteer beide opties in `PROTOCOL.md` als open punt als er
  geen antwoord komt vóór oplevering.

### §Voorbeeld `round:started`

**Vervang het bestaande voorbeeld volledig** — het huidige voorbeeld
(`promptKey`/`image.kind: "generated_flag"`/`options` met `optionId`/`labelKey`)
komt **niet overeen** met wat `question-selection.js` daadwerkelijk oplevert voor
`real_or_fake_flag`. Gebruik voor alle vijf spelvormen de echte
`publicQuestionPayload`-vorm, letterlijk overgenomen uit
`server/rules/question-selection.js` (regelnummers kunnen verschuiven, zoek op de
genoemde velden):

| `gameType` | Echte `publicQuestionPayload`-vorm | `correctAnswer` (nooit in `round:started`) |
| --- | --- | --- |
| `flags_mc` | `{ targetIso2, optionIso2s }` | `{ optionId }` |
| `capitals_mc` | `{ targetIso2, optionIso2s }` | `{ optionId }` |
| `real_or_fake_flag` | `{ kind: 'real', iso2 }` **of** `{ kind: 'generated', seed, rendererVersion, spec }` | `{ choice: 'real' \| 'fake' }` |
| `higher_lower` | `{ metric, sides: [{ side: 0, iso2 }, { side: 1, iso2 }] }` | `{ side }` |
| `odd_one_out` | `{ cards: [{ cardIndex, iso2 }] }` | `{ cardIndex }` |

Voeg per spelvorm één voorbeeld toe met echte (of realistische placeholder-)
`iso2`-waarden. Vermeld expliciet, per spelvorm, welke `question-selection.js`-
velden (bijv. `resultDetails`, de rauwe metriekwaarde, `majorityContinent`/
`minorityContinent`) **nooit** in `round:started` terechtkomen — die horen pas in
`round:ended` (zie `PR11` punt 9 voor de volledige lijst en de herformulering van
de "niet-afleidbaar"-eis).

Voeg toe: publiek `roundNumber` is 1-based (`Match.roundIndex + 1`);
`countdownEndsAt` (in `game:started`) is vluchtig/berekend, geen opgeslagen veld
(**punt 16**).

### Wat hier NIET wijzigt
- Geen team-/spectator-oppervlak (**punt 8, 9, 33**).
- Geen sessietoken-implementatiedetails in `PROTOCOL.md` zelf (blijft
  `auth-session.mjs`/`PR8`/`PR12`-terrein).

### Over `v1` en "additief"

**Niet claimen dat dit zonder meer additief/wire-compatible is.** Een nieuw
*optioneel* veld is additief. Maar als `PR11` `eligibleFromRound` verplicht maakt
en de volledige `pausedState` onderdeel wordt van een strikte snapshot-/eventvorm,
voldoen oudere `v1`-payloads daar niet meer aan — dat is **contractueel
strenger**, niet zuiver additief. Omdat dit protocol nog niet publiek is
uitgerold, kan `protocolVersion` praktisch op `v1` blijven — formuleer dat eerlijk
in de commit-/PR-tekst: *"Contractueel strenger, maar vóór publieke
compatibiliteitsgarantie binnen dezelfde MVP-protocolversie doorgevoerd."* Claim
niet dat verplichte nieuwe velden wire-compatible additief zijn.

## Bijwerken `docs/protocol-plan/README.md`

Werk Open vragen §1–§17 bij zoals eerder beschreven: niet verwijderen, wel
voorzien van "Beantwoord door `DECISIONS.md`, punt N, 2 aug 2026" + citaat. §8/§9
markeren als "niet nu bouwen" (bewuste scope-keuze), niet als "opgelost".

Werk ook `docs/protocol-plan/PR-PROGRESS.md` bij: PR9 toevoegen aan de fasetabel.

## Definition of done

- Elke tekstwijziging is te herleiden tot een genummerd punt in `DECISIONS.md` óf
  expliciet gemarkeerd als toepassingskeuze/open ontwerpvraag.
- Het `round:started`-voorbeeld gebruikt de daadwerkelijke
  `question-selection.js`-vormen voor alle vijf spelvormen, geverifieerd door dat
  bestand te lezen, niet aangenomen.
- Geen `resultDetails`/metriekwaarden/majority-minority-continent-achtige velden
  in het `round:started`-voorbeeld.
- `README.md`'s Open vragen zijn bijgewerkt zonder historische tekst te
  verwijderen.
- Kort verslag: welke secties gewijzigd, bevestiging dat `protocolVersion` op
  `v1` blijft met de eerlijke ("contractueel strenger") formulering, en of de
  open ontwerpvraag over `rendererVersion` is voorgelegd aan de
  composition-laag-eigenaar.

## Verwerkte review-feedback

- Question-payload-tabel volledig herschreven op basis van de echte
  `question-selection.js`-output (was: verzonnen `promptKey`/`image`/`labelKey`-
  vorm) — bevinding 1.
- Het bestaande `round:started`-voorbeeld wordt nu expliciet **vervangen**, niet
  aangevuld — het kwam zelf al niet overeen met `question-selection.js` voor
  `real_or_fake_flag`.
- `rendererVersion` als algemeen top-level roundveld toegevoegd, met een
  expliciete open ontwerpvraag over de relatie tot het al bestaande geneste
  veld bij `real_or_fake_flag` — bevinding 4.
- "Additief"-claim geschrapt en vervangen door een eerlijke "contractueel
  strenger, binnen dezelfde MVP-versie"-formulering — bevinding 5.
- Preview-endpoint-sectie verwijst nu naar het herziene, ondubbelzinnige
  `PR10`-contract in plaats van er zelf een vorm voor te verzinnen — bevinding 2.
