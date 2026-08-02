# INTB1b — conformance voor de twee atomaire poortmethoden

**Domein:** INT-B (opslagadapters, achter de repository-poort).
**Blokkade:** geen. Uitvoerbaar zonder dependencies. Bouwt voort op INTB1a.
**Levert op:** het bewijs dat geen enkele implementatie half werk of dubbele
punten kan achterlaten.

---

## Prompt

Je werkt in `/Users/ruben/game-app`. INTB1a heeft een conformance-suite gebouwd
voor de zestien niet-atomaire methoden van de `DataStore`-poort. Jij dekt de twee
die overblijven, en die zijn van een andere orde: hier gaat het niet om of een
document goed wordt weggeschreven, maar om of er **geen tussentoestand kan
bestaan**.

### Lees eerst

- `server/data/repository.js` — vooral de typedef `AcceptedAnswerWrite`: wat er
  in één mutatie moet worden geschreven (antwoord, bijgewerkte speler,
  ack-cache-entry).
- `server/data/in-memory-store.js` — regels 130-172:
  `setRoomAndMatchPhaseAtomically` en `saveAcceptedAnswerAtomically`. Let op het
  patroon "eerst alle kandidaat-writes voorbereiden, dan pas committen" en op de
  kopcomment die eerlijk zegt wat de fake wél en niet bewijst.
- `server/data/answer-flow.js` — de aanroeper die deze schrijfoperatie voedt.
- `server/data/adapters/data-store-conformance.mjs` — de harness uit INTB1a; jouw
  tests haken daarop aan, je bouwt geen tweede harness.
- `docs/multiplayer/DATA-MODEL.md`, sectie **Atomische antwoordverwerking** — de
  tien stappen die in één operatie horen.
- `docs/multiplayer/DECISIONS.md` — bindend. Vooral **#30**: `Match.phase` is
  autoritair, `Room.phase` is een afgeleide projectie die in **dezelfde** atomaire
  operatie wordt bijgewerkt; geen enkele implementatie mag een niet-atomair
  dual-write-pad introduceren. Verder #13 (250 ms grace: binnen grace kan een
  antwoord correct zijn maar krijgt het nooit tijdbonus) en #23 (de Redis-variant
  wordt één Lua-script).

### `setRoomAndMatchPhaseAtomically`

Te dekken:

1. **Beide of geen van beide.** Na een geslaagde aanroep hebben `Room.phase` en
   `Match.phase` dezelfde nieuwe waarde. Dit is de kern van #30.
2. **Faalpaden laten niets achter.** Een onbekend `roomId` of een onbekend
   `matchId` moet falen *zonder* dat één van beide documenten is aangeraakt.
   Lees na de verwachte fout beide documenten terug en assert dat ze exact de
   oude fase hebben. De fake werpt hier `RangeError`; leg de foutsoort vast.
3. **Kruisbesmetting.** Een tweede room met een eigen match mag niet meebewegen.
4. **Herhaalde aanroep met dezelfde fase** is idempotent en geen fout.

### `saveAcceptedAnswerAtomically`

Dit is de belangrijkste test van het hele project: hier wordt score toegekend.

Te dekken:

1. **Alle vier de writes landen samen** — het antwoord is terug te lezen met
   `loadAnswer`, de speler heeft de nieuwe `score`, `correctCount` en
   `correctResponseTimeMsTotal`, het scoreboard is bijgewerkt, en de
   ack-cache-entry is terug te lezen met `loadActionCacheEntry`.
2. **Geen enkele write landt bij een faalpad.** Een onbekende `playerId` moet
   falen zonder dat het antwoord, het scoreboard of de action-cache is
   aangeraakt. Controleer alle vier na afloop, niet alleen degene die je
   verwacht.
3. **Nooit twee keer punten.** Dit is de scherpste eis. Bouw scenario's die dit
   proberen te breken:
   - dezelfde `actionId` twee keer aangeboden;
   - twee verschillende `actionId`'s voor dezelfde speler in dezelfde ronde;
   - dezelfde speler in twee verschillende rondes (moet wél twee keer scoren);
   - twee verschillende spelers in dezelfde ronde (beide scoren).
   Leg per geval expliciet vast wat de eindscore is. Let op: de poort krijgt
   **absolute** nieuwe waarden mee, geen delta — de aanroeper rekent zelf. De
   store hoeft dus niet op te tellen, maar mag ook niet stilzwijgend een tweede
   schrijving accepteren die de eerste ongedaan maakt zonder dat dat zichtbaar is.
   Onderzoek wat de fake doet en leg dat vast; is het gedrag verdedigbaar maar
   niet in de bron beschreven, markeer het als **vastgelegd gedrag**.
4. **Interleaving.** De fake is single-threaded, maar de suite moet scenario's
   bevatten die een echte adapter kunnen breken. Start meerdere aanroepen zonder
   ertussen te `await`en (`await Promise.all([...])`) en assert dat de eindstand
   consistent is: het scoreboard bevat voor elke speler precies één score, en die
   score is er één die daadwerkelijk is aangeboden — geen mengvorm. Zet er een
   comment bij dat dit tegen de fake weinig bewijst maar tegen Redis alles.
5. **Scoreboardvolgorde** na meerdere spelers: `getScoreboardTop` sorteert
   aflopend en respecteert `limit`.

### Harde eisen

- Alleen `node:test` en `node:assert`. Geen dependencies.
- Vaste literals voor tijd en scores; geen klok, geen willekeur.
- Elke test tegen een verse store.
- Elke assertie na een faalpad controleert **alle** documenten die de operatie
  had kunnen raken, niet alleen het meest voor de hand liggende. Een half
  uitgevoerde schrijving verraadt zich meestal in het document waar je niet keek.
- De tests moeten net zo goed tegen een Redis-adapter te richten zijn: gebruik
  uitsluitend de poortmethoden, nooit interne details van de fake.

### Wat je NIET doet

- De poort of de fake wijzigen. Vind je een echt gat, dan is dat een
  HANDOFF-item aan DM.
- Het Lua-script bedenken of schrijven — dat is INTB2c.
- Buiten `server/data/adapters/` schrijven.

### Opleveren

Kort verslag: aantal tests, per bovenstaand punt wat je hebt vastgelegd, welke
gedragingen je als "vastgelegd gedrag" hebt gemarkeerd in plaats van als broneis,
en of je bij het interleaving-scenario iets bent tegengekomen dat de fake al niet
aankan. Meld elke twijfel over het contract als aangeleverde tekst voor
`HANDOFF-INTB.md`; voeg het item niet zelf toe.
