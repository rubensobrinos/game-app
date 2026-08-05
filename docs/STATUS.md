# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 3 aug 2026 (nacht) · commit `389edab`_

## Stand 3 aug ± 16:00 (115 commits vandaag)

### Live op play.aseso.nl
Werkende multiplayer-keten (create/join/QR/rondes/pauze), Rounda-naam,
menu = één voordeur. Visueel: bouwplaats — herontwerp loopt (drie
designrichtingen liggen bij de producteigenaar).

### Wacht op producteigenaar (de enige echte wachtrij)
1. Keuze designrichting (3 nieuwe varianten onderweg; eisen 5-9 vastgelegd)
2. M11 — besluitverzoek dialoog-transities (thema 3)
3. UI-11 — lettertype- en kleurbesluit
4. UI-20 — arbitrage: T2-9 vs T5-7 claimen beide het voorkeurenpaneel
5. UI-21 — productvraag grote QR-kaart vs room-header (D-018)
6. Rebuild-moment afspreken (alleen op gecommitte, gelande stand)
7. ~~± 280 ongepushte commits~~ — 5 aug: nog **2** commits vóór `origin/main`
   + 10 ongecommitte bestanden (protocol/socket/frontend). Git-locks zijn weg.

### Spelregel toegevoegd (NIVEAUS.md, regel 0)
Een component telt pas als af wanneer een scherm hem gebruikt — antwoord op
drie "gebouwd maar niet aangesloten"-gevallen vandaag.

### Bekende dubbelingen (eigenaar: thema 2/3 na UI-20-arbitrage)
Timer + rangpijltjes bestaan dubbel (module én handgebouwd in schermen);
handoff-item met drie concrete gebreken ligt klaar.

## Nacht van 2→3 aug: wat er gebeurde

1. **Blanco `/samen`** → oorzaak: `frontend/locales/nl.mjs` met host-rechten
   600 het image in gekopieerd → `EACCES`/500 voor user `node` → hele
   ESM-graaf dood. Fix: `chmod -R a+rX` in `server/Dockerfile` (structureel).
2. **"Er ging iets mis" op Snel starten** → live ingekaderd door regie
   (statisch ✅, API ✅, Redis-lezen ✅, tokencode lokaal ✅ → Redis-sessiepad
   verdacht) en door DT onafhankelijk exact benoemd als **INT-18**: de
   versioned tokenhash `v1:<hex>` bevat `:`, de segmentvalidator van
   `redis-keys.js` verbood dat → `saveSession` wierp bij élke roomaanmaak.
