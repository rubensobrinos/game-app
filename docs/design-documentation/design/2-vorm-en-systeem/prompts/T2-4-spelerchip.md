# Prompt — T2-4: Spelerchip met tijdelijke identiteit

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S05`, `S06`).

_Herzien ná review: `D-008` was een misattributie, en de eerste versie vulde
`O-009` in terwijl `T2-7` in dezelfde set juist stelt dat dat niet mag._

## Brondocument

`05-DESIGN-SYSTEM.md` §8 (Spelerchip / spelerrow) en §3 (iconografie).
`01-PRODUCT-EXPERIENCE-NORTH-STAR.md` §3 ("geen persoonlijke profielen nodig
om competitie en identiteit te voelen"). `04` S06. `D-002` (geen account of
download) en `08` §8 ("spelersnamen zijn tijdelijke roomdata").

**`D-022` maakt dit bouwbaar.** De eerste versie van deze prompt citeerde de
*werkhypothese* bij `O-009` alsof die bindend was — precies wat `00` §4
verbiedt en wat `T2-7` in dezelfde set aan de producteigenaar voorlegt. Dat
was inconsistent. De producteigenaar heeft `O-009` inmiddels gesloten met
`D-022`: kleur/symboolidentiteit wordt nú gebouwd, niet in fase 3, omdat
`04` S06 haar al in de spelerslobby vereist. Geen avatars, geen accounts,
geen kinderkarakters.

De eerdere verwijzing naar `D-008` is geschrapt: dat besluit gaat over sociale
feedback vóór munten en power-ups, en zegt niets over avatars of tijdelijke
identiteit.

## Wat er nu staat

`views/lobby.mjs` rendert per speler een `<li class="lobby-player">` met alleen
`textContent`. Veilig — namen zijn gebruikersinvoer en gaan nooit via
`innerHTML` — maar visueel is het een grijze reep tekst.

**Er is ook geen afkapping**, anders dan thema 2's eigen `PROGRESS.md`
beweert: `.lobby-player` heeft geen `overflow`, `text-overflow` of
`white-space`. Alleen `.scoreboard-name` en `.podium-name` hebben dat. Het
niveau 1 op die regel is dus te hoog gescoord; corrigeer dat bij het landen
van deze prompt.

`05` §8 vraagt om naam plus **een eenvoudige tijdelijke identiteit: kleur en
symbool**. Dat is wat een lijst namen verandert in een groep mensen, en het
kost geen account, geen avatar en geen opslag.

## Wat dit is

1. **Een `createPlayerChip({ name, playerId })`-component** die naam plus een
   kleur/symbool-identiteit teruggeeft, herbruikbaar in lobby, hostbalk en
   later leaderboard.

2. **De identiteit is afgeleid, niet opgeslagen.** Bereken kleur en symbool
   deterministisch uit `playerId`, zodat dezelfde speler bij elke render en op
   elk apparaat hetzelfde krijgt zonder dat er iets bewaard hoeft te worden.
   Een simpele hash over de id, modulo de paletgrootte.

3. **Palet en symbolenset zijn eindig en vastgelegd.** Kies acht tot twaalf
   kleuren die op beide thema's voldoende contrast houden, en een set
   geometrische symbolen — géén emoji, géén gezichtjes of kinderfiguren.
   `05` §3 vraagt om één consistente iconenset met geometrische vormen;
   `D-022` sluit kinderkarakters uit. (`D-015` gaat over merk- en
   podiumassets en dekt dit niet — die verwijzing is geschrapt.)

4. **Botsingen zijn geen bug.** Bij twintig spelers en tien kleuren delen
   mensen een kleur. Dat is prima zolang de naam de dragende informatie blijft
   — kleur en symbool zijn versiering die herkenning versnelt, geen unieke
   sleutel. Bouw er geen uniciteitsgarantie omheen.

5. **Afkapping met toegankelijke volledige naam** (`05` §8): `text-overflow:
   ellipsis` visueel, volledige naam beschikbaar voor een screenreader.

## Regels

- **Nooit `innerHTML` voor de naam.** Dat is gebruikersinvoer; het bestaande
  `textContent`-patroon blijft.
- **Geen joinmotion hier.** Dat is `E03` en dus thema 3. Deze prompt levert de
  chip; de animatie bij binnenkomst hangt thema 3 eraan.
- **Geen avatar, geen upload, geen accountconcept.** `D-002` en `08` §8 zijn
  helder: identiteit is tijdelijk en roomgebonden.
- **Stem de hostbalk af met thema 1 vóór je die als gebruiker meerekent.**
  Thema 1's `01-snelle-reparaties.md` wil de spelerslijst in de hostbalk
  tijdens `LOBBY` juist wéghalen wegens dubbele weergave, en
  `03-S06-spelerslobby.md` schrijft in dezelfde spelerszone van `lobby.mjs`.
  Bouw de chip herbruikbaar, maar reken niet op een plek die misschien
  verdwijnt.
- **`05` §8's "optionele hostmenuactie" valt buiten deze prompt** — die hoort
  bij `S17` en dus bij thema 1. Genoemd zodat hij niet stil verdwijnt.
- De kleur mag **niet** de enige drager van betekenis worden (`08` §2.3) — hij
  onderscheidt spelers, hij codeert geen status.

## Definition of done

- Twintig chips naast elkaar gerenderd in beide thema's, screenshot: elke naam
  leesbaar, elk symbool onderscheidbaar, geen kleur die wegvalt tegen de
  achtergrond.
- Dezelfde `playerId` geeft twee keer achter elkaar dezelfde kleur en hetzelfde
  symbool — met een test vastgelegd, niet met het oog.
- Een naam van 60 tekens breekt de layout niet en is volledig beschikbaar voor
  een screenreader.
- De component staat in `HANDOFF-UI.md` met zijn aanroep.
