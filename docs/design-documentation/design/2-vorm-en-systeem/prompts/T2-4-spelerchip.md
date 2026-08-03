# Prompt — T2-4: Spelerchip met tijdelijke identiteit

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S05`, `S06`).

## Brondocument

`05-DESIGN-SYSTEM.md` §8 (Spelerchip / spelerrow). `01-PRODUCT-EXPERIENCE-NORTH-STAR.md`
§3 ("geen persoonlijke profielen nodig om competitie en identiteit te voelen").
`D-008` en `O-009`.

## Wat er nu staat

`views/lobby.mjs` rendert per speler een `<li class="lobby-player">` met alleen
`textContent`. Veilig — namen zijn gebruikersinvoer en gaan nooit via
`innerHTML` — maar visueel is het een grijze reep tekst.

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
   geometrische symbolen — géén emoji (`D-015`), géén gezichtjes of
   kinderfiguren (`O-009` is expliciet: "geen kinderkarakters").

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
- **Geen avatar, geen upload, geen accountconcept.** `D-008` en de north star
  zijn helder: identiteit is tijdelijk en roomgebonden.
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
