# DATA-MODEL.md — Welke state en data bestaan?

## Lagen

1. **Actieve roomstate** — tijdelijk in Redis.
2. **Persistente productstatistieken** — geaggregeerd in PostgreSQL of in de pilot SQLite.
3. **Lokale clientsessie** — uitsluitend de tijdelijke bearer token en minimale
   herstelgegevens in browserstorage.

Er bestaat in de MVP geen account- of spelerprofieldatabase.

## Room

```json
{
  "id": "room_01J...",
  "code": "482917",
  "inviteId": "N4x7pQm2K8tW",
  "phase": "LOBBY",
  "createdAt": 1785620000000,
  "lastActivityAt": 1785623412000,
  "hostSessionIds": ["sess_01J..."],
  "locked": false,
  "config": {},
  "currentMatchId": null,
  "contentVersion": "2026.08.1",
  "rendererVersion": "flag-renderer-1"
}
```

`inviteId` is een publieke, tijdelijke roomcapability: iedere deelnemer mag hem via de
join-link en QR delen. Hij staat daarom in tijdelijke Room-state. De lookupindex gebruikt
bij voorkeur een hash, zodat Redis-keynamen de capability niet rechtstreeks tonen.

`Room.phase` is een gedupliceerde, snel leesbare projectie van de actuele matchfase. De
autoritatieve fase voor een lopende game staat in `Match.phase`; updates gebeuren atomair.

## GameConfiguration

```json
{
  "preset": "group_battle",
  "gameTypes": [
    "flags_mc",
    "capitals_mc",
    "real_or_fake_flag",
    "higher_lower",
    "odd_one_out"
  ],
  "language": "nl",
  "difficulty": "normal",
  "totalRounds": 10,
  "questionSeconds": 15,
  "resultSeconds": 5,
  "scoreboardSeconds": 4,
  "scoreboardFrequency": "every_round",
  "pacing": "auto",
  "speedBonus": true,
  "deadlineGraceMs": 150,
  "mode": "individual",
  "teamNames": [],
  "metricMode": "mixed",
  "maxPlayers": 100,
  "allowLateJoin": true
}
```

Enums worden in implementatie en protocolschema gedeeld; vrije strings zijn niet
toegestaan.

### `gameTypes` bevat exact één waarde

Het voorbeeld hierboven toont het VELDTYPE (een lijst — de vorm waar mixed
games ooit in passen), niet een geldige roomconfiguratie. Sinds 5 aug 2026
(besluit 32, PLAN-CONVERGENTIE §A1) geldt:

- een room-configuratie bevat **exact één** gameType;
- die waarde moet **speelbaar** zijn volgens `shared/content/game-catalog.mjs`
  — dat is een ketenuitspraak (vraagselectie, contentbron, spelscherm,
  uitslagscherm én mock kunnen hem aan), geen wens;
- afgedwongen in `resolveGameConfiguration()`, de trechter waar zowel
  `createRoom()` als `game:update-config` langskomt, plus in de
  protocolvalidatie van `game:update-config`.

`Match.gameType` (enkelvoud) is de gepinde waarde voor een lopende match en
verandert niet meer als de room-config daarna wijzigt.

### Wijzigbaar ná creatie

Alleen `totalRounds`, `difficulty`, `language`, `pacing`, `speedBonus`,
`allowLateJoin` en `gameTypes` — via `game:update-config`, alleen in `LOBBY`,
alleen door de host. `questionSeconds` en `hostParticipates` zijn bewust
create-only. De volledige regels staan in `PROTOCOL.md` §`game:update-config`.

## Session

Een sessie is een tijdelijke autorisatiecontext, geen account.

```json
{
  "id": "sess_01J...",
  "roomId": "room_01J...",
  "roles": ["host", "player"],
  "playerId": "p_8f42d1",
  "tokenHash": "sha256:...",
  "createdAt": 1785620000000,
  "lastSeenAt": 1785623412000,
  "connectedSocketIds": ["socket_..."],
  "revoked": false
}
```

