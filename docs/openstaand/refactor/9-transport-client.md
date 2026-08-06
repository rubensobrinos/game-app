# 9 — `frontend/js/transport.mjs` opsplitsen (978 regels)

**Geen gedragsverandering.**

## Waarom

Dit is de echte verbinding met de server: REST voor het aanmaken en joinen, de
websocket voor alles daarna, plus de foutafhandeling en de precedentiepoort die
bepaalt of een snapshot of een event wint. Elke protocolwijziging komt hier
langs, en dat is precies de reden dat er maar één agent tegelijk in kan.

Zijn tegenhanger `transport-mock.mjs` (1625 regels) wordt apart aangepakt; die
blijft hier buiten beschouwing.

## Wat je opsplitst

Het bestand heeft zijn eigen kopjes al en die zijn de naad:

| Nieuw bestand | Inhoud |
| --- | --- |
| `transport/protocol.mjs` | `PROTOCOL_VERSION`, `TRANSPORT_ERROR_CODES`, `ProtocolError` |
| `transport/verbinding.mjs` | `createTransport` en `connect` — de socket, herverbinden, de handshake |
| `transport/precedentie.mjs` | `createSnapshotPrecedenceGate` met `registerSnapshot`, `registerEvent`, `inspect` |
| `transport/helpers.mjs` | `normalizeBaseUrl`, `safeJsonParse`, `readHandshakeErrorCode` |

De exports blijven exact gelijk, ook voor wie ze uit `transport.mjs`
importeert.

## Drie regels die in dit bestand vastliggen

Ze staan er als kopjes in en het zijn geen stijlkeuzes:

1. **Eén foutpad.** Alles wat misgaat komt als `ProtocolError` naar buiten,
   met een code uit `TRANSPORT_ERROR_CODES`. Niet twee soorten fouten laten
   ontstaan door ze over bestanden te verdelen.
2. **Geen socket.io-client als dependency.** Deze code praat zelf het
   protocol. Verleid je niet tot "even een bibliotheek".
3. **Het sessietoken gaat nooit in een URL.** Niet in een querystring, niet in
   een pad. Dat is een beveiligingseis, geen voorkeur.

**De precedentiepoort is subtiel.** Hij bepaalt of een binnengekomen snapshot
of een los event de waarheid is — bij een herverbinding komen die door elkaar
binnen. Verplaats hem letterlijk en raak de volgorde niet aan.

## Hoe je oplevert

`npm test` groen, plus in een browser: een potje spelen tegen de échte server
(niet `?mock=1`), midden in een ronde het netwerk kort onderbreken, en zien dat
de verbinding herstelt met de juiste stand.

## Niet doen

- `transport-mock.mjs` aanraken.
- Foutcodes toevoegen, hernoemen of samenvoegen.
- De herverbindlogica "vereenvoudigen".

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/9-transport-client.md` en voer dat uit: `frontend/js/transport.mjs` opsplitsen langs zijn eigen kopjes, zonder gedragsverandering. De exports blijven exact gelijk. In het document staan drie regels die in dit bestand vastliggen — één foutpad, geen socket.io-client, en het sessietoken nooit in een URL — plus de precedentiepoort die je letterlijk moet verplaatsen. Controleer naast `npm test` in een browser dat een potje tegen de échte server (dus zonder `?mock=1`) een korte netwerkonderbreking overleeft. Blijf uit `frontend/js/transport-mock.mjs`, `frontend/js/session-shell.mjs` en `server/`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee — die komt van ander lopend werk. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
