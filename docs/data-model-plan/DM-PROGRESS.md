# Voortgang — DATA-MODEL.md realisatie

Dekking van [`docs/multiplayer/DATA-MODEL.md`](../multiplayer/DATA-MODEL.md), per
sectie uit dát document — niet per DM-fase. Zie [`README.md`](README.md) voor het
volledige plan/de fasering en [`HANDOFF.md`](HANDOFF.md) voor cross-plan vragen.

Legenda: ✅ klaar en geverifieerd — 📝 interpretatie/voorstel klaar, nog niet gebouwd
— 🟢 klaar om te bouwen, geen externe blokkade — 🟡 deels — ⬜ nog niet gestart/wacht
echt op iets extern — **n.v.t./buiten scope** met reden uit het brondocument zelf.

| DATA-MODEL.md sectie | DM-fase | Status | Toelichting |
| --- | --- | --- | --- |
| Lagen (overzicht) | — | **n.v.t. als eigen module** | Laag 3 (lokale clientsessie) is bewust buiten scope — clientrepo-terrein |
| Room (`RoomCore`) | DM2b | 🟡 Deels klaar om te bouwen | Alle velden behalve `contentVersion`/`rendererVersion` kunnen nu; die twee wachten op checkpoint 4. **Hernoemd naar `RoomCore`** — `REVIEW-DM2-DM9.md` bevinding 9: een onvolledig type mag niet `Room` heten |
| GameConfiguration | DM2a | 🟢 Klaar om te bouwen | Geen externe blokkade |
| Session | DM2a | 🟢 Klaar om te bouwen | `tokenHash`-vórm is (a); de hashing-implementatie zelf blijft `auth` (checkpoint 10), raakt de typevorm niet |
| Player | DM3 | 📝 Interpretatie klaar | Rematch-resetsemantiek beantwoord — `HANDOFF.md` §3 |
| Match | DM3 | 📝 Interpretatie klaar | `roundIndex → roundNumber`-voorstel — `HANDOFF.md` §2 |
| Round | DM3 | 📝 Interpretatie klaar | `correctAnswer`-vorm per spelvorm bevestigd — `HANDOFF.md` §1; dit ontgrendelde ook `GAME-RULES.md`'s GR3 |
| Answer | DM3 | 🟢 Klaar om te bouwen | Volledig gegeven in `DATA-MODEL.md`, geen open vraag |
| RoomPresentation (optioneel) | DM3 | 🟢 Klaar om te bouwen | Laag geprioriteerd (latere uitbreiding, `PRODUCT.md`), niet geblokkeerd |
| Redis-sleutels | DM1 | ✅ Klaar en geverifieerd | `redis-keys.js`, 65 tests |
| TTL | DM1 | 🟡 Deels | Alleen `ROOM_TTL_SECONDS` (1 test); refreshmatrix/cleanup-cadans bewust apart voorstel, geen datum |
| Actieve-ronde-projectie (`toActiveRoundSnapshot`) | DM3 | 🟢 Klaar om te bouwen | Allowlist-outputcontract is eigen ontwerpwerk, geen externe blokkade |
| Atomische antwoordverwerking | DM7 | 🟢 Klaar zodra DM3+DM6 er zijn | `scoreAnswer()`/validators bestaan al en zijn getest aan `GAME-RULES.md`-kant — geen externe wachttijd meer op dat punt |
| Persistente analytics | DM8 | 🟢 Klaar om te bouwen (als voorstel) | Niet extern geblokkeerd — DM8 ís zelf het traceability-/eventcontractvoorstel |
| Wat niet persistent wordt opgeslagen | DM5 | 🟢 Klaar zodra DM2+DM3 er zijn | Allowlist-per-tabel-ontwerp is eigen werk |
| Privacyduiding | DM5 (deels) | Zie hierboven | Proxy-/applicatielogeisen blijven buiten scope (infra, `prod`) |
| Naamverwerking | DM4 | 🟢 Klaar om te bouwen | Suffixformaat is al gegeven (`GAME-FLOW.md`: "Sanne 2"); overige open keuzes (grapheme-definitie, control-tekenset, case-/accentgevoeligheid) krijgen een gedocumenteerd, laag-risico default i.p.v. wachten; alleen de profanitylijst-bron (checkpoint 11) is een korte, losse vraag |
| Interface naar GAME-RULES.md | DM9 | 🟡 Deels klaar om te bouwen | **Correctie:** reconciliatie tegen `rankPlayers()` in `standings.js` (GR2, 23/23 getest) kan nu — niet tegen GR3 zoals hier eerder stond, dat is de `correctAnswer`-validator (Round), geen Player-consument. `toEligibilityPlayerView`/`toTeamPlayerView` wachten op GR5/GR6, die nog niet bestaan |

