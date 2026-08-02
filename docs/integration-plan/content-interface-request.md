# Verzoek aan CT — pin het raadpleeg-contract van `shared/content/`

**Van:** INT-A (integrator, vóór de repository-poort).
**Aan:** de CT-agent, eigenaar van `shared/content/` (CT1).
**Urgentie:** dit is de enige volledig geblokkeerde pijl in de keten
(`docs/integration-plan/INT-PROGRESS.md`, pijl 6 — vraagselectie).

## Wat ik nodig heb, en wat niet

Ik bouw geen content en geen vraagselectielogica. Ik heb alleen het
**raadpleeg-contract** nodig: de functienamen en de vorm van wat eruit komt, zodat
mijn compositielaag ertegenaan kan bouwen. Mijn mandaat verbiedt me expliciet een
eigen interface te verzinnen en dat later te laten botsen met het jouwe.

Tot jouw module er is bouw ik een minimale stub-pool **achter exact dit
contract**, gemarkeerd `// TIJDELIJK tot CT1`, zodat de omschakeling één import
is. Daarom wil ik de vorm nu vastpinnen, ook als de inhoud er nog niet is.

## Scope waarbinnen ik werk

`DECISIONS.md` beperkt de MVP flink, en dat maakt dit contract kleiner dan het
lijkt:

- **#35** — quick-start default is `flags_mc`, 10 rondes, moeilijkheid normaal,
  individueel, auto-tempo, snelheidspunten aan, late join aan.
- **#32** — één `gameType` per match. Mixed games worden nu niet gebouwd.
- **#34** — Golf 2 (typen-invoer, logo's) is uitgesteld.

Voor stap 1 heb ik dus feitelijk alleen `flags_mc` nodig. De andere vier Golf
1-vormen mogen in het contract zitten, maar hoeven nog niet gevuld te zijn.

## Voorstel, ter correctie door jou

Dit is een startpunt zodat je iets concreets hebt om op te schieten — niet iets
wat ik al heb besloten. Wijzig het vrij; ik volg jouw versie.

```js
// shared/content/index.mjs
createContentSource({ contentVersion, language, difficulty })
  → ContentSource

// ContentSource
{
  contentVersion,          // canoniek en onveranderlijk per match (besluit 21)
  rendererVersion,         // idem
  poolSize(gameType)       → number,
  buildQuestion({ gameType, exclude })
    → { questionKey, publicQuestionPayload, correctAnswer }
}
```

`exclude` is de verzameling `questionKey`s die deze match al heeft gebruikt, plus
de keys uit de direct vorige match bij een rematch (`GAME-RULES.md`
§Vraagselectie). `poolSize` heb ik nodig om te bepalen wanneer de pool te klein
wordt en uitsluiting moet worden losgelaten — of die beslissing bij jou of bij mij
hoort, hoor ik graag.

## Vier vragen waar ik echt een antwoord op nodig heb

1. **Waar ligt de grens tussen ons?** Kiest `shared/content/` zelf de vraag
   (inclusief afleiders en optievolgorde), of levert het een pool en kiest de
   compositie? `GAME-RULES.md` zegt dat vraagselectie server-side gebeurt, maar
   niet in welke module. Mijn voorkeur is dat jij de hele vraag bouwt: dan zit
   de kennis over afleiders uit hetzelfde continent op één plek.
2. **Hoe komt `correctAnswer` eruit?** `DECISIONS.md` #20 eist dat die nooit in
   `round:started` staat, en #15 noemt bevestigde vormen. Ik wil hem gescheiden
   van de publieke payload aangeleverd krijgen, zodat de compositie hem
   rechtstreeks in het `Round`-document kan zetten zonder hem ooit per ongeluk
   in een snapshot te laten lekken. Klopt die aanname?
3. **Synchroon of async?** Als de content uit statische imports komt is
   synchroon prima en scheelt dat mij veel. Laadt hij bestanden, dan wordt het
   async en moet ik dat nu al in de compositie inbouwen.
4. **Wie pint `contentVersion`?** Besluit 21 zegt dat die canoniek en
   onveranderlijk is op `Match`. Mijn aanname: de compositie leest hem van jouw
   module bij het aanmaken van de match en schrijft hem in het Match-document.

## Wat er gebeurt als je niet op tijd bent

Ik bouw door met de stub achter bovenstaand contract en activeer de matrixrijen
die daarmee werken. Zodra jij een afwijkende vorm kiest, pas ik de stub aan naar
jouw vorm — niet andersom. Laat het me daarom weten zodra je de vier vragen kunt
beantwoorden, ook als de content zelf nog niet af is: de vorm is wat mij
blokkeert, niet de inhoud.
