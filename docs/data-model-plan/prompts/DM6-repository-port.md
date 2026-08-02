# Prompt — DM6: Repository-domeinpoort + in-memory fake

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM6.
Afhankelijk van DM1 (sleutelnamen als documentatie/mapping-referentie, niet als
harde import — de poort werkt met domeinobjecten, niet met Redis-sleutels) en
DM2/DM3 (de typedefs die de poort in- en uitgeeft: `RoomCore`, niet `Room` — zie
DM2b). Corrigeert `REVIEW.md` bevinding 7: de poort mag geen Redis-vormige
primitieven (`hSet`, `zAdd`, `multi`) in het publieke contract hebben.

**Herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md), bevindingen 4 en 5 (beide
Blocker/Hoog).** Bevinding 4: `loadRoomByInviteHash` was niet implementeerbaar —
`saveRoom` ontvangt een `RoomCore` met `inviteId`, geen `inviteHash`, en het
hashalgoritme is een open ADR (checkpoint 7) die de fake niet zelf mag invullen.
Vervangen door `loadRoomByInviteId`, dat het al-bestaande `inviteId`-veld
gebruikt — de hashing van dat veld voor Redis-keyprivacy is een adapter-detail
(checkpoint 7), geen domeinpoort-signatuur. Bevinding 5: `saveAcceptedAnswerAtomically`
liet de action-cache/ack-schrijfactie (stap 10 van de atomaire
antwoordverwerking) als "latere kleine uitbreiding" achterwege, terwijl die
volgens `DATA-MODEL.md` in dezelfde alles-of-niets-mutatie hoort als stappen
7–9. De volledige operatie staat nu in één keer hieronder, inclusief een
duidelijke naam voor wat de aanroeper aanlevert (absolute nieuwe waarden, geen
delta — zie hieronder).

## Ontwerpprincipe

De poort beschrijft **wat** de rest van de server nodig heeft (domeinoperaties op
`RoomCore`/`Session`/`Player`/`Match`/`Round`/`Answer`), niet **hoe** dat ooit
tegen Redis wordt uitgevoerd. Een latere ADR (checkpoints 2, 3, 5, 6, 7) kiest
clientlibrary, serialisatie, hashalgoritme en atomiciteitsmechanisme; die keuze
wordt achter dezelfde functienamen geplaatst, zonder de aanroepers (DM7, DM9, en
uiteindelijk de echte protocol-/socket-handlers) te raken.

**Wat de in-memory fake wél en niet bewijst** (bevinding 7 uit de vorige review,
expliciet, niet impliciet): de fake bewijst dat de *domeinsemantiek* van elke
operatie klopt (bijv. dat een dual-write nooit half doorgevoerd in de fake-store
staat). Ze bewijst **niet** dat een echte Redis-implementatie hetzelfde
concurrency- of foutgedrag heeft onder gelijktijdige toegang, netwerkfalen, of
een gedeeltelijk uitgevoerd Lua-script. Die garantie komt pas met adapter-/
integratietests ná de ADR's — een aparte, latere fase, niet DM6.

## Stappen

### 1. `server/data/repository.js` — de poort (representatieve, niet-uitputtende set)