## Openstaande actiepunten — alle negen prompts herzien na REVIEW-DM2-DM9.md, wachten op akkoord

- [ ] [`DM2a`](prompts/DM2a-game-configuration-and-session.md) — `GameConfiguration` + `Session` (types + tests)
- [ ] [`DM2b`](prompts/DM2b-room.md) — `Room` minus `contentVersion`/`rendererVersion`, met expliciete
      pending-markering voor die twee velden
- [ ] [`DM3`](prompts/DM3-player-match-round-answer-presentation.md) — `Player`, `Match`, `Round`, `Answer`, `RoomPresentation` +
      `toActiveRoundSnapshot()`
- [ ] [`DM4`](prompts/DM4-name-processing.md) — naamverwerking (vaste stappen + gedocumenteerde defaults)
- [ ] [`DM5`](prompts/DM5-privacy-guard.md) — privacy-guard (allowlist per doeltabel)
- [ ] [`DM6`](prompts/DM6-repository-port.md) — repository-domeinpoort + in-memory fake
- [ ] [`DM7`](prompts/DM7-answer-flow.md) — answer-flow (tegen `GAME-RULES.md`'s `scoreAnswer()`/`validateAnswer()`)
- [ ] [`DM8`](prompts/DM8-analytics-proposal.md) — analytics-traceability + eventcontractvoorstel
- [ ] [`DM9`](prompts/DM9-game-rules-reconciliation.md) — `toStandingPlayerView()` tegen `rankPlayers()` (GR2); GR5/GR6-projecties bewust uitgesteld
- [ ] Checkpoint 4 blijft los openstaan: `contentVersion`/`rendererVersion` —
      cross-plan, niet blokkerend voor de rest van DM2/DM3

## Cijfers

- **DM0–DM1:** uitgevoerd, 66/66 tests groen.
- **DM2a–DM9:** alle negen prompts uitgeschreven, daarna herzien op basis van
  [`prompts/REVIEW-DM2-DM9.md`](prompts/REVIEW-DM2-DM9.md) (3 blockers, 8 hoge
  bevindingen, 3 middelhoge — 14 bevindingen totaal, allemaal verwerkt):
  idempotentie-volgorde en ack-scorelek in DM7 gecorrigeerd, `RoomCore`-naam
  en lokale fase-/pacing-transcriptie in DM2a/DM2b/DM3 (i.p.v. een
  `server/architecture`-import), `loadRoomByInviteId` i.p.v. een
  niet-implementeerbare `loadRoomByInviteHash` in DM6, de action-cache-write
  direct in DM6's atomaire operatie, DM8 teruggebracht tot alleen het
  voorstel (geen `aggregate.js` meer, drie kolommen expliciet geblokkeerd),
  woordenlijsten in DM4 nu injecteerbaar i.p.v. hardgecodeerd, kolomtelling in
  DM5 gecorrigeerd (21, niet 20), en `Round` uitgebreid met
  `validOptionIds`/`resultDetails` na reconciliatie met de herziene
  `GR4-question-selection.md`. Nog geen van de negen fases uitgevoerd — wacht
  op akkoord vóór uitvoering.
- Nieuw: [`HANDOFF.md`](HANDOFF.md) §5 stelt een neutrale gedeelde-
  constantsmodule voor (`PHASES`/`PACING`) aan `architecture-plan`, i.p.v. de
  eerder afgekeurde `server/data → server/architecture`-importrichting.
- Van de resterende 8 fases (DM2–DM9) is er, op 2 velden van `Room` en de
  (b)-ADR-items van de latere adapterlaag na, **niets echt extern geblokkeerd** — de
  eerdere "wacht op"-statussen in `README.md` §3 waren grotendeels zelfopgelegde
  sequentiële voorzichtigheid, geen harde afhankelijkheid van andere agents. Zie
  `README.md` §10 (Versnellingsplan) voor de herziene aanpak.

*Laatst bijgewerkt: na verwerking van alle bevindingen uit `REVIEW-DM2-DM9.md`,
vóór uitvoering.*