- `playerId` is `null` voor een host die niet meespeelt.
- één sessie mag meerdere sockets hebben tijdens een korte reconnectoverlap;
- na stabilisatie blijft de nieuwste socket leidend;
- token vervalt met room-TTL of expliciete intrekking.

## Player

```json
{
  "id": "p_8f42d1",
  "roomId": "room_01J...",
  "sessionId": "sess_01J...",
  "displayName": null,
  "generatedName": "Vlugge Vos",
  "effectiveName": "Vlugge Vos",
  "nameSource": "generated",
  "teamId": null,
  "score": 4200,
  "correctCount": 12,
  "correctResponseTimeMsTotal": 56420,
  "connected": true,
  "eligibleFromRound": 1,
  "joinedAt": 1785620100000,
  "left": false,
  "kicked": false
}
```

`effectiveName` is altijd gevuld. `displayName` kan `null` zijn.

## Match

Een rematch maakt een nieuwe match binnen dezelfde room.

```json
{
  "id": "match_01J...",
  "roomId": "room_01J...",
  "sequence": 2,
  "phase": "ROUND_ACTIVE",
  "startedAt": 1785623000000,
  "finishedAt": null,
  "roundIndex": 6,
  "roundIds": ["round_01", "round_02"],
  "usedQuestionKeys": ["flags:jp"],
  "previousMatchQuestionKeys": ["flags:br"],
  "pausedState": null
}
```

Pauzestatus:

```json
{
  "previousPhase": "ROUND_ACTIVE",
  "remainingMs": 7200,
  "reason": "host",
  "pausedAt": 1785623412000
}
```

## Round

```json
{
  "id": "round_07",
  "matchId": "match_01J...",
  "gameType": "real_or_fake_flag",
  "questionKey": "rof:fx_91b2",
  "publicQuestionPayload": {},
  "correctAnswer": { "choice": "fake" },
  "startsAt": 1785623412000,
  "endsAt": 1785623427000,
  "status": "ACTIVE"
}
```

`correctAnswer` staat alleen in Redis/servermemory en komt niet in actieve
client-snapshots.

## Answer

```json
{
  "roundId": "round_07",
  "playerId": "p_8f42d1",
  "actionId": "act_01J...",
  "answer": { "choice": "fake" },
  "receivedAt": 1785623418451,
  "responseTimeMs": 6451,
  "correct": true,
  "points": 158
}
```

## Optionele RoomPresentation

Alleen wanneer de latere groepsvlag/badge wordt gebouwd:

```json
{
  "roomId": "room_01J...",
  "groupName": "Team Nachtdieren",
  "badgeSpec": {},
  "badgeAssetUrl": null
}
```

Dit object:

- is niet nodig voor roomcreatie of gameflow;
- heeft dezelfde TTL als de room;
- wordt niet persistent opgeslagen in de MVP;
- mag ontbreken zonder fallbackfout.

## Redis-sleutels

```text
rooms:active                              → set roomId
room:code:{code}                          → roomId
room:invite:{inviteHash}                  → roomId

room:{roomId}                             → hash/JSON Room
room:{roomId}:sessions                    → hash sessionId → Session
room:{roomId}:players                     → hash playerId → Player
room:{roomId}:match:{matchId}             → hash/JSON Match
room:{roomId}:match:{matchId}:round:{id}  → hash/JSON Round
room:{roomId}:match:{matchId}:answers:{id}→ hash playerId → Answer
room:{roomId}:match:{matchId}:scoreboard  → sorted set score → playerId (zie noot)
room:{roomId}:revoked-sessions            → set sessionId
room:{roomId}:action-cache                → hash actionId → ack/result
```

