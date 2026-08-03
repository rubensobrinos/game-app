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
| [`T4-4-pure-aanvullingen-zonder-afhankelijkheden.md`](T4-4-pure-aanvullingen-zonder-afhankelijkheden.md) | open — corrigeer eerst de kop van §2, zie [`REVIEW.md`](REVIEW.md) | Belofte-regel, sociaal bewijs bij join, vergrendelstatus in de lobby | niets — data bestaat al; let op de overlap met thema 1 |
| [`T4-5-host-specifieke-copy.md`](T4-5-host-specifieke-copy.md) | open — `lobby.playerSelf` vraagt eerst een prop, zie [`REVIEW.md`](REVIEW.md) | Spelerslobby-copy + host-pauzestempel | `lobby.playerSelf` vraagt tóch een nieuwe prop in `createLobbyView` |

[`REVIEW.md`](REVIEW.md) — feitelijke controle van T4-4/T4-5 en de bugmelding
tegen de code (3 aug 2026). Zes bevindingen; **de ontbrekende `playerSelf`-prop
(T4-5 §1) en de kop van T4-4 §2 moeten gecorrigeerd zijn vóórdat iemand deze
twee prompts uitvoert.**

T4-2 is na reviewfeedback opgesplitst in T4-2a (geen open productbesluit,
direct uitvoerbaar) en T4-2b (wél een open productbesluit) — zie de uitleg
bovenaan T4-2b.

Bewust nog geen prompt voor (geverifieerd tegen de code, niet aangenomen):

- **Gelijke plaatsen** (§11) — vraagt eerst een productbesluit over de
  tie-regel zelf (wie staat bovenaan bij een gelijke stand?), niet alleen
  tekst.
- **Podium: delen/afsluiten** (§11) — `podium.mjs` heeft alleen een
  rematch-knop; delen/afsluiten zijn geen ontbrekende tekst maar ontbrekende
  knoppen/acties, dus eerder een schermgat (thema 1) dan tekstwerk.
- **Sociale headlines** (§10) — de copy-helft is van hier, maar zonder de
  selectielogica (thema 1, S14) heeft een templateset nergens een plek om te
  verschijnen. Wacht op afstemming met thema 1.
- **Countdown-copy** (§7) — het scherm zelf bestaat nog niet (thema 1, S07).
- **Naam-botsingsmelding** (§5) — de server voegt de suffix stil toe zonder
  een apart signaal (`nameSource` onderscheidt alleen server-verzonnen van
  zelf-gekozen, niet "botste met een bestaande naam"). Vraagt een
  protocolveld, geen tekstwerk — buiten mijn bevoegdheid zonder overleg.
- **Puntendelta + rank movement** (§9) — geblokkeerd, zie de aparte
  bugmelding: de echte `round:ended`-payload heeft niet eens de velden die
  `round-model.mjs` momenteel verwacht, dus dit moet eerst als bugfix
  opgelost worden vóórdat er een delta-tekst op gebouwd kan worden.