```js
/**
 * @typedef {object} DataStore
 * @property {(roomId: string) => Promise<RoomCore|null>} loadRoom
 * @property {(room: RoomCore) => Promise<void>} saveRoom
 * @property {(code: string) => Promise<RoomCore|null>} loadRoomByCode
 * @property {(inviteId: string) => Promise<RoomCore|null>} loadRoomByInviteId
 * @property {(roomId: string, sessionId: string) => Promise<Session|null>} loadSession
 * @property {(session: Session) => Promise<void>} saveSession
 * @property {(roomId: string, playerId: string) => Promise<Player|null>} loadPlayer
 * @property {(player: Player) => Promise<void>} savePlayer
 * @property {(roomId: string) => Promise<Player[]>} listPlayers
 * @property {(roomId: string, matchId: string) => Promise<Match|null>} loadMatch
 * @property {(match: Match) => Promise<void>} saveMatch
 * @property {(roomId: string, matchId: string, roundId: string) => Promise<Round|null>} loadRound
 * @property {(round: Round) => Promise<void>} saveRound
 * @property {(roomId: string, matchId: string, newPhase: string) => Promise<void>} setRoomAndMatchPhaseAtomically
 * @property {(roomId: string, matchId: string, write: AcceptedAnswerWrite) => Promise<void>} saveAcceptedAnswerAtomically
 * @property {(actionId: string) => Promise<{ actionId: string, ack: object } | null>} loadActionCacheEntry
 * @property {(roomId: string, matchId: string, limit: number) => Promise<Array<{playerId: string, score: number}>>} getScoreboardTop
 */

/**
 * Alles wat stappen 7–10 van de atomaire antwoordverwerking in ÉÉN mutatie
 * horen te schrijven — inclusief de ack (stap 10), niet als losse latere
 * uitbreiding (REVIEW-DM2-DM9.md bevinding 5).
 * @typedef {{
 *   answer: Answer,
 *   updatedPlayer: { id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number },
 *   actionCacheEntry: { actionId: string, ack: object },
 * }} AcceptedAnswerWrite
 */
```

`setRoomAndMatchPhaseAtomically` is de operatie voor de `RoomCore.phase`/
`Match.phase`-duplicatie (`DATA-MODEL.md`: "updates gebeuren atomair") —
checkpoint 5. `saveAcceptedAnswerAtomically` bundelt stappen 7–10 in één
domeinoperatie: `Answer` schrijven, `Player` bijwerken, scoreboard bijwerken
(afgeleid van `updatedPlayer.score` — geen apart scoreboardveld nodig in de
write, de fake berekent de sorted-set-positie uit `updatedPlayer.score`), én de
action-cache-entry bewaren. Dit is wat DM7's `answer-flow.js` in één keer
aanlevert, niet iets wat de aanroeper zelf over meerdere calls moet verdelen.

**`updatedPlayer` bevat absolute nieuwe waarden, geen delta.** Een eerdere
versie van dit bestand heette dit veld `playerScoreDelta`, terwijl DM7's
resolutielogica altijd al de complete, nieuwe waarde berekent (`player.score +
points`, niet `+points` als apart deltagetal) — de naam sprak de inhoud tegen
(`REVIEW-DM2-DM9.md` bevinding 5). `saveAcceptedAnswerAtomically` **vervangt**
dus de betreffende velden van de opgeslagen `Player`, het telt ze niet zelf bij
een bestaande waarde op.

**Nadrukkelijk niet-uitputtend voor de rest.** Latere fases (DM9, en
uiteindelijk echte protocol-handlers) mogen dit bestand met kleine, additieve
diffs uitbreiden zodra ze een operatie nodig hebben die hier nog ontbreekt.

### 2. `server/data/in-memory-store.js` — de testfake

Implementeert `DataStore` bovenop een handvol `Map`s (per entiteittype, met
samengestelde sleutels voor `Session`/`Player`/`Round`, analoog aan — maar niet
gelijk aan — de Redis-sleutelstructuur uit DM1, plus een aparte `Map` voor
`inviteId -> roomId` en `code -> roomId`-lookups en één voor de action-cache
(`actionId -> ack`)). `setRoomAndMatchPhaseAtomically` en
`saveAcceptedAnswerAtomically` zijn in de fake geïmplementeerd met een
try/catch die bij een fout **geen enkele** van de betrokken `Map`-writes laat
staan (test hieronder) — voor `saveAcceptedAnswerAtomically` betekent dat: de
`Answer`-write, de `Player`-update, de scoreboard-update, én de
action-cache-entry landen samen, of geen van vieren.

### 3. Tests (`repository.test.js`)

- CRUD-rondje per entiteit: save → load geeft hetzelfde object terug (deep-equal,
  geen mutatie van het origineel — save moet defensief kopiëren);
- `loadRoomByCode`/`loadRoomByInviteId` vinden dezelfde room als `loadRoom` na
  een `saveRoom` — beide rechtstreeks op `RoomCore.code`/`RoomCore.inviteId`,
  geen hashing in de fake;
