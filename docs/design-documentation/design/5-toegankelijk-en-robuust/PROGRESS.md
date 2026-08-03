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
| Zoom tot 200% | 1 | aangenomen | `maximum-scale` is weg, dus zoomen kán weer. Of de layout het houdt is niet nagekeken. Prompt: [`prompts/T5-1-zoom-200-procent.md`](prompts/T5-1-zoom-200-procent.md). |
| Reduced motion | 2 | gelezen | Sinds `58eba07` een blanket-`@media (prefers-reduced-motion: reduce)`-regel in `base.css`. Dit is thema 3's `M0` (zie diens `prompts/M0-reduced-motion.md`) — hier alleen bevestigd, niet dubbel geclaimd. |

## Responsive

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Compact portrait | 2 | gemeten | 390×844 nagemeten: geen horizontale én geen verticale overflow meer sinds `1004c64` en `eb72578`. |
| Safe areas | 1 | gelezen | Was: "`viewport-fit=cover` staat er, geen `env(safe-area-inset-*)`." Sinds `58eba07` staat `env(safe-area-inset-*)` op `body` (top/left/right) en `.screen` (bottom) — bewust niet op de sticky header zelf, anders klopt `--header-h` weer niet meer (dezelfde valkuil als eerder met de headerhoogte). Blijft op 1, niet 2: gebouwd maar nooit op een écht toestel met inkeping gezien — "aangenomen dat de CSS het juiste doet" is niet hetzelfde als "gemeten". |
| Spelerslijst bij schaal | 1 | gemeten | Getest tot vijf namen. Geen compact grid, geen aggregatie boven 36, geen `Bekijk alle spelers`. |
| Medium / tablet | 0 | — | Geen tweekoloms compositie; alles blijft één kolom van 480px. Bewust geen prompt (zie `prompts/README.md`): dit is compositiewerk dat op `O-002`/`O-003` (thema 2) wacht, geen verificatie- of kleine-fixklus. |
| Large / podium | 0 | — | Geen podiumcompositie, geen spelerswand, geen grote code op kamerafstand. `P4` is niet ingevuld. Zelfde reden als Medium/tablet: geen prompt totdat er iets te bouwen valt. |
| Landscape | 0 | — | Niet getest, geen gedrag vastgelegd. Prompt: [`prompts/T5-2-landscape.md`](prompts/T5-2-landscape.md). |

## Veerkracht

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Idempotente submit | 2 | gelezen | `actionId` per antwoord, hergebruikt bij retry; server autoritatief op de deadline. Dubbele tap kan geen dubbel antwoord maken. |
| Reconnect | 2 | gelezen | Transportlaag doet backoff, statusbalk toont de reden, `reconnect-state` vraagt na herstel een verse snapshot. Geen handmatige `Opnieuw proberen`. |
| Refresh / sessieherstel | 1 | aangenomen | Sessie in `localStorage`, deep link valt terug op de code-invoerflow. Niet geverifieerd of score en ingediend antwoord een refresh midden in een ronde overleven, en of de lokale rondedata (buiten `client/flow` om, zie `session-shell.mjs`) na een refresh überhaupt herstelt. Prompt: [`prompts/T5-3-refresh-sessieherstel.md`](prompts/T5-3-refresh-sessieherstel.md). |
| Roomfouten | 1 | gelezen | Was: "geen bestemming, geen `S21`-scherm." Sinds `58eba07` toont `session-shell.mjs` een terminaal scherm met terugkeeractie zodra een opgeslagen sessie naar een verlopen/verwijderde room wijst (`GAME_NOT_FOUND`/`TOKEN_INVALID`/`TOKEN_EXPIRED`/`SESSION_REVOKED`) — dat ving voorheen stil af tot een permanent lege pagina. Blijft op 1: de knop hergebruikt nog `join.retry`'s tekst ("Opnieuw proberen") voor een actie die niet retryt maar naar start navigeert; de juiste sleutel (`session.backToStart`) staat al in alle drie de locales maar is nog niet ingehangen — één regel, bewust laten staan toen code-werk voor dit rondje werd stopgezet. Ook nog geen eigen kop/titel op dat scherm. |
| Host verliest verbinding | 1 | gelezen | Pauzereden `host_disconnected` bestaat en wordt getoond. Overdracht of nette beëindiging is nog een open besluit. |
| Falende assets | 1 | gemeten | Een ontbrekende vlag geeft een gebroken afbeelding, geen fallback. Lokaal laadt `/flags/*` sowieso niet tegen de game-server — bekend gat. Prompt: [`prompts/T5-4-falende-vlagafbeelding.md`](prompts/T5-4-falende-vlagafbeelding.md) — de enige "gemeten"-rij die nog steeds een fix nodig heeft. |
| Testmatrix | 0 | — | `08` §9 vraagt om iOS Safari, Android, screenreader, reduced motion, 200% zoom en trage verbinding. Geen daarvan gedaan als doorlopend proces. Prompt: [`prompts/T5-6-testmatrix-proces.md`](prompts/T5-6-testmatrix-proces.md) — expliciet als proces, niet als eenmalig vinkje. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal | 4 | 8 | 10 | 0 |

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
ervan). Screenreader en Zoom staan bewust nog op 1 — daar verandert geen
berekening iets aan, alleen een écht toestel. Beide hebben nu een prompt in
plaats van alleen een constatering (`prompts/T5-1`, `prompts/T5-5`), net als
Landscape, Refresh en de Testmatrix zelf.

Eén middag met een echt toestel en VoiceOver verzet hier nog steeds meer dan
een week bouwen — dat is niet veranderd. Wat wel is veranderd: wat zonder
dat toestel te doen was, is nu ook echt gedaan, niet alleen genoteerd.
