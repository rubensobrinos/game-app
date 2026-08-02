# Changelog

Belangrijke wijzigingen aan de multiplayerapp worden hier per datum en domein
samengevat. De gitgeschiedenis blijft de bron voor de volledige diff; dit bestand
is het leesbare overzicht.

## [Unreleased]

### Protocol

- PR13 moet de afzonderlijke fake-transport-contractsuite nog uitbreiden met de
  nieuwe preview-, snapshot-, renderer- en pepperrotatiecontracten.

### Integratie en opslag

- De Redis-adapter ondersteunt twintig van de drieëntwintig repositorymethoden;
  de resterende poort-/indexvragen staan in de INT-B-handoff.

## [2026-08-02]

### Frontend en gameflow

- Een dependencyvrije multiplayerfrontend onder `frontend/` toegevoegd, met
  route-/viewswitching, tijdsync, i18n, transportcontract en geteste mocktransport.
- Clientflow uitgebreid voor preview-join, bevestigde pauzeredenen en één
  hostactie per ronde.
- UI- en integratiehandoffs toegevoegd voor de echte transportlaag en verdere
  schermbouw.

### Protocol en beveiliging

- `PROTOCOL.md` gelijkgetrokken met de bevestigde multiplayerbesluiten.
- Invite-only pre-join-previewvorm en validator toegevoegd.
- Snapshotvalidatie uitgebreid met `eligibleFromRound`, `matchSequence` en
  volledige `pausedState`.
- Vraagpayloads voor alle vijf MVP-spelvormen als discriminated vormen gevalideerd.
- `share:opened.method` uitgebreid met `code`.
- Sessietokenhashes versieerbaar gemaakt en constant-time `verifyToken()` toegevoegd
  voor veilige pepperrotatie.

### Spelregels en content

- Scoring, standings, antwoordvalidators, eligibility, antwoordverdeling en
  deterministische vraagselectie geïmplementeerd.
- Gedeelde, versieerbare contentmodule onder `shared/content/` toegevoegd.
- Deterministische Echt-of-Nep-vlaggeneratie met echte-vlag-wering toegevoegd.
- Het content-poolcontract tussen rules, content en integratie expliciet vastgelegd.

### Architectuur, data en compositie

- Fase-state-machine, roomcodes, snapshotprecedentie en servertijdhelpers gebouwd.
- Room-, sessie- en matchlevenscyclus als compositielaag toegevoegd.
- Datamodelmodules, in-memory repository en atomaire opslagcontracten uitgevoerd.
- Room-locators, rounds, answers en scoreboards room-scoped gemaakt.
- Antwoord-idempotentie en one-answer-per-round in de atomaire schrijfpoort geborgd.

### Testen en infrastructuur

- Contract-, integratie-, load- en chaos-teststructuur opgezet.
- Node 22 `node:test`-CI geactiveerd via het nieuwe centrale
  `node-esm-app`-devkitprofiel, zonder TypeScript/Jest/Expo.
- Fase-1-container- en tunnelconfiguratie voorbereid; productieactivatie blijft een
  afzonderlijk goedkeuringspunt.

### Besluiten en scope

- Teams, spectators, Groepsbattle en mixed-version-ondersteuning buiten de huidige
  MVP gehouden.
- Quick start bevestigd als individuele Vlaggenquiz met tien rondes, normale
  moeilijkheid, auto-tempo, snelheidsbonus en late join.
- Centrale besluitregistratie, planvoortgang en cross-plan-handoffs bijgewerkt.