- `setRoomAndMatchPhaseAtomically`: na een geslaagde aanroep hebben
  `RoomCore.phase` én `Match.phase` dezelfde nieuwe waarde — nooit één van de
  twee bijgewerkt en de ander niet (test met een geforceerde fout halverwege —
  bijv. een niet-bestaande `matchId` — bevestigt dat `RoomCore.phase` dan
  ONgewijzigd blijft);
- `saveAcceptedAnswerAtomically`: na een geslaagde aanroep bestaat de `Answer`,
  is `Player.score`/`correctCount`/`correctResponseTimeMsTotal` overschreven
  met `updatedPlayer`'s waarden, staat de nieuwe score in
  `getScoreboardTop`'s resultaat, én levert `loadActionCacheEntry(actionId)`
  de meegegeven `ack` op — alle vier, of (bij een geforceerde fout, bijv. een
  niet-bestaande `playerId`) geen van vieren;
  - **let op wat dit bewijst en niet bewijst**: de test bewijst dat dít
    (single-threaded, in-memory) pad alles-of-niets is. Ze zegt niets over twee
    gelijktijdige aanroepen — er is in deze fake geen concurrency om te testen.
    Een commentaarregel bij de test herhaalt dit expliciet;
- `loadActionCacheEntry` voor een onbekende `actionId` geeft `null`, niet een
  fout;
- `getScoreboardTop` sorteert op score aflopend en respecteert `limit`.

## Harde grenzen

- Geen Redis-vormige methodenamen (`hSet`, `zAdd`, `multi`, `eval`, ...) in
  `DataStore`. Elke methode heet naar wat hij doet in domeintermen.
- Geen hashfunctie in `in-memory-store.js` — `loadRoomByInviteId` werkt op het
  al-bestaande `inviteId`-veld, niet op een zelf berekende hash.
- Geen concrete Redis-clientadapter — dat is (b), checkpoint 2.
- Geen claim in commentaar of testnamen dat dit "atomiciteit bewijst" zonder de
  in-memory-fake-beperking erbij te noemen.
- Geen losse, latere uitbreiding van `saveAcceptedAnswerAtomically` om de
  action-cache-entry alsnog toe te voegen — die zit er in deze fase al in.
- 2 bestanden (poort + fake) + 1 testbestand = 3 bestanden.

## Definition of done

- `DataStore`-poort bevat geen Redis-primitieven, alleen domeinoperaties, en
  gebruikt `RoomCore` (niet `Room`) als typenaam.
- `loadRoomByInviteId` werkt op `inviteId`, geen hashing in deze fase.
- `saveAcceptedAnswerAtomically` schrijft `Answer`, `Player`-update (absolute
  waarden, niet-delta), scoreboard-update, én de action-cache-entry in één
  atomaire fake-operatie.
- In-memory fake implementeert de volledige poort.
- De twee atomaire operaties hebben elk een test voor het geslaagde pad én het
  gefaalde-pad-laat-niets-half-staan-pad, met een expliciete
  scope-beperkingsopmerking (geen concurrency-bewijs).
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: uitgevoerd.** `server/data/repository.js` (`DataStore`-JSDoc-poort +
`assertImplementsDataStore`-contractcheck) en `server/data/in-memory-store.js`
(`createInMemoryStore()`) + `repository.test.js` staan er. 23/23 tests groen,
inclusief alles-of-niets-tests voor beide atomaire operaties. Eén kleine,
additieve toevoeging t.o.v. de representatieve lijst uit deze prompt:
`loadAnswer(roundId, playerId)`, nodig om `saveAcceptedAnswerAtomically`'s
resultaat te kunnen verifiëren en voor DM7's `existingAnswerForRound`-context.

**Nabericht na `docs/multiplayer/DECISIONS.md` #21/DM2b's rename:** alle
`RoomCore`-verwijzingen in `repository.js` (JSDoc-imports, typenaam) zijn
bijgewerkt naar `Room` — zelfde reden als in `DM2b-room.md`. Gedrag ongewijzigd.
