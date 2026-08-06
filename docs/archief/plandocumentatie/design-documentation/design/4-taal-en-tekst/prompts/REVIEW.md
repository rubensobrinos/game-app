# Review — T4-4, T4-5 en de bugmelding score-mismatch

Datum: 3 augustus 2026. Betreft commit `514ebf9` (T4-4 + T4-5 + PROGRESS.md §9
bugmelding + `prompts/README.md`).

Methode: elke feitelijke claim in beide prompts en in de bugmelding is
nagetrokken tegen `frontend/js/`, `client/flow/`, `server/` en
`docs/multiplayer/PROTOCOL.md`. Onderstaande bevindingen zijn alleen de punten
waar prompt en code uit elkaar lopen.

## Samenvattend oordeel

De bugmelding is correct, goed onderbouwd en terecht als los punt gemeld in
plaats van stilzwijgend meegefixt. De regelverwijzingen in beide prompts zijn
steekproefsgewijs allemaal juist — dat is precisiewerk dat de vorige review
juist miste.

Twee blokkerende punten: **T4-5's `lobby.playerSelf` is niet bouwbaar zoals
beschreven** en **T4-4 §2's kop spreekt de code tegen**. Daarnaast
overlappen drie van de vijf punten met bestaande thema 1-prompts zonder dat
één van beide kanten dat noemt — dezelfde faalmodus als de eerste bevinding uit
[thema 1's review](../../1-schermen-en-flow/prompts/REVIEW.md).

## Geverifieerd en correct

- **De bug is echt en live in het defaultpad.** Server stuurt `ownPoints`/
  `ownCorrect`/`ownResponseTimeMs` (`server/transport/socket.mjs:534-536`),
  client leest `selfCorrect`/`selfScore` (`round-model.mjs:152-154`),
  `transport.mjs` doet geen veldvertaling, en `app.mjs:44` kiest sinds
  `98a114d` standaard `createTransport()`. Niet latent.
- **De per-ronde-versus-cumulatief-observatie klopt.** `transport-mock.mjs:555`
  stuurt `target.players.get(playerId).score` — een lopend totaal. De server
  stuurt `entry.points` — punten van déze ronde. Dat is inderdaad meer dan een
  veldnaam-hernoeming.
- **"Geen antwoord ingediend" terecht op niveau 2 gelaten.** Dat leunt op
  `self.answeredCurrentRound`, en dát veld bestaat wél echt server-side
  (`server/composition/match-lifecycle.mjs:1402-1410`) én in
  `PROTOCOL.md:297`. De bug is dus geïsoleerd, niet systemisch — goede
  afweging, want de verleiding was groot om §9 in z'n geheel terug te zetten.
- **Alle regelverwijzingen in T4-4/T4-5 kloppen**, steekproef:
  `session-shell.mjs:152` (`let locked = false`), `:348-349`
  (`room:lock-changed`), `:387` (snapshot `room.locked`), `:204-206`
  (`isHost()`), `:312`/`:318` (pauze-overlay), `hostbar.mjs:95-97`
  (lock/unlock-knoptekst), `lobby.mjs:19,76,241`,
  `preview-endpoint.mjs` (`playerCount` in de whitelist én de retourvorm),
  `join.mjs:83-84` (leest inderdaad alleen `preview.suggestedName`).
- **De hertelling klopt.** 15/12/22/0 → 15/13/21/0, som blijft 49, precies één
  rij van 2 naar 1 — consistent met de enige downgrade.

## Bevindingen

### T4-5 §1 — `lobby.playerSelf` mist een prop (blokkerend)

T4-5 §1 schrijft dat `{naam}` gevuld wordt met "de eigen `effectiveName` die al
beschikbaar is in de lobby-model-data", en de Regels-sectie stelt expliciet dat
er geen nieuwe props nodig zijn.

Dat klopt niet:

- `createLobbyView({ root, t, tCount, isHost, gameCode, onStart, onShareAction })`
  — geen self, geen naam (`lobby.mjs:19`).
- `update({ playerCount, participants, canStart, capabilities, joinUrl })`
  (`session-shell.mjs:507-513`).
- `participants` is een `Map<playerId, effectiveName>`
  (`session-shell.mjs:399,415`) — maar er gaat geen `selfPlayerId` mee, dus de
  lobby kan niet bepalen wélke entry de eigen speler is.
- `selfInfo` (`{ roles, playerId, effectiveName }`) bestaat wel, maar staat in
  `session-shell.mjs:154` en wordt nergens doorgegeven.
- `lobby.mjs` bevat nul verwijzingen naar `self` of `effectiveName`.

Er is dus een nieuwe prop nodig (bv. `selfName: selfInfo?.effectiveName ?? null`
in de `update()`-payload). De fix is triviaal — maar T4-5's eigen Regels-sectie
noemt precies deze situatie als het signaal dat de prompt een verkeerde aanname
deed, dus hij mag niet blijven staan zoals hij nu geformuleerd is.

**Actie:** de zin over "al beschikbaar in de lobby-model-data" vervangen door de
concrete propuitbreiding, en de Regels-sectie daarop aanpassen.

### T4-4 §2 — de kop belooft code-invoer, de code kan het niet (blokkerend)

De kop luidt "Sociaal bewijs bij het invoeren van een **gamecode**".

Dat kan niet: `join-state.mjs:151-153` stuurt een code-locator rechtstreeks naar
`name-entry` en slaat `previewing` volledig over, met de comment erbij dat het
preview-endpoint invite-only is. `transport.mjs:245-247` herhaalt dat
("Uitsluitend `inviteId`, geen `gameCode`-variant"). Na code-invoer bestaat er
dus geen respons waar `playerCount` in zit.

De body van §2 is wél correct ("zodra de preview is opgehaald"), dus dit is puur
de kop — maar het is de regel die een bouwer als eerste leest, en thema 1's
`06-start-en-join-polish.md` S04.2 documenteert deze beperking al expliciet en
correct. Twee documenten in dezelfde repo zeggen nu iets tegenstrijdigs over
hetzelfde veld.

**Actie:** kop wijzigen naar "Sociaal bewijs na een uitnodigingslink", en één
zin toevoegen dat dit ná code-invoer principieel niet kan.

### Coördinatie — drie van de vijf punten overlappen met thema 1, onvermeld

| T4 | Thema 1 |
|---|---|
| T4-4 §1 belofte-regel | `06-start-en-join-polish.md` S01.2 — **woordelijk dezelfde zin** |
| T4-4 §2 sociaal bewijs | `06-start-en-join-polish.md` S04.2 |
| T4-5 §1 spelerslobby-copy | `03-S06-spelerslobby.md` (eigen naam, `Nodig iemand uit`, bevestigingsregel) |

Geen van beide kanten verwijst naar de ander. Dit is exact de faalmodus die
thema 1's review als eerste bevinding heeft: thema 4 bouwde daar stilzwijgend thema 1's
laadstatus (`home.creating`), waardoor prompt 06 achterhaald raakte zonder dat
iemand het merkte. Nu dreigt hetzelfde in het groot — dubbel werk, of botsende
sleutelnamen (`home.promise` versus wat thema 1 kiest).

**Actie:** in beide documenten één eigenaarsregel per gedeeld punt. Voor de
grens zelf ligt "thema 4 levert de tekst, thema 1 levert het element en de
plaatsing" voor de hand, maar dat is een afspraak tussen de twee eigenaren, geen
besluit dat hier eenzijdig genomen moet worden.

### Bugmelding — de testsuite bevestigt de bug

`round-model.test.mjs` asserteert op `selfCorrect`/`selfScore` op zes plekken
(regels 31, 77-78, 84-86, 93, 135-136). Een correcte fix moet die herschrijven
**én** `transport-mock.mjs:554-555` bijtrekken — anders blijft de mock afwijken
van de server en blijven de tests groen op precies de verkeerde vorm.

De bugmelding noemt de mock-discrepantie wel, maar niet dat de mock en de tests
zelf mee moeten. Daardoor oogt de fix kleiner dan hij is.

**Actie:** de omvang in de bugmelding aanvullen: client-fix + mock-fix +
zes testassertions.

### Bugmelding — grondoorzaak: PROTOCOL.md specificeert `round:ended`'s
persoonlijke velden nergens

`PROTOCOL.md`'s `round:ended`-sectie (regel 493-500) gaat uitsluitend over
`resultDetails`-lekkage en noemt geen enkele veldnaam. De eventtabel (regel 444)
zegt alleen "room + persoonlijke velden ... eigen punten". Nergens in
`PROTOCOL.md` staat `ownPoints`, `ownCorrect` of `selfCorrect`.

Ondertussen valideert `server/protocol/server-events-scoring.mjs:64-69` wél
hard op `ownPoints`. De server heeft dus een de-facto contract dat het
protocoldocument niet draagt — en dát is waarom client en server konden
wegdrijven zonder dat een test of review het ving. Zonder die regel in
`PROTOCOL.md` gebeurt het opnieuw bij het volgende persoonlijke veld.

Het beslecht meteen de richting van de fix: **de client is fout, niet de
server.** De bugmelding laat dat nu impliciet.

**Actie:** de bugmelding uitbreiden met het protocolgat als grondoorzaak, en
`PROTOCOL.md` §`round:ended` aanvullen met de drie persoonlijke velden — dat
laatste is werk voor de protocol-eigenaar, dus een `HANDOFF`-item.

### Bugmelding — "niveau 1" onderschat wat er kapot is

De melding zegt dat het resultaatstempel altijd `resultIncorrect` toont. Dat
klopt (`round-model.mjs:152` → `false` → `gameplay.mjs:139` → `is-wrong`), maar
het is niet alles: `selfScore` wordt `null`, en `gameplay.mjs:148` hangt het
héle score-element op `!== null`. Tegen de echte server verdwijnt de scoreregel
dus volledig — er staat niet een verkeerd getal, er staat niets.

**Actie:** één zin toevoegen. Het verandert waar een tester naar moet kijken.

## Antwoord op de openstaande vraag: eerst de bugfix

Aanbeveling: **de bug eerst**, om twee redenen. Hij maakt een kernscherm nú
onjuist voor elke echte gebruiker, terwijl T4-4/T4-5 copy toevoegen aan schermen
die verder gewoon werken. En T4-4/T4-5 moeten sowieso eerst gecorrigeerd worden
(de prop en de kop), dus er gaat geen tijd verloren.

Scope de fix als **client + mock + tests**, niet als losse regel. De enige
echte productvraag daarin is per-ronde-delta versus lopend totaal, en die is al
half beslecht door het protocol: `ownPoints` is wat `round:ended` geeft, een
cumulatief totaal bestaat alleen in `scoreboard:updated` /
`standings-model.mjs`. Dat is eerder een constatering dan een open keuze — de
vraag die overblijft is alleen of `09` §9's `Jouw punten: 100` als lopend
totaal moet blijven bestaan, en zo ja, waaruit die dan gevoed wordt.

## Prioriteit voor correctie

Vóór uitvoering van T4-4/T4-5: **de ontbrekende `playerSelf`-prop (T4-5 §1)**
en **de kop van T4-4 §2**. Beide sturen een bouwer aantoonbaar verkeerd.

Vóór of tijdens de bugfix: de drie **bugmelding**-bevindingen hierboven — ze
bepalen samen de omvang (mock + tests), de richting (client is fout) en wat een
tester moet zien (geen scoreregel, niet alleen een fout stempel).

De **overlap met thema 1** is geen prompt-fout maar een coördinatiepunt tussen
twee eigenaren; die kan parallel.
