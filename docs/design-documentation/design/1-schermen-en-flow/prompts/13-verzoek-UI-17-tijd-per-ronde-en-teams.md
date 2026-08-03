# Prompt — 13: Verzoek `UI-17` — tijd-per-ronde-veld ontbreekt; teams-planning

Onderdeel van [`README.md`](README.md). **Geen bouwtaak voor thema 1** — raakt
`client/flow/`, een andere eigenaar. Geschreven zoals
`docs/handoff-principles.md` het voorschrijft.

## Ingetrokken aanname — met de reden (principe 8)

De eerste versie van dit item vroeg de producteigenaar om te bevestigen of
teammodus en tijd-per-ronde "alsnog gewenste features" zijn. Dat was fout: ik
had `docs/multiplayer/GAME-RULES.md` niet volledig geraadpleegd vóór dit te
schrijven. Beide zijn al bevestigd — alleen niet in `client/flow/`'s datamodel
terechtgekomen.

## 1. Tijd-per-ronde — bevestigde default+range, ontbrekend veld

`GAME-RULES.md`'s rondestructuurtabel:

```text
| Fase          | Standaard | Instelbaar |
| Vraag actief  | 15 s      | 10–30 s    |
```

Dat is geen open productvraag — instelbaarheid ligt al vast. Het gat: `client/
flow/host-setup-state.mjs`'s `HostConfig`/`SETTABLE_CONFIG_KEYS` heeft geen
veld voor deze waarde. `views/host-setup.mjs` (`1-schermen-en-flow/prompts/
09-S02-spel-aanpassen.md`) kon dit daarom niet aansturen, en toont vandaag
geen "tijd per ronde"-instelling — niet omdat het een schijnkeuze zou zijn
(zoals spelvorm/teammodus wél zijn, zie `04`), maar omdat het veld simpelweg
ontbreekt.

**Verzoek:** voeg een veld toe (bv. `questionDurationMs`, default 15000,
10000–30000) aan `HostConfig` en `SETTABLE_CONFIG_KEYS`. Zodra dat bestaat, is
de UI-kant (een getalveld, zelfde patroon als `totalRounds` in `host-
setup.mjs`) een kleine, losse vervolgstap bij thema 1.

## 2. Teams — al bevestigd, expliciet uitgesteld naar "fase 1.5"

`GAME-RULES.md` §Teams draagt zelf de kop **"fase 1.5"** en beschrijft een
volledig algoritme:

```text
1. bereken per ronde het gemiddelde van de punten van de in die ronde
   speelgerechtigde teamleden;
2. rond dat gemiddelde af;
3. tel de rondegemiddelden op tot de teamscore.
```

Plus eindstand: winnend team, beste individuele speler per team, gelijkspel
toegestaan. Dit is dus geen "of we dit willen"-vraag — het antwoord is al ja,
alleen niet nu. `HostConfig.mode`'s type (`client/flow/host-setup-state.mjs`)
is vandaag letterlijk alleen `'individual'`; er is geen `teamId`-achtig veld
op `Player` in `DATA-MODEL.md`.

**Verzoek:** geen inhoudelijk besluit nodig (dat ligt al vast) — alleen een
bevestiging van **wanneer** fase 1.5 aan de orde komt, en of `client/flow/`/
`DATA-MODEL.md` daar nu alvast een plek voor moet reserveren (bv. een
`teamId: string | null`-veld dat voorlopig altijd `null` is) of dat dit
volledig kan wachten tot die fase start. Beide zijn legitieme antwoorden; het
is een planningsvraag, geen ontwerpvraag.

## Wat ik nodig heb om verder te kunnen

Per punt onafhankelijk:

1. **Tijd-per-ronde:** bevestig het veld (naam, default, range) zodat
   `host-setup.mjs` 'm kan aansturen — kleine, al-inhoudelijk-besloten
   toevoeging.
2. **Teams:** een planningsantwoord (wanneer fase 1.5, wel/niet nu al
   voorbereiden in het datamodel) — geen inhoudelijk besluit, dat staat al in
   `GAME-RULES.md`.

## Regels

- Geen agent breidt `HostConfig`/`SETTABLE_CONFIG_KEYS` stilzwijgend uit
  (`client/flow/` is een andere eigenaar dan thema 1's views) — vandaar dit
  verzoek in plaats van zelf het veld toevoegen.