**Noot bij de scoreboard-sorted-set (5 aug 2026, PLAN-CONVERGENTIE §A3):** deze
index blijft de snelle score-lookup, maar bepaalt géén rangnummers meer. De
positie in `scoreboard:updated`, in de snapshot én in `game:finished` komt uit
`shared/rules/ranking.mjs` over de volledige spelerslijst — één rangschikker,
zodat een gelijke stand overal hetzelfde nummer krijgt en spelers zonder score
niet uit de tussenstand verdwijnen.

## TTL

- standaard room-TTL: 14.400 seconden na laatste activiteit;
- TTL wordt via pipeline ververst op roomkern, indexes en relevante matchkeys;
- afgeronde room blijft maximaal vier uur beschikbaar voor rematch/rejoin;
- verlopen room wordt uit `rooms:active` en lookupindexes verwijderd;
- periodieke cleanup herstelt achtergebleven indexes.

## Atomische antwoordverwerking

Eén Lua-script of transactionele operatie:

1. valideert sessie en speler;
2. valideert match en ronde;
3. controleert deadline;
4. controleert actionId/idempotentie;
5. controleert reeds bestaand antwoord;
6. berekent correctheid en punten;
7. schrijft Answer;
8. werkt Player bij;
9. werkt sorted scoreboard bij;
10. bewaart ack voor korte idempotency-TTL.

Er mag geen half verwerkte score bestaan.

## Persistente analytics

Alle writes zijn asynchroon en geaggregeerd.

```sql
game_sessions(
  id uuid primary key,
  room_id_hash text not null,
  match_sequence integer not null,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  language text not null,
  difficulty text not null,
  pacing text not null,
  mode text not null,
  game_types text[] not null,
  total_rounds integer not null,
  max_player_count integer not null,
  late_join_count integer not null,
  joins_via_qr integer not null,
  joins_via_link integer not null,
  joins_via_code integer not null,
  share_qr_open_count integer not null,
  share_link_open_count integer not null,
  finished_normally boolean not null,
  rematch_of uuid null
);

round_stats(
  id uuid primary key,
  game_session_id uuid not null,
  round_number integer not null,
  game_type text not null,
  question_key text not null,
  answer_count integer not null,
  correct_count integer not null,
  average_answer_ms integer,
  no_answer_count integer not null
);

daily_metrics(
  date date primary key,
  rooms_created integer not null,
  games_started integer not null,
  games_finished integer not null,
  players_joined integer not null,
  rematches integer not null,
  median_players_per_game numeric,
  median_join_to_start_seconds numeric
);
```

`room_id_hash` is een willekeurige analyticsidentifier en mag niet terug te rekenen zijn
naar code of inviteId.

## Wat niet persistent wordt opgeslagen

- zelfgekozen of gegenereerde namen;
- sessietokens of tokenhashes;
- individuele scores en antwoordhistorie;
- IP-adressen;
- user-agentstrings;
- koppelingen tussen rooms van dezelfde persoon;
- permanente speler-ID's;
- groepsvlag of badge in de MVP.

## Privacyduiding

Het systeem is privacy-minimaal, niet persoonsgegevensvrij.

- Een zelfgekozen displaynaam kan een echte naam en dus tijdelijk een persoonsgegeven zijn.
- IP-adressen zijn technisch zichtbaar tijdens netwerkverkeer en kunnen in
  infrastructuurlogs terechtkomen.
- Daarom worden namen alleen tijdelijk in Redis gehouden.
- Proxy- en applicatielogs bevatten geen namen of tokens.
- IP-logging wordt uitgezet, gemaskeerd of zeer kort bewaard.
- Analytics bevat alleen aggregaten.

## Naamverwerking

1. trim;
2. Unicode NFKC-normalisatie;
3. control characters verwijderen;
4. maximaal 20 zichtbare tekens;
5. eenvoudige profanitycheck per taal;
6. uniek maken binnen room;
7. uitsluitend als tekst renderen.

Voor automatisch gegenereerde namen:

- vaste, gecontroleerde lijsten per taal;
- combinatie van adjectief + dier of `Speler {n}`;
- nooit beledigend;
- suffix bij botsing.
