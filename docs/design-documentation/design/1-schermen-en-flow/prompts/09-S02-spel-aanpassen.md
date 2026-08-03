# Prompt — 09: S02 — Spel aanpassen

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Niveau 0 —
bestaat niet. Grootste losse nieuwe scherm van de negen prompts, en Fase 2
in de roadmap (niet Fase 1) — pak deze als laatste van de negen, of parallel
zodra er ruimte is.

## Brondocument

[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md) S02.

## De reducer is al klaar — dit is puur een DOM-scherm bouwen

`client/flow/host-setup-state.mjs` ondersteunt nu al volledig: `OPEN_ADVANCED`
(wisselt `state.mode` naar `'advanced'` — welk scherm getoond wordt),
`SET_FIELD` (wijzigt elk veld in `SETTABLE_CONFIG_KEYS`: `gameTypes`,
`language`, `difficulty`, `totalRounds`, `pacing`, `speedBonus`,
`allowLateJoin`, `config.mode`), en `TOGGLE_HOST_PARTICIPATES`. `home.mjs`
dispatcht geen van drieën — de `Spel aanpassen`-link bestaat gewoon nergens.
Dit is dus geen nieuwe state-logica bouwen, alleen een scherm dat de al
bestaande reducer aanstuurt.

**Let op, twee verschillende velden heten toevallig hetzelfde** — dit
document schrijft daarom overal voluit `state.mode` of `config.mode`, nooit
kaal `mode`:

- `state.mode`: `'quick-start'` | `'advanced'` — welk scherm getoond wordt.
- `config.mode`: alleen `'individual'` — teams of niet (zie scope-beperking
  2 hieronder).

## Twee echte scope-beperkingen — niet zelf oplossen, hier vastleggen

`04`'s S02-structuur noemt vijf groepen, maar twee ervan hebben geen
onderliggende data:

1. **"Spelvorm"** — `gameTypes` bestaat als veld, maar `defaultHostConfig()`
   zet 'm vast op `['flags_mc']` en de code-comment in
   `host-setup-state.mjs` legt uit waarom: `DECISIONS.md` #31/#32/#35 heeft
   meerdere spelvormen voor deze MVP expliciet geschrapt. Een spelvorm-kiezer
   zou dus vandaag precies één, niet-wijzigbare optie tonen. Bouw 'm niet als
   schijnkeuze — laat deze groep weg of toon 'm expliciet als "flags_mc
   (enige beschikbare spelvorm voor nu)", geen dropdown die niets doet.
2. **"Teams of individuele modus"** — `HostConfig`'s `config.mode`-veld heeft
   als type letterlijk alleen `'individual'`; er bestaat geen teammodus in
   het datamodel. Bouw hier geen UI voor een waarde die de reducer niet kent
   — meld dit als `HANDOFF`-item aan de eigenaar van `client/flow/` als teams
   gewenst blijven, bouw zelf niet buiten dit bestand om een nieuwe modus.

De overige drie groepen zijn wél volledig bouwbaar: moeilijkheid/taal
(`difficulty`, `language`), rondes (`totalRounds` — `04` noemt ook "tijd",
maar er is geen tijd-per-ronde-veld in `HostConfig`; als dat gewenst is, is
dat ook een `HANDOFF`-item, geen zelf verzonnen veld), en aanvullende regels
(`pacing`, `speedBonus`, `allowLateJoin`, plus de al bestaande
`hostParticipates`-toggle).

## Aanpak

1. Nieuw bestand `views/host-setup.mjs` (of vergelijkbaar), zelfde
   DOM-in/callbacks-uit-patroon als de andere views. Progressief onthuld
   (`04`): standaardwaarden zichtbaar samengevat, secties pas open bij
   interactie.
2. `Start met deze instellingen`: dispatch `SUBMIT` zoals `home.mjs` dat al
   doet voor quick-start — hergebruik `createRequestFor`, geen nieuwe
   requestvorm.
3. `Herstel standaardinstellingen`: reset naar `defaultHostConfig()` —
   simpelweg een nieuwe `initialHostSetupState()` met `state.mode: 'advanced'`
   behouden zodat de gebruiker niet terug naar quick-start valt.
4. Route: `home.mjs`'s tertiaire `Spel aanpassen`-link dispatcht
   `OPEN_ADVANCED` en toont dit scherm in plaats van zichzelf — geen eigen
   URL-route nodig, dit is een lokale state-wissel binnen dezelfde
   home-flow (vergelijkbaar met hoe code-invoer naar `join.mjs` overschakelt
   zonder navigatie).

## Regels

- Geen nieuwe validatie die verder gaat dan `SETTABLE_CONFIG_KEYS` toestaat.
- Geen schijnopties voor `gameTypes`/`config.mode` zoals hierboven beschreven.
- Elke optie heeft begrijpelijke taal (`04`), geen technische veldnamen in
  de UI.
- Teruggaan (naar quick-start) verliest geen gemaakte keuzes tenzij de
  gebruiker expliciet herstelt.

## Definition of done

- Tegen `transport-mock.mjs`: vanaf de landing naar `Spel aanpassen`,
  minstens twee velden wijzigen (bv. `difficulty` en `totalRounds`), `Start
  met deze instellingen` — de aangepaste config komt aantoonbaar aan bij
  `createGame` (te controleren via de door de mock ontvangen `request`).
  `Herstel standaardinstellingen` zet alles terug.
- De twee scope-beperkingen (spelvorm, teammodus) staan als `HANDOFF`-item
  vastgelegd als je ze niet zelf oplost.
- `../PROGRESS.md` bijgewerkt: S02 van niveau 0 naar het niveau dat de
  gebouwde subset rechtvaardigt — niet naar 2 als spelvorm/teams ontbreken,
  dat zijn expliciete `04`-criteria.
