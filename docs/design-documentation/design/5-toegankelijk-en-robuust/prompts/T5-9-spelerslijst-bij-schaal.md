# Prompt — T5-9: Spelerslijst bij schaal

**Status: prompt gecorrigeerd, nog niet gebouwd.** Twee bevindingen uit
`REVIEW.md` verwerkt (zie hieronder); de feature zelf
(`participantPresentationFor()`, het compacte grid, batching) is nog niet
gebouwd — dat is los, groter werk.

**Correctie 1 — 100+ niet aantoonbaar met de mock.** De oorspronkelijke DoD
vroeg de lobby te simuleren met "0, 5, 15, 30, 50 en **150** deelnemers" via
`transport-mock.mjs`. Dat kan niet: `transport-mock.mjs:39` zet
`MAX_PLAYERS = 100`, en `joinGame` gooit `GAME_FULL` zodra
`countActivePlayers(target) >= MAX_PLAYERS`. **Besluit:** `MAX_PLAYERS` blijft
100 — dat is productgedrag (een echte limiet op spelersaantal), geen
testbeperking om zomaar op te rekken voor een DoD. De 100+-variant wordt
bewezen via `participantPresentationFor()`'s eigen unit tests (een pure
functie, `participantPresentationFor(150)` kost niets), niet via een visuele
Playwright-controle met 150 daadwerkelijk gejointe spelers. De visuele
controle stopt bij 100.

**Correctie 2 — bronvermelding 44px.** De Regels citeerden "`08` §2.6" voor
de 44px-touch-targeteis. `08` §2.6 "Touch en motoriek" zegt alleen "grote
targets; voldoende afstand" — geen getal. De 44px is een bestaande
repo-conventie (`base.css:251`: `min-height: 44px`), geen spec-eis. Regel
hieronder aangepast.

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

- Geen kleiner touch-target dan 44px, ook niet in het compacte grid —
  bestaande repo-conventie (`base.css`'s `min-height: 44px`-patroon), geen
  citaat uit `08` §2.6 (die noemt geen getal).
- Namen blijven altijd via `textContent` — geen uitzondering voor de
  compacte/geaggregeerde varianten.
- De host-kick-lijst (`hostbar.mjs`) blijft ongemoeid — niet stilzwijgend
  meenemen in dezelfde wijziging, dat is een aparte component met een ander
  doel.
- `MAX_PLAYERS = 100` in `transport-mock.mjs` blijft ongewijzigd — dit is
  productgedrag, geen testbeperking om op te rekken.

## Definition of done

- `participantPresentationFor()` heeft eigen tests voor elke drempel uit de
  tabel (0, 1, 8, 9, 20, 21, 35, 36, 100, 101, **150**) — de 100+-variant
  wordt hier bewezen (pure functie, geen mock-limiet), niet visueel.
- Ad-hoc Playwright (geen projectdependency, zie `prompts/README.md`): lobby
  gesimuleerd met 0, 5, 15, 30, 50 en **100** deelnemers (de mock-limiet),
  screenshot per drempel. 150 wordt bewust niet visueel getoond — zie
  Correctie 1 hierboven.
- Batching aantoonbaar: vijf joins binnen 500ms leveren één DOM-mutatie op,
  niet vijf.
- `PROGRESS.md`'s rij gaat van "1, gemeten (tot vijf namen)" naar "gemeten
  (volledige schaal tot de mock-limiet, 100+ unit-bewezen)".
