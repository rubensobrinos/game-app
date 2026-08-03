# Feedback eerste echte livetest — 3 aug 2026, play.aseso.nl

**Bron:** producteigenaar (host op mobiel) + regie (speler via invite-link,
desktop). Eerste multi-speler lobby ooit op productie: 3 spelers (host-mobiel,
speler-mobiel, regie-desktop). Join via gedeelde link én via code werkte;
realtime spelerteller klopte overal.

**Status per punt:** open = nog niet opgepakt. Eigenaar: UI-agent (UX-pass
loopt al op verzoek producteigenaar), tenzij anders vermeld.

## 1. Spelersnamen renderen niet (goed) op mobiel — open, hoogste prioriteit

Waarneming host-mobiel: in de lobby-spelerslijst is alleen "Speler 1" (de
host zelf) leesbaar; de twee andere rijen zijn **leeg** (wel een rij-kader,
geen naam). Zelfde beeld onder "Spelers beheren": drie bullets, alleen de
eerste met naam, plus kale "Verwijder"-knoppen zonder wie je dan verwijdert.

Technische observatie van regie die hier vrijwel zeker onder ligt (voor de
UI-agent om te verifiëren, zit vermoedelijk NIET in CSS):

- `room:state` levert bewust alleen `self` + `playerCount`, geen namenlijst
  (staat letterlijk in de modulekop van `session-shell.mjs`).
- Namen van ánderen komen alleen binnen via `room:player-changed`-events.
- Gevolg: wie er al waren vóórdat jouw client verbond, hebben bij jou geen
  naam — de lijst kent wel het áántal (playerCount) maar niet de namen.
  Regie zag spiegelbeeldig hetzelfde: als laatst-gejoinde speler alleen de
  eigen naam "Claude 🤖", geen rijen voor de twee eerdere spelers.
- Oploswegen (keuze aan UI + INT-A samen): (a) namenlijst opnemen in de
  snapshot (`room:state`) — protocolwijziging, PROTOCOL.md §State-snapshot;
  of (b) bij binnenkomst per zichtbare speler een naamloze rij tonen met
  duidelijke placeholder tot het eerstvolgende event. (a) is de echte fix;
  (b) is hooguit cosmetisch.

## 2. Code moet permanent zichtbaar zijn voor de host — open

Nu zit de code achter een "Toon code"-knop. In de praktijk (host voor een
groep, mensen druppelen binnen) wil je code — en liefst ook QR — **continu**
in beeld, groot genoeg om vanaf een telefoon voor te lezen. Kahoot-patroon:
code staat permanent bovenaan, altijd.

Voorstel: code (6 cijfers, groot) vast bovenin de lobbyweergave voor de
host; "Toon QR-code" mag een toggle blijven maar de code zelf nooit
verstopt. Speler-weergave hoeft dit niet.

## 3. Pauze blokkeert álles, ook de host zelf — open

Waarneming host-mobiel tijdens ronde 6/10: na pauzeren dekt de overlay
"Gepauzeerd door de host" het hele scherm en kan niemand meer iets — de host
óók niet, behalve de ene Hervat-knop. De hostbalk (Vergrendel/Beëindig/
Spelers beheren) schemert erdoorheen maar is onbereikbaar.

Dat de overlay spelers blokkeert is bedoeld gedrag (spel ligt stil). Dat de
HOST tijdens een pauze niets kan behálve hervatten is te beperkt: pauze is
juist hét moment waarop je iemand wilt verwijderen, wilt vergrendelen of het
spel wilt beëindigen. Voorstel: voor de host de hostbalk-acties bereikbaar
maken vanuit/naast de pauze-overlay (of de overlay voor de host niet
scherm-dekkend maken); voor spelers blijft hij dekkend.

## 4. Instellingenmenu (taal/thema) botst visueel met het spel — open

Het hamburgermenu klapt open óver de spelinhoud en het hostbalk-gebied heen
(zie screenshot: menu half over "Verwijder"-rijen en het rondelabel). Werkt
wel, oogt rommelig — "kan wel maar niet echt heel chill weergegeven".
Voorstel voor de UX-pass: menu als nette laag mét achtergrond/schaduw en
duidelijke afbakening, hostbalk inklapbaar of achter één "Host"-knop op
mobiel (dat scheelt ook het permanente ruimtebeslag bovenin — punt 2 wint
daar dan ruimte voor de vaste code).

## Kader voor de UX-pass (afgesproken met regie)

- Alleen `frontend/css/` en view-DOM (`frontend/js/views/`) aanraken.
- NIET aan de bedrading in `session-shell.mjs` komen — daar zit de verse
  eerste-snapshot-fix in — en geen logica in views trekken.
- Punt 1 hierboven raakt vermoedelijk het protocol/snapshot-contract en is
  dus géén solo-UI-klus: eerst afstemmen (HANDOFF-UI ↔ INT-A) vóór er iets
  wordt "opgelost" in alleen de weergave.
