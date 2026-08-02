# Antwoord op UI-1 en UI-3 — transportcontract bevestigd, met correcties

**Van:** INT-A (stap 2: transportlaag). **Aan:** UI.
**Betreft:** [`docs/frontend-plan/HANDOFF-UI.md`](../frontend-plan/HANDOFF-UI.md).

## UI-1 — antwoord 2: grotendeels akkoord, vier correcties

De vorm klopt. Eén functie per `PROTOCOL.md`-eindpunt, `Error` met `.code` zodat
`messageForErrorCode` er direct op kan, en `connect` die een `send`/`close`-paar
teruggeeft: zo ga ik het aanbieden. De swap mock → echt blijft één import.

Vier dingen kloppen niet of ontbreken. Pas ze aan vóór UI3; dan is de rest een
directe swap.

### Correctie 1 — `createGame` krijgt meer dan alleen `config`

`POST /api/v1/games` neemt volgens `PROTOCOL.md` een request met drie velden:

```json
{ "config": { "preset": "…", "language": "nl" }, "hostParticipates": true, "displayName": null }
```

`hostParticipates` is geen configveld maar een aparte keuze (`PRODUCT.md`: een
host hoeft niet mee te spelen), en `displayName` hoort er alleen bij als hij dat
wél doet. Maak de signatuur daarom symmetrisch met `joinGame`:

```js
createGame: (request: object) => Promise<object>
```

### Correctie 2 — `connect` moet de verbindingsstatus melden

Dit is het belangrijkste gat. `connect` geeft nu alleen `send` en `close` terug,
maar `client/flow/reconnect-state.mjs` bestaat al en moet gevoed worden: hij
verwacht te horen wanneer de verbinding wegvalt, wanneer een poging loopt en
wanneer hij terug is. Zonder dat kan de UI geen reconnectstatus tonen en weet ze
niet wanneer ze een snapshot moet opvragen.

```js
connect: (sessionToken: string, handlers: {
  onEvent: (envelope: object) => void,
  onStatus: (status: 'connecting' | 'connected' | 'disconnected') => void,
}) => { send, close }
```

De transportlaag doet de backoff zelf (1, 2, 4, 8, 16, max 30 s, conform
`PROTOCOL.md` §Reconnect) en meldt alleen de status. Ná een herverbinding vraagt
de UI zelf een snapshot op via `fetchState` — snapshot boven events, dus de UI
beslist wanneer, niet het transport.

### Correctie 3 — `send` verwerpt bij `ok: false`

`PROTOCOL.md` beschrijft de ack als `{ actionId, ok, serverTime, payload }`, dus
`ok: false` is formeel een normale respons en geen transportfout. Ik laat `send`
tóch **rejecten** met dezelfde `Error`+`.code`-vorm als de REST-functies. Reden:
anders moet elk aanroeppunt in de UI twee foutpaden kennen — een exception én een
`ok`-veld — en dat gaat een keer mis. Eén foutmechanisme voor de hele interface.

### Correctie 4 — `actionId` blijft van de UI, en dat is load-bearing

Bevestigd: de UI genereert de `actionId`. Belangrijk om expliciet te maken, want
er hangt gedrag aan: bij een retry ná een weggevallen ack moet de UI **dezelfde**
`actionId` hergebruiken (`PROTOCOL.md` §Reconnect stap 7). Genereert ze een
nieuwe, dan krijgt de speler `ALREADY_ANSWERED` in plaats van zijn oorspronkelijke
ack.

Let hierbij op [`HANDOFF.md`](HANDOFF.md) **INT-14**: op dit moment krijgt zo'n
retry ná de deadline `DEADLINE_PASSED` in plaats van de gecachete ack. Dat is een
openstaand poortprobleem, niet iets wat de UI moet opvangen. Bouw geen omweg; het
wordt opgelost bij de poort.

### Twee dingen waar ik nog geen garantie op geef

- **`previewInvite`'s responsvorm ligt nog niet vast.** Mijn compositie geeft een
  rijker object terug dan `PR10-preview-endpoint.md` voorstelt; dat verschil staat
  open als INT-8 bij PR. De functie zelf en het `inviteId`-only argument staan wel
  vast — alleen de velden in de respons kunnen nog schuiven.
- **`preset`-waarde.** `PROTOCOL.md` zegt nog `"group_battle"`, jouw
  `host-setup-state.mjs` gebruikt `'default'`, mijn compositie `'quick_start'`.
  Dat is INT-11, ligt bij PR. Verwacht hier één wijziging.

## UI-3 — route 1, en ik regel het in stap 2

Ik kies **de twee extra statische mappings**, en het is mijn beslissing als
eigenaar van de servingconfiguratie:

```
/client/*  → client/
/shared/*  → shared/
```

Waarom niet de kopieer-/symlinkstap: die voegt een stap aan het releaseproces toe
die stilletjes kan worden overgeslagen, en dan werkt productie anders dan lokaal.
Twee regels proxyconfiguratie hebben dat probleem niet, en het past bij de
routingtabel die `ARCHITECTURE.md` al hanteert.

Praktisch: in stap 2 serveert mijn Fastify-entrypoint deze paden rechtstreeks, zodat
`npm start` werkt zonder proxy. De bijbehorende regels in `caddy/Caddyfile` en
`nginx/default.conf` horen bij de verpakking en dus bij INT-B; ik geef het aan hen
door.

**Je kunt nu `<base href="/">` in `index.html` zetten.** Met absolute paden
(`/client/flow/…`, `/shared/…`, `/css/…`) werken deep links als `/j/{inviteId}` en
`/game/{code}` correct, en dat was precies het tweede deel van je vraag.

## Wat dit voor jou betekent

UI kan door. Pas `transport-mock.mjs` aan op correctie 1 tot en met 3 — dat zijn
een signatuurwijziging, een extra `handlers`-argument en een foutafspraak, geen
herontwerp. Correctie 4 vraagt geen code, alleen dat de retry-regel wordt
gerespecteerd.

Ik meld het hier zodra `transport.mjs` echt bestaat en de swap kan.
