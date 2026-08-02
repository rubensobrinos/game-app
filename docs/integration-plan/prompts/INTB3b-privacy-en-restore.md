# INTB3b — analytics: privacyverificatie en herstelbewijs

**Domein:** INT-B. **Blokkade:** INTB3a.

---

## Prompt

Je bewijst twee dingen over de persistente opslag: dat er niets in staat wat er
niet in mag, en dat een back-up daadwerkelijk terug te zetten is.

### Lees eerst

- `docs/multiplayer/DATA-MODEL.md`, secties **Wat niet persistent wordt
  opgeslagen** en **Privacyduiding**.
- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md`, secties **Back-ups** en punt 12
  van de Definition of Done: *geen naam, token of IP staat in persistente
  analytics*.
- `server/data/privacy-guard.js` — bestaand.

### Deel 1 — privacyverificatie

Een test die een volledige match doorloopt met bewust herkenbare gegevens —
spelersnamen als `PRIVACY-CANARY-NAAM`, een sessietoken met een herkenbaar
patroon, een IP-achtige string — en daarna **de hele database uitleest** en
controleert dat geen van die kanaries erin voorkomt. Niet per kolom die je
verwacht, maar over alle tabellen en alle kolommen.

Dat onderscheid is de hele test: per verwachte kolom controleren vindt alleen wat
je al vermoedde. De canary-aanpak vindt ook de kolom waar iemand later per
ongeluk iets in schrijft.

Dek expliciet: zelfgekozen namen, gegenereerde namen, sessietokens én
tokenhashes, IP-adressen, user-agents, individuele scores en antwoordhistorie,
en elke koppeling die rooms van dezelfde persoon aan elkaar zou knopen.

### Deel 2 — restore-test

`DEPLOYMENT-AND-TESTING.md` eist een geteste back-up en restore, en punt 11 van
de Definition of Done maakt dat expliciet. Bouw:

1. een `pg_dump` van een database met bekende inhoud;
2. herstel naar een lege database;
3. verificatie dat de inhoud identiek is.

Een back-up die nooit is teruggezet is geen back-up. Dit is de goedkoopste plek
om daarachter te komen.

### Wat je NIET doet

- Versleuteling of NAS-transport inrichten — dat is `prod` en valt buiten INT-B.
  Je bewijst dat dump en restore werken, niet waar de kopie heen gaat.

### Opleveren

Paden, welke kanaries je hebt gebruikt, of de scan écht over alle tabellen en
kolommen loopt, het resultaat van de restore-test, en elke plek waar persistente
data dichter bij een persoonsgegeven komt dan `DATA-MODEL.md` beschrijft.
