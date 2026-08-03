# Voortgang — 5. Toegankelijk en robuust

**Eigenaar:** UI-agent (toegewezen 3 augustus 2026, ná thema 1–4)
**Documenten:** `07-RESPONSIVE-HOST-PLAYER-MODES.md`, `08-ACCESSIBILITY-AND-RESILIENCE.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties K, L en M · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Prompts:** [`prompts/`](prompts/) — de resterende aangenomen/niet-geteste rijen zijn nu concrete, uitvoerbare tickets, niet alleen een constatering.
**Bijgewerkt:** 3 augustus 2026 · commit `58eba07`

Bij dit gebied telt niet alleen *of* iets werkt, maar **waarop dat gebaseerd
is**. Een claim die nooit is nagemeten is geen 2. Daarom heeft elke regel een
bewijskolom — en die kolom legt meteen het grootste gat van dit gebied bloot.

Bewijsniveaus: **gemeten** (in een browser nagemeten) · **gelezen** (uit de code
afgeleid) · **aangenomen** (niet geverifieerd).

## Toegankelijkheid

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Toetsenbord | 2 | gemeten | Alles bereikbaar, logische volgorde, Enter/Space werkt. Escape sluit menu, QR- en pauze-overlay, met focusherstel naar de trigger. |
| Focus-visible | 2 | gemeten | Sinds `1004c64` overal een zichtbare ring, in `--text` en niet in het accent — dat betekent al "geselecteerd". Contrasteert op beide thema's. |
| Kleur niet als enige drager | 2 | gelezen | Correct/onjuist krijgt altijd tekst naast kleur; geen status leunt alleen op kleur. |
| Contrast | 2 | **gemeten** | Was "2, gelezen" — dat bleek de fout. Echte WCAG-berekening (relatieve luminantie, geen schatting; script in `58eba07`) toonde dat het **lichte thema** op vier tokens onder AA zakte zodra ze als tekst dienen: accent-light 3,61:1, error 3,43:1, success 2,08:1, gold 1,96:1 (eis: 4,5:1) — inclusief `.gameplay-own.is-correct`/`.is-wrong`, de "Goed!"/"Helaas, fout"-tekst. Donkerdere lichte-thema-varianten toegevoegd voor alle vier, incl. een aangepaste `--accent-glow` (de originele 25%-tint kwam op licht nooit boven 3,9:1 uit, ongeacht de tekstkleur). Donker thema was al in orde. **De methodologische les staat in de conclusie hieronder.** |
| Touch targets | 2 | gelezen | Minimaal 44px op elke knop, met onderlinge ruimte. Destructieve actie los van primary. |
| Taal en helderheid | 2 | gelezen | Korte zinnen, één instructie per staat, foutmeldingen benoemen de oplossing. |
| Screenreader | 1 | aangenomen | `aria-live`, `aria-expanded`/`-pressed` en `textContent` staan er, maar er heeft **nooit een screenreader gedraaid**. Ontbreekt sowieso: schermtitel bij fasewissel, antwoordgroeplabel, `twee plaatsen gestegen`. Testplan: [`prompts/T5-5-screenreader-testplan.md`](prompts/T5-5-screenreader-testplan.md) — niet zelf uit te voeren zonder toestel. |
| Zoom tot 200% | 2 | **gemeten** | Acht schermen gemeten (2× paginazoom + 2× tekstvergroting, ad-hoc Playwright tegen de échte server). Eén bug gevonden en gefixt: `.lobby-player`'s naam-span had geen `min-width`, waardoor een lange naam + de verwijderknop de pagina horizontaal lieten overflowen. Na de fix: geen enkel scherm overflowt nog. Zie [`prompts/T5-1-zoom-200-procent.md`](prompts/T5-1-zoom-200-procent.md). |
| Reduced motion | 2 | gelezen | Sinds `58eba07` een blanket-`@media (prefers-reduced-motion: reduce)`-regel in `base.css`. Dit is thema 3's `M0` (zie diens `prompts/M0-reduced-motion.md`) — hier alleen bevestigd, niet dubbel geclaimd. |

## Responsive

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Compact portrait | 2 | gemeten | 390×844 nagemeten: geen horizontale én geen verticale overflow meer sinds `1004c64` en `eb72578`. |
| Safe areas | 1 | gelezen | Was: "`viewport-fit=cover` staat er, geen `env(safe-area-inset-*)`." Sinds `58eba07` staat `env(safe-area-inset-*)` op `body` (top/left/right) en `.screen` (bottom) — bewust niet op de sticky header zelf, anders klopt `--header-h` weer niet meer (dezelfde valkuil als eerder met de headerhoogte). Blijft op 1, niet 2: gebouwd maar nooit op een écht toestel met inkeping gezien — "aangenomen dat de CSS het juiste doet" is niet hetzelfde als "gemeten". |
| Spelerslijst bij schaal | 2 | **gemeten** | Was: getest tot vijf namen, geen compact grid, geen aggregatie, geen `Bekijk alle spelers`. Nu gebouwd: `participantPresentationFor()` (pure functie, `rows`/`grid`/`aggregate`) stuurt `lobby.mjs`'s weergave; 9–35 toont een compact CSS-grid, 36+ toont de laatste 5 joins + totaal met een "Bekijk alle spelers"-knop voor de rest. `room:player-changed` gebatcht (eerste wijziging in een rustig venster meteen, de rest binnen 500ms gecoalesceerd tot één trailing render — 2 renders voor 5 gelijktijdige joins, niet 5). Geverifieerd tegen de échte server met 0/5/15/30/50/100 spelers (100+ apart unit-bewezen, de mock-limiet is productgedrag, niet opgerekt). Zie [`prompts/T5-9-spelerslijst-bij-schaal.md`](prompts/T5-9-spelerslijst-bij-schaal.md). |
| Medium / tablet | 2 | **gemeten** | Was: geen tweekoloms compositie, alles één kolom van 480px. **Correctie destijds:** eerder hier gemeld als geblokkeerd op `O-002`/`O-003` (thema 2) — dat klopte niet, dit is een layoutvraag. Nu gebouwd: lobby toont vanaf 768px de spelerslijst naast de deelsectie (CSS grid-areas, geen DOM-herordening), tussenstand centreert breder (600px) vanaf dezelfde breedte, en het hamburgermenu wordt vanaf 768px een permanent zichtbaar paneel i.p.v. een zwevende dropdown. `#app-root` verruimt alleen voor deze twee schermen (`.app-root-wide`), niet globaal. Geverifieerd op 390/768/1024px, geen regressie op compact portrait. Zie [`prompts/T5-7-medium-tablet-compositie.md`](prompts/T5-7-medium-tablet-compositie.md). |
| Large / podium | 0 | — | Geen podiumcompositie, geen spelerswand, geen grote code op kamerafstand. **Correctie:** eerder hier "Fase 3/4" genoemd — `10` §8 zet "podium" expliciet op Fase 2, en `P4` (`02` design principles) is een principe, geen open besluit. Prompt: [`prompts/T5-8-large-podium-compositie.md`](prompts/T5-8-large-podium-compositie.md), scoped wat nú kan (lobby-als-podium, grote code/QR, bredere leaderboard) van wat op iets anders wacht (`O-010`, thema 1/4's headline-engine, thema 2/3's podiumassets). **Nog niet afgestemd:** of de roadmap-rij "podium/Fase 2" over déze desktop/tv-compositie gaat of over thema 1's `S20` (mobiele podiumscherm-afwerking, ook niveau 0/1) — mogelijk allebei. Niet zelf ingevuld, staat als open vraag in de prompt. Nog niet gebouwd. |
| Landscape | 2 | **gemeten** | Drie landscape-breedtes (844×390, 926×428, 1024×600): geen horizontale overflow. Rotatie tijdens een actieve vraag (portrait→landscape, geen reload): geselecteerde optie en resterende tijd blijven ongewijzigd (`07` §10's harde eis). Geen bugs gevonden. Zie [`prompts/T5-2-landscape.md`](prompts/T5-2-landscape.md). |

## Veerkracht

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Idempotente submit | 2 | gelezen | `actionId` per antwoord, hergebruikt bij retry; server autoritatief op de deadline. Dubbele tap kan geen dubbel antwoord maken. |
| Reconnect | 2 | gelezen | Transportlaag doet backoff, statusbalk toont de reden, `reconnect-state` vraagt na herstel een verse snapshot. Geen handmatige `Opnieuw proberen`. |
| Refresh / sessieherstel | 2 | **gemeten** | Vier scenario's gemeten tegen de échte server (ad-hoc Playwright): `LOBBY`/`ROUND_ACTIVE`/`PAUSED` herstellen correct. **Bug gevonden en gefixt:** ná refresh tijdens `FINISHED` verdween de eindstand volledig — `session-shell.mjs`'s `applyRoomState` las `payload.scoreboard` nooit uit de snapshot (zelfde soort gat als thema 4's `roundModel`-fix). Nu opgelost. Bewuste, niet-fixbare beperking: welke optie was gekozen is ná een reload niet meer zichtbaar (server geeft alleen "geantwoord", niet "welke optie"). Zie [`prompts/T5-3-refresh-sessieherstel.md`](prompts/T5-3-refresh-sessieherstel.md). |
| Roomfouten | 2 | gelezen | Was: "geen bestemming, geen `S21`-scherm." Sinds `58eba07` toont `session-shell.mjs` een terminaal scherm met terugkeeractie zodra een opgeslagen sessie naar een verlopen/verwijderde room wijst (`GAME_NOT_FOUND`/`TOKEN_INVALID`/`TOKEN_EXPIRED`/`SESSION_REVOKED`). Naar 2: de knop gebruikt nu `session.backToStart` i.p.v. het hergebruikte `join.retry`, en het scherm heeft een eigen kop (`session.terminatedTitle`, nieuw in alle drie de locales) — beide de twee openstaande punten uit de vorige versie van deze rij, nu opgelost. `node --test`: 440/440 groen, geen regressie. |
| Host verliest verbinding | recovery: 2, gemeten · timeout/uitslagbehoud: ⏸ · VIP: ⏸ | gemeten (geen timeout) | Recovery (pauze + reconnect) werkt al. **Gemeten, niet aangenomen:** er bestaat géén server-side timeout ná `host_disconnected` (`match-lifecycle.mjs`/`state-machine.js` noemen het alleen in commentaar) — een hostloze room blijft onbepaald gepauzeerd. Timeout/uitslagbehoud staat op ⏸, niet 0: er is niets client-zijdig te bouwen zonder het server-event dat `HANDOFF-UI.md` UI-18 bij INT-A/PR uitstaan heeft — dat is de blokkade. VIP-overdracht staat op ⏸ om dezelfde reden: expliciet open PO-besluit, geen client-aanname mogelijk zolang dat er niet is. Zie [`prompts/T5-10-host-verliest-verbinding.md`](prompts/T5-10-host-verliest-verbinding.md). |
| Falende assets | 2 | **gemeten + gefixt** | Was: gebroken afbeelding, geen fallback. Nu: `gameplay.mjs` toont bij een falende vlag een fallback met de bestaande `alt`-tekst zichtbaar (geen landnaam), bevestigd met Playwright's `page.route()` (404-simulatie) tegen de échte server, in beide thema's. Zie [`prompts/T5-4-falende-vlagafbeelding.md`](prompts/T5-4-falende-vlagafbeelding.md). |
| Testmatrix | 1 | gemengd | `08` §9 vraagt om iOS Safari, Android, screenreader, reduced motion, 200% zoom en trage verbinding, als **proces**, niet een eenmalig vinkje (`NIVEAUS.md`'s eigen regel 3: één cijfer verbergt waar we sterk/zwak staan, vandaar hier al twee lagen i.p.v. één getal). Naar 1: Laag 1's contrastcontrole bestaat nu écht als draaibaar onderdeel (`frontend/css/contrast.test.mjs`, meedraait in `npm test`) — geen losstaand scriptje meer zoals bij `58eba07`, en meteen bij de eerste run **twee echte AA-fouten gevonden en gefixt** in het donkere thema: `--color-danger` als tekst (het "✕"-icoon op een fout antwoord, `.gameplay-option.is-wrong::after`, 4,30:1 op `--color-surface-2`) en `--color-accent-primary-hover` als tekst (`.scoreboard-score`/`.podium-score`, 4,49:1 op `--color-surface-1`) — beide minimaal opgehelderd, alle drie achtergronden nu ≥4,5:1 in beide thema's, `node --test` blijft groen. Laag 1's Playwright-sweep blijft wachten op het `deps`-besluit. Laag 2 (mens + toestel) heeft nu een concreet moment: **vóór de eerstvolgende Fase-afsluiting** (`10` §11's release gates eisen sowieso een accessibility-check per fase, geen losse actie). Niet naar 2: Laag 2 is nog niet uitgevoerd, alleen gepland. Prompt: [`prompts/T5-6-testmatrix-proces.md`](prompts/T5-6-testmatrix-proces.md). |

## Telling

| Niveau | 0 | 1 | 2 | 3 | ⏸ |
|---|---|---|---|---|---|
| Aantal | 1 | 3 | 18 | 0 | 2 |

("Host verliest verbinding" telt hier als drie losse rijen — recovery (2),
timeout/uitslagbehoud (⏸) en VIP-overdracht (⏸) — sinds die rij is
opgesplitst; vandaar 24 rijen totaal i.p.v. de eerdere 22. Timeout/
uitslagbehoud en VIP stonden hier eerder als 0, maar dat verbergt het enige
dat ertoe doet: niemand kan hieraan werken vóór INT-A/PR resp. de PO een
besluit levert — `NIVEAUS.md`'s eigen regel voor ⏸. Medium/tablet,
Large/podium en Testmatrix blijven bewust wél op 0: die hebben een
uitvoerbare prompt en wachten nergens op.)

## De conclusie die uit de bewijskolom volgt

Op papier was dit ons sterkste gebied — de audit noemt onze toegankelijkheid
"boven genre-niveau". Maar de bewijskolom heeft één claim daadwerkelijk
tegengesproken: **Contrast stond op "2, gelezen", en was voor het lichte
thema in werkelijkheid geen 2** — vier tokens zakten tot 1,96:1 onder de
4,5:1-eis zodra ze als tekst dienden, inclusief de "Goed!"/"Helaas,
fout"-uitslagtekst. Dat is precies de valkuil die deze pas moest opsporen:
een niveau dat nooit is nagerekend, is een aanname met een cijfer erop, geen
2. Nu wél echt berekend (relatieve luminantie, geen contrasttool nodig — een
kleurwaarde is objectief) en gefixt.

Wat overblijft is eerlijker dan voorheen, niet per se minder: **zes keer
gemeten, negen keer gelezen, drie keer aangenomen** (was 3/8/3 — de winst zit
vooral in het corrigeren van de contrast-rij, niet alleen in het optellen
ervan). Screenreader staat bewust nog op 1 — daar verandert geen berekening
iets aan, alleen een écht toestel (`prompts/T5-5`).

**Tweede ronde (10 prompts, T5-1 t/m T5-10) uitgevoerd — inclusief de twee
compositieprompts die eerst nog "los, groter werk" heetten.** De acht die aan
Playwright hingen, hingen aan een dependency die niet bestaat — dat is
opgelost door de metingen ad-hoc uit te voeren (tijdelijke Playwright-
install, geen projectwijziging) en het resultaat hier vast te leggen in
plaats van op het `deps`-besluit te wachten. Zes daadwerkelijk gebouwd/gemeten
en naar niveau 2 gebracht: **Zoom** (één overflow-bug gevonden en gefixt,
`.lobby-player`), **Landscape** (geen bugs), **Refresh/sessieherstel** (één
bug gevonden en gefixt: de eindstand overleefde een refresh niet — zelfde
soort snapshot-gat als thema 4's `roundModel`-fix), **Falende assets**
(fallback gebouwd en bevestigd), **Spelerslijst bij schaal**
(`participantPresentationFor()` + compact grid + aggregatie + batching,
gemeten tot 100 spelers) en **Medium/tablet** (lobby, tussenstand en
hamburgermenu krijgen alle drie een tabletvariant, `#app-root` verruimt
alleen daar). **Host verliest verbinding** gesplitst in drie eerlijke
deelniveaus i.p.v. één cijfer dat ze verborg — de kernvraag (bestaat er een
timeout?) is beantwoord met "nee", vastgelegd als `HANDOFF-UI.md` UI-18.
**Large/podium** blijft bewust ongebouwd: die prompt zegt zelf expliciet dat
afstemming met thema 1's `S20` eerst moet gebeuren vóór dit ticket start —
dat is geen technische blokkade die ik zelf kan wegnemen.

Eén middag met een echt toestel en VoiceOver verzet hier nog steeds meer dan
een week bouwen — dat is niet veranderd. Wat wel is veranderd: wat zonder
dat toestel te doen was, is nu ook echt gedaan, niet alleen genoteerd — en
twee van die metingen (Refresh, Zoom) legden allebei een écht gebouwde bug
bloot die zonder meten onopgemerkt was gebleven.