3. **INT-18 opgelost** (`389edab`): `assertFinalHashSegment` staat `:` toe in
   het laatste sleutelsegment; fixtures nu uit de échte `hashToken`
   (DT's vacuümverificatie-les). Resolutie gedocumenteerd in
   `docs/integration-plan/HANDOFF.md` §INT-18.

## Actuele testuitslag

_Gemeten 5 aug 2026:_ `npm test` **2900 groen · 0 rood · 0 skip**, 174 suites,
11,5 s (sandbox, zonder live Redis). Kanttekening bij dat cijfer: het bewijst
het bestaande systeem, niet het nieuwe UI-werk — zie PLAN-CONVERGENTIE §A5.
(Historisch: 2515 op 3 aug; DT met Redis 2727 vóór de INT-18-fix.)

## Tegencontrole-2 (regie, 3 aug ± 07:00) — UITSLAG

**Eerste échte match gespeeld op productie**: 3 spelers (host-mobiel,
speler-mobiel, regie via invite-link), 10 rondes gestart, antwoorden,
pauze/hervat — de kernbelofte van besluit #35 is live bewezen.

| Check | Uitslag |
| --- | --- |
| `26473c9` eerste-snapshot-fix | ✅ live — host ziet lobby direct na Snel starten |
| `eb72578` UX-pass lobby | ✅ live (rebuild nam werkboom mee) |
| Mockmodus `?mock=1` | ✅ live geverifieerd: create → lobby → Ronde 1/5 → antwoord, **nul** `/api/`-verkeer; zonder `?mock` gewoon echte server |
| Kernbelofte end-to-end | ✅ create, join via code én invite-link, rondes, pauze/hervat |
| UX-kwaliteit | niet beoordeeld — staat al in FEEDBACK-eerste-livetest.md (4 punten) |

**Kanttekening hygiëne:** de rebuild kopieert de wérkboom, dus er draait code
live die nog niet gecommit is (mockmodus, branding, acceptance-criteria-
update). Commit door regie klaargezet maar geblokkeerd op `.git/index.lock`/
`HEAD.lock` die alleen de producteigenaar kan verwijderen:
`cd ~/game-app && rm -f .git/index.lock .git/HEAD.lock` → regie commit dan direct.

## Open launchblockers (volgorde = prioriteit)

0. **NIEUW 5 aug — "Echt of nep" is selecteerbaar maar onspeelbaar.** De
   lobbycarrousel zet `real_or_fake_flag` op speelbaar (`lobby.mjs:157`), het
   protocol accepteert het, maar `FILLED_GAME_TYPES` in `content-source.mjs:63`
   staat nog op `['flags_mc']` en `buildQuestion` (`match-lifecycle.mjs:804`)
   heeft geen catch → de room blijft in COUNTDOWN hangen. Mag niet mee de
   deploy in. Zie PLAN-CONVERGENTIE §A0 + besluit C-0.
1. ~~Git-locks weg~~ (5 aug: weg) + **commit + push werkboom** — regie
2. **Livegang-sein**: `SHOW_MULTIPLAYER=true` in `public-mode.js` +
   force-recreate frontend (kaart "🎉 Samen spelen" zichtbaar) — wanneer
   producteigenaar de UX goed genoeg vindt
3. Feedbacklijst livetest (namen in lijst, code permanent, pauze-host,
   menu-layering) — elk een los mandaat, zie FEEDBACK-eerste-livetest.md
4. DT's keten-race onder Redis (matrixrij 13, ~1 op 7 flaky) — fixen vóór CI — DT/INT-A
5. **Herstelpad ontbreekt** (ARCHITECTURE.md §10 ongeïmplementeerd) —
   voorstel: accepted risk t/m pilots → **besluit producteigenaar**

## Scherm 5 gebouwd (regie, 3 aug avond — besluit 40)

Reveal + tussenstand zijn één scherm: `scoreboard.mjs` toont nu bovenaan de
lime antwoordkaart (goede antwoord groot, "N van M zaten goed") + het eigen
resultaat (+punten), daaronder de bestaande top 5 + eigen rij, onderaan de
"volgende vraag"-voet (auto) of host-hint (host-pacing). Data uit
`round-model.mjs`'s result via session-shell; 7 nieuwe i18n-sleutels (3/3
talen, pariteit groen); CSS in `rounda-1c.css` (regie-laag); cachebust
`?v=1c8`; smoke-tests in `scoreboard.test.mjs`. Frontend-suite 178 groen.
**Fixronde na mock-review (zelfde avond):** ROUND_RESULT routeert nu óók
naar scherm 5 (beat 1 = reveal, beat 2 = tussenstand zodra
`scoreboard:updated` landt) — dubbele reveal weg, scherm krijgt 5+4s i.p.v.
4s; alle headline-typen meeverhuisd naar scherm 5. Verder: lobby-rolfout
("Wachten tot de host start" bij de host) weg, startknop-label/sub
gescheiden, kick-knop compact, home-copy naar doelbeeld v2-tagline (3
talen), codebalk + hostpillen compact tijdens spel/uitslag (:has, D-018
blijft gerespecteerd). Cachebust `?v=1c9`; suite 263 groen.
**Ronde 3 (zelfde avond): scherm 3 + achtergrond + JS-cache.**
Gast landt nu direct in de lobby (auto-join met servervoorstel, naamstap
weg uit join.mjs); in de gastlobby het JIJ-blok "Zo heet je vanavond" met
"Typ zelf" (via bestaand `player:rename`, max 1×, alleen LOBBY) en IK BEN
KLAAR (puur client-side, besluit 40B) → wachtpil. Home kreeg de lime-gloed
uit mockup 1 (donker thema). Game-server stuurt nu `Cache-Control:
no-cache` + Last-Modified/304 op statics — spelers draaien na een deploy
nooit meer minutenlang oude `.mjs`-modules (vandaag live gezien). Cachebust
`?v=1c10`; 498 tests groen (frontend+client/flow+server-index).
**Ronde 4: Rounda-Flag ("Wave Run") is de lobbygame.** Door de product-
eigenaar aangeleverd als standalone HTML, door regie verbatim geport naar
`views/rounda-flag.mjs` (spellogica/tuning onaangeroerd; alleen verpakking:
view-patroon met destroy(), merkkleuren 1c, reduced-motion = stilstaand tot
start, toetsen kapen nooit een invoerveld, record in localStorage
ongewijzigd). Lobby mount 'm nu; het rad (rounda.mjs) blijft voor de kleine
wachtmomenten (reconnect/pauze). 3 nieuwe i18n-sleutels ×3 talen. Cachebust
`?v=1c11`; suite 263 groen.
**Nog niet gedeployed** — volgende docker-rebuild neemt alles mee.

