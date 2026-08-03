# Prompt — T5-9: Spelerslijst bij schaal

**Status in `PROGRESS.md`:** Spelerslijst bij schaal | niveau 1 | bewijs:
gemeten ("Getest tot vijf namen. Geen compact grid, geen aggregatie boven 36,
geen `Bekijk alle spelers`.")

## Brondocument

`07-RESPONSIVE-HOST-PLAYER-MODES.md` §9, exacte tabel:

| Aantal | Presentatie |
|---:|---|
| 0 | empty state met uitnodigingsactie |
| 1–8 | ruime chips/rows met identiteit |
| 9–20 | compact grid |
| 21–35 | grid + recente joins |
| 36–100 | totaal, recente joins, scroll/management apart |
| 100+ | geaggregeerde visualisatie, geen permanente volledige namenmuur |

Plus: "Nieuwe joins mogen bij grote groepen worden gebatcht: `+8 spelers` in
plaats van acht geluids- en motionevents."

## Wat er nu vaststaat en wat niet

`lobby.mjs` rendert elke deelnemer als aparte `<li>` in een simpele lijst,
ongeacht aantal — geen van de zes presentatievormen hierboven bestaat. Ook
`hostbar.mjs`'s spelerslijst (kick-lijst) doet hetzelfde. De 0-staat (leeg)
bestaat al gedeeltelijk (`lobby.emptyTitle`/`lobby.emptyHint`, thema 4).

## Contract

Alleen `views/lobby.mjs`'s deelnemerslijst — `hostbar.mjs`'s kick-lijst blijft
bewust een simpele lijst (dat is een beheerinterface voor de host, geen
sociale-bewijs-weergave; §9 gaat over de zichtbare lobbypresentatie).

- `participantPresentationFor(count)` als pure functie (`views/`, testbaar
  zonder DOM) die op basis van `07` §9's tabel teruggeeft welke variant
  geldt — geen los `if`-blok per aanroepplek.
- 1–8: huidige weergave (ruime rows) blijft, dat dekt dit al.
- 9–35: compact grid (CSS Grid, meerdere kolommen) i.p.v. één kolom lijst.
- 36+: totaalaantal + een korte "recente joins"-lijst (laatste N), rest niet
  individueel getoond. Een aparte "Bekijk alle spelers"-actie (die de volledige
  lijst alsnog toegankelijk maakt — §9 verbiedt een **permanente** namenmuur
  boven 100, niet dat de data ooit zichtbaar mag worden) is voldoende, hoeft
  geen aparte route te zijn.
- Batching: `room:player-changed`-deltas die binnen een kort venster (bv.
  500 ms) na elkaar binnenkomen, samenvoegen tot één `+N spelers`-melding in
  plaats van N losse DOM-updates. Dit raakt `session-shell.mjs`'s
  `applyPlayerChanged`, niet alleen `lobby.mjs`.

## Regels

- Geen kleiner touch-target dan 44px, ook niet in het compacte grid (`08`
  §2.6).
- Namen blijven altijd via `textContent` — geen uitzondering voor de
  compacte/geaggregeerde varianten.
- De host-kick-lijst (`hostbar.mjs`) blijft ongemoeid — niet stilzwijgend
  meenemen in dezelfde wijziging, dat is een aparte component met een ander
  doel.

## Definition of done

- `participantPresentationFor()` heeft eigen tests voor elke drempel uit de
  tabel (0, 1, 8, 9, 20, 21, 35, 36, 100, 101).
- Playwright: lobby gesimuleerd met 0, 5, 15, 30, 50 en 150 deelnemers
  (`transport-mock.mjs` kan dit via herhaalde `joinGame`-aanroepen vóór
  `connect()`), screenshot per drempel.
- Batching aantoonbaar: vijf joins binnen 500ms leveren één DOM-mutatie op,
  niet vijf.
- `PROGRESS.md`'s rij gaat van "1, gemeten (tot vijf namen)" naar "gemeten
  (volledige schaal)".
