# Prompts — 4. Taal en tekst

Breekt `PROGRESS.md`'s bevindingen op in kleinere, uitvoerbare stappen —
zelfde stijl als `docs/frontend-plan/prompts/`: brondocument, exacte
voor/na-tekst, Regels, Definition of Done.

| Bestand | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- |
| [`T4-1-terminologie-en-directe-correcties.md`](T4-1-terminologie-en-directe-correcties.md) | uitgevoerd | Pure tekstvervangingen, geen state/logica-wijziging | niets |
| [`T4-2a-statusteksten-direct-uitvoerbaar.md`](T4-2a-statusteksten-direct-uitvoerbaar.md) | uitgevoerd | Loadingstatus, lege lobby, hersteld-bevestiging + antwoord-geruststelling | T4-3 (`answerSaved` leunt op de hydratatiefix) |
| [`T4-2b-reconnect-drempel-en-handmatige-retry.md`](T4-2b-reconnect-drempel-en-handmatige-retry.md) | open — wacht op PO-besluit | `connection.reconnectFailed`-drempel + handmatige retry-knoppen | PO-besluit over drempel en knopgedrag |
| [`T4-3-vraagtekst-en-geen-antwoord-staat.md`](T4-3-vraagtekst-en-geen-antwoord-staat.md) | uitgevoerd, herontworpen ná reviewfeedback | Vraagtekst + snapshot-hydratatie zodat `GEEN ANTWOORD` server-autoritatief is | niets |

T4-2 is na reviewfeedback opgesplitst in T4-2a (geen open productbesluit,
direct uitvoerbaar) en T4-2b (wél een open productbesluit) — zie de uitleg
bovenaan T4-2b.

Bewust nog geen prompt voor:

- **Spelerslobby-copy + host-pauzestempel** (`PROGRESS.md` §6-speler, §12) —
  groter dan een directe tekstcorrectie: `lobby.mjs` en de pauze-overlay
  moeten weten of ze voor host of speler renderen en twee copysets voeren.
  Volgt zodra T4-1–T4-3 verwerkt zijn.
- **Gelijke plaatsen** (§11) — vraagt eerst een productbesluit over de
  tie-regel zelf (wie staat bovenaan bij een gelijke stand?), niet alleen
  tekst.
- **Sociale headlines** (§10) — de copy-helft is van hier, maar zonder de
  selectielogica (thema 1, S14) heeft een templateset nergens een plek om te
  verschijnen. Wacht op afstemming met thema 1.