## Ronde 5 (4 aug): serverwerk + scherm 2 + kleurkiezer (regie, solo)

Server: `player:rename` uitgevoerd (compositie + socket, LOBBY-only, 1×,
volle naamnormalisatie), `player:recolor` (8-kleurenpalet, kleur bij join
round-robin, snapshot draagt self.color), `game:update-config` (host,
LOBBY-only, subset → `room:config-changed` broadcast), join-delta draagt
naam+kleur (lege-gastnaam-bug weg). Mock volledig in pariteit.
Client: JIJ-blok nu voor iedereen mét spelersrol (ook meespelende host),
kleurkiezer (8 stippen), chips kleuren op serverkleur, en scherm 2: de
host-instellingen ÍN de lobby (in/uitklapbaar) — gamekaart, Kiezen actief
(Mix/Typen zichtbaar-uitgeschakeld, 40D), niveau Easy/Medium/Hard, vragen
5/10/15, toggle automatisch-volgende (pacing) — alles op game:update-config,
serverstand is de waarheid. 17 nieuwe i18n-sleutels ×3. Cachebust `?v=1c20`.
Suites: 795 server + 498 client groen.

## Ronde 6 (4 aug): feedbackronde 2 — 14 punten

"Spel aanpassen" weg van home (instellingen = lobby); QR-glyph nu echt
QR-achtig (5×5); DEEL als woordknop; per-speler ⋯-menu i.p.v. kale
verwijderknop (lobby én hostbar-paneel); carrousel met de 4 wereldgames
(3 × BINNENKORT); GAME-label weg; toggle-dubbeldik gefixt (base-button-
padding); "Antwoord automatisch tonen" zichtbaar-uit (40C blijft ticket);
"Meer instellingen" met vragen/vraagtaal/snelheidsbonus/late-join;
vergrendelen volledig uit de UI; scherm 5-voet is nu een échte aflopende
balk op scoreboardSeconds uit de serverconfig. Cachebust `?v=1c21`;
498 client-tests groen. Ticket nieuw: host wijzigt naam/kleur van ánderen
(serverwerk). 

## Convergentie solo ↔ samen (5 aug, analyse)

Twee apps naast elkaar (solo = `app.js`/`style.css`, samen = `frontend/`):
aparte data, i18n, CSS en renderers. De multiplayer-motor kan **vijf** games
(`question-selection.js`, pool gevuld, `generateFlagSpec` bestaat) maar toont
er één — `FILLED_GAME_TYPES` in `server/composition/content-source.mjs:63`
staat op `['flags_mc']`. `docs/PLAN-CONVERGENTIE.md` bevat nu ook de
**stabilisatieronde** die hieraan voorafgaat: A0 (zie launchblocker 0), A1
`gameTypes` accepteert meerdere spellen terwijl alleen `[0]` telt, A2 de
"geen tweede countdown"-fix is dode code (`runtime.round` is bij elke
COUNTDOWN al leeg), A3 ties komen goed van de server maar worden in
`standings-model.mjs:18` weggegooid voor `index + 1`, A4 vier publieke events
ontbreken in PROTOCOL.md, A5 nieuw UI-werk is ongetest.

## Wachtend op producteigenaar

- C-0/C-1/C-2/C-3 uit PLAN-CONVERGENTIE.md (A0-aanpak, richting, portfolio, recovery)
- `rm -f .git/index.lock .git/HEAD.lock` (blocker 1)
- Sein per feedbackpunt + volgorde (blocker 3)
- Besluit herstelpad-als-accepted-risk (blocker 5)
- Productvraag typed answers: meer punten voor intypen dan meerkeuze?

## Rustende domeinen

GR · PD · PR (slotlichting door regie afgerond, `bb07aa9`) · DM · DT
(afgemeld na chaos-3/INTB-8, `94eee08`/`ab3e834`/`743b921`/`91af744`) ·
INT-A (afgemeld, `bc6e7bd`) — heropstart begint bij het eigen
PROGRESS-bestand.
