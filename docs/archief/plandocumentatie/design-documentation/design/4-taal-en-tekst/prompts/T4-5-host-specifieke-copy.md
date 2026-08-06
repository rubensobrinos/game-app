# Prompt — T4-5: Host-specifieke copy in lobby en pauze

**Status: uitgevoerd.** Onderdeel van [`../PROGRESS.md`](../PROGRESS.md),
thema 4. Dekt §6-speler en het host-deel van §12. Beide stonden al genoemd
in `prompts/README.md` als "groter dan een directe tekstcorrectie" —
geverifieerd dat het onderscheid dat nodig is (host vs. speler) al overal
beschikbaar is zonder serveraanpassing, dus toch direct uitvoerbaar. **Punt 1
gecorrigeerd ná [`REVIEW.md`](REVIEW.md) F1** — de eigen naam is géén
bestaande lobby-modeldata, dat vroeg tóch één nieuwe, kleine prop.

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
- `lobby.playerSelf`: `Je speelt als {naam}` — zelfde plaatshouderpatroon als
  elders (`{n}` bij `tCount`), hier `{naam}` in de vertaalstring, ingevuld in
  code (niet via `t()`'s interpolatie, die bestaat niet — zie de bestaande
  `${t('game.correctAnswer')}: ${...}`-stijl in `gameplay.mjs` voor het
  label+waarde-patroon dat dit codebestand al gebruikt).

**Correctie (`REVIEW.md` F1):** de eigen naam is géén bestaande
lobby-modeldata. `createLobbyView({ root, t, tCount, isHost, gameCode,
onStart, onShareAction })` (`lobby.mjs:19`) krijgt geen naam, en
`update({ playerCount, participants, canStart, capabilities, joinUrl })`
(`session-shell.mjs:507-513`) stuurt een `participants`-`Map<playerId,
effectiveName>` zonder `selfPlayerId` — de lobby kan dus niet bepalen welke
entry de eigen speler is. `selfInfo` (`{ roles, playerId, effectiveName }`,
`session-shell.mjs:154`) bestaat wél, maar wordt nergens doorgegeven.

Nodig: één nieuwe waarde in de `update()`-payload, bijvoorbeeld
`selfName: selfInfo?.effectiveName ?? null`, en `lobby.mjs`'s `update()`
neemt die aan naast de bestaande parameters. Triviale toevoeging, maar wel
een echte propuitbreiding — niet doen alsof de data er al is.

Blijft ongewijzigd: de host-kant van `lobby.mjs` (deelactie, spelersaantal,
startknop) — dit is puur een toevoeging voor de niet-host-tak, geen
herschrijving.

## 2 — Host-pauzestempel

De pauze-overlay toont nu voor host én speler dezelfde reden-tekst
(`Gepauzeerd door de host`). Voeg een host-specifieke stempel-variant toe:

- Nieuwe sleutel `pause.hostStamp`: `Game gepauzeerd` — als stempel bedoeld
  (hoofdletters via CSS `text-transform`, net als de resultaatstempels uit
  T4-3, niet in de vertaalwaarde zelf).
- Toon deze i.p.v. (niet naast) de bestaande `pause.reason`-tekst wanneer
  `isHost() === true`; spelers blijven de bestaande kalme zin zien.

## Regels

- Alle nieuwe sleutels in `nl.mjs`, `en.mjs`, `es.mjs` tegelijk.
- Precies één nieuwe waarde toegestaan: `selfName` in `lobby.mjs`'s
  `update()`-payload (zie F1-correctie hierboven). Verder geen nieuwe props
  naar `createLobbyView`/de pauze-overlay — die hebben al wat nodig is
  (`isHost`). Blijkt er tijdens het bouwen nóg iets te ontbreken, dan is dat
  een signaal dat deze prompt een verkeerde aanname deed, geen reden om het
  zelf stilzwijgend uit te breiden.
- Hoofdlettering van het pauzestempel via CSS, niet via de vertaalwaarde
  (zelfde regel als T4-3's resultaatstempels).

## Definition of done — behaald

- Browserverifieerd tegen `transport-mock.mjs` (Playwright, host + tweede
  speler tegelijk gemount): de niet-host ziet alle vier spelerslobby-teksten
  inclusief de eigen naam ("Je speelt als Tweede Speler"); ná het klikken van
  de host-pauzeknop toont de host "Game gepauzeerd" (klasse
  `session-pause-card-host-stamp`), de speler blijft "Gepauzeerd door de
  host" zien zonder die klasse.
- `node --test`: 2749/2749 groen (volledige suite).
- `PROGRESS.md` §6-speler en §12 (pauzetekst host) naar niveau 2.
