# Prompt — 03: S06 — Eigen spelerslobby-variant

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)).

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §5.3
(`PLAYER_LOBBY`), [`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md)
S06.

## Huidige situatie

`lobby.mjs` toont vandaag letterlijk hetzelfde scherm aan host én speler. Het
enige verschil is dat hostspecifieke elementen (startknop, hostbalk) wegvallen
via een generieke `isHost`-check — er is nooit een bewust ontworpen
spelersscherm gebouwd, alleen hergebruik. Vandaar niveau 1 met een
niveau-0-grensgeval in `../PROGRESS.md`.

## Wat `04` S06 vraagt, en wat er nu mist

- bevestiging dat de speler in de juiste room zit — **ontbreekt** (geen
  expliciete "je zit in game 482 917"-tekst);
- eigen naam/identiteit zichtbaar — **ontbreekt** (de speler ziet de
  deelnemerslijst, niet specifiek zíjn eigen naam/rol uitgelicht);
- aantal aanwezige spelers — bestaat al (`lobby.mjs`'s `.lobby-count`);
- status `De host start zo` — bestaat al (`lobby.waiting`-sleutel), tekst
  wijkt af van wat thema 4 voorschrijft maar valt buiten deze prompt;
- `Nodig iemand uit` — **ontbreekt volledig**. Dit is niet hetzelfde als de
  hostbalk se deelacties: een speler heeft geen hostbalk. De speler heeft een
  eigen, kleinere deelactie nodig (minimaal copy-link/native-share; geen QR
  nodig zodra `02-S05-permanente-qr-code.md` de code/QR al permanent in de
  header toont voor iedereen, `D-019`);
- **niet tonen:** hostcontrols — dit klopt al toevallig via `isHost`, maar nu
  bewust, niet als bijeffect.

## Aanpak

`lobby.mjs` blijft één bestand met een `isHost`-parameter (geen aparte
`player-lobby.mjs` nodig, dat zou de gedeelde structuur — deelnemerslijst,
wachtstatus — onnodig dupliceren). Wat wél moet:

1. Voeg een eigen-identiteit-regel toe: haal de eigen naam op uit `self`
   (`session-shell.mjs` heeft die al, `selfInfo.effectiveName`) en toon 'm
   uitgelicht, niet alleen ergens in de deelnemerslijst tussen de rest.
2. Voeg `Nodig iemand uit` toe voor niet-hosts: hergebruikt
   `share-actions.shareUrlsFor`/`shareActionsFor`, maar met een kleinere
   actieset (geen `show-qr` — die zit al permanent in de header na prompt 02).
3. Voeg de bevestigingsregel toe ("je zit in room {code}") — kort, geen
   nieuwe schermsectie.

## Regels

- Geen hostcontrols tonen aan een niet-host, ook niet per ongeluk via een
  gedeelde selector die "toevallig" leeg blijft — expliciet checken op rol.
- Namen altijd via `textContent`.
- Geen nieuwe aanname over wat een `room:state`/`room:player-changed`-payload
  bevat buiten wat al gebruikt wordt.

## Definition of done

- Tegen `transport-mock.mjs`, twee sessies (host + speler) in dezelfde room:
  de speler ziet zijn eigen naam uitgelicht, een bevestigingsregel, en een
  eigen `Nodig iemand uit`-actie zonder QR-knop (die staat al in de header).
  De host ziet nog steeds zijn eigen hostbalk en startknop; de speler ziet
  geen van beide.
- `../PROGRESS.md` bijgewerkt: S06 kan naar niveau 1 volwaardig (of hoger)
  zodra dit er is — niet meer het niveau-0-grensgeval dat het nu is.
