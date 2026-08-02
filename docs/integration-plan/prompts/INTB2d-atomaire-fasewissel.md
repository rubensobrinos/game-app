# INTB2d — `setRoomAndMatchPhaseAtomically` tegen Redis

**Domein:** INT-B. **Blokkade:** INTB2a.

---

## Prompt

Je implementeert de tweede atomaire poortmethode. Kleiner dan INTB2c, maar met
een even harde eis.

### Lees eerst

- `docs/multiplayer/DECISIONS.md` **#30**, en lees hem letterlijk:
  `Match.phase` is autoritair, `Room.phase` is een **afgeleide projectie** die in
  **dezelfde** atomaire operatie wordt bijgewerkt. *Geen implementatie mag een
  niet-atomair dual-write-pad introduceren.*
- `server/data/in-memory-store.js:130-146` — de semantiek die je evenaart.
- De `setRoomAndMatchPhaseAtomically`-tests uit INTB1b — je acceptatiecriterium.
- `server/architecture/state-machine.js` — de reducer die de fasewaarden
  produceert. Je valideert ze niet opnieuw; je slaat op wat je krijgt.

### Waar het om gaat

`Room` en `Match` zijn twee documenten onder twee sleutels. Ze in twee opdrachten
bijwerken is precies het dual-write-pad dat #30 verbiedt: valt de verbinding
ertussen weg, dan staat de room in een andere fase dan de match, en de room is
de projectie die de rest van het systeem leest. Dan denkt de helft van de spelers
dat de ronde loopt terwijl de match al bij de uitslag is.

Kies een mechanisme dat dat onmogelijk maakt — een Lua-script of een
transactie — en motiveer de keuze. Consistent met INTB2c is aantrekkelijk, maar
overtuig jezelf dat het hier ook echt nodig is en schrijf op waarom.

### Aandachtspunten

- **Faalpaden laten niets achter.** Onbekende room of match: geen van beide
  documenten aangeraakt. De conformance-test leest ná de verwachte fout beide
  documenten terug.
- **`Room.phase` is een projectie, geen tweede waarheid.** Raakt het ooit uit de
  pas, dan wint `Match.phase`. Overweeg of de adapter dat moet kunnen herstellen
  en meld het als je vindt van wel — bouw het niet ongevraagd.
- **TTL-refresh** hoort ook hier; een fasewissel is activiteit.
- **Idempotent** bij dezelfde fase, en geen fout.

### Klaar wanneer

De betreffende tests uit INTB1b draaien ongewijzigd groen tegen echte Redis.
Voeg één Redis-specifieke test toe: een fasewissel die halverwege wordt
onderbroken (bijvoorbeeld door de verbinding te verbreken) laat beide documenten
in hun oude toestand achter — of, als je mechanisme dat niet kan garanderen, leg
precies uit wat er dan wél gebeurt en meld het als HANDOFF-item.

### Opleveren

Pad, het gekozen mechanisme met motivering, testresultaat, en wat er gebeurt bij
een onderbroken uitvoering.
