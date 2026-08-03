# Prompt — T4-5: Host-specifieke copy in lobby en pauze

Onderdeel van [`../PROGRESS.md`](../PROGRESS.md), thema 4. Dekt §6-speler en
het host-deel van §12. Beide stonden al genoemd in `prompts/README.md` als
"groter dan een directe tekstcorrectie" — geverifieerd dat het onderscheid
dat nodig is (host vs. speler) al overal beschikbaar is zonder
serveraanpassing, dus toch direct uitvoerbaar.

## Brondocument

`09-CONTENT-AND-MICROCOPY.md` §6 (spelerslobby), §12 (pauzetekst host).

## Waarom dit wél kan zonder protocolwijziging

`isHost()` in `session-shell.mjs:204-206` (leest
`selfInfo?.roles?.includes('host')`) wordt al doorgegeven aan
`createLobbyView({ isHost: isHost(), ... })` (`session-shell.mjs:470`,
gebruikt in `lobby.mjs:19,76,241`) én aan de pauze-overlay
(`session-shell.mjs:312,318`: `pauseResumeButton.hidden = !isHost()`). Beide
renderpunten weten dus al of ze voor host of speler tekenen — dit is puur
een kwestie van de bestaande `isHost`-branch uitbreiden met tekst, geen
nieuwe data nodig.

## 1 — Spelerslobby-copy

`lobby.mjs` toont host en speler momenteel exact hetzelfde scherm. Voeg een
`isHost === false`-tak toe met de vier ontbrekende teksten uit `09` §6:

- `lobby.playerJoined`: `Je bent binnen`
- `lobby.playerWaitingForHost`: `De host start zo`
- `lobby.playerInviteHint`: `Nodig iemand uit`
- `lobby.playerSelf`: `Je speelt als {naam}` — gebruik het bestaande
  interpolatiepatroon (`{n}` bij `tCount`, hier `{naam}` als losse
  plaatshouder in de vertaalstring, ingevuld met de eigen `effectiveName`
  die al beschikbaar is in de lobby-model-data).

Blijft ongewijzigd: de host-kant van `lobby.mjs` (deelactie, spelersaantal,
startknop) — dit is puur een toevoeging voor de niet-host-tak, geen
herschrijving.

## 2 — Host-pauzestempel

De pauze-overlay toont nu voor host én speler dezelfde reden-tekst
(`Gepauzeerd door de host`). Voeg een host-specifieke stempel-variant toe:

- Nieuwe sleutel `pause.hostStamp`: `GAME GEPAUZEERD` — als stempel bedoeld
  (hoofdletters via CSS `text-transform`, net als de resultaatstempels uit
  T4-3, niet in de vertaalwaarde zelf).
- Toon deze i.p.v. (niet naast) de bestaande `pause.reason`-tekst wanneer
  `isHost() === true`; spelers blijven de bestaande kalme zin zien.

## Regels

- Alle nieuwe sleutels in `nl.mjs`, `en.mjs`, `es.mjs` tegelijk.
- Geen nieuwe props naar `createLobbyView`/de pauze-overlay nodig buiten wat
  er al is (`isHost`, de bestaande lobby-modeldata) — als tijdens het bouwen
  blijkt dat er tóch iets ontbreekt, is dat een signaal dat deze prompt een
  verkeerde aanname deed, geen reden om het zelf stilzwijgend uit te breiden.
- Hoofdlettering van het pauzestempel via CSS, niet via de vertaalwaarde
  (zelfde regel als T4-3's resultaatstempels).

## Definition of done

- Handmatig tegen `transport-mock.mjs`: een tweede (niet-host) speler die
  joint ziet de vier spelerslobby-teksten i.p.v. de hostweergave; een
  gepauzeerd potje toont de host een stempel, de speler de bestaande zin.
- `node --test` groen (volledige suite).
- `PROGRESS.md` §6-speler en §12 (pauzetekst host) naar niveau 1 of 2.
