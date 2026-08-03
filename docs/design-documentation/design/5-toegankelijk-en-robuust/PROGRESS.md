# Voortgang — 5. Toegankelijk en robuust

**Eigenaar:** _nog toe te wijzen_
**Documenten:** `07-RESPONSIVE-HOST-PLAYER-MODES.md`, `08-ACCESSIBILITY-AND-RESILIENCE.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties K, L en M · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53`

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
| Contrast | 2 | gelezen | Tekst haalt AA in beide thema's; disabled is sinds `d3c900e` geen `opacity: .5` meer. Niet met een contrasttool doorgemeten. |
| Touch targets | 2 | gelezen | Minimaal 44px op elke knop, met onderlinge ruimte. Destructieve actie los van primary. |
| Taal en helderheid | 2 | gelezen | Korte zinnen, één instructie per staat, foutmeldingen benoemen de oplossing. |
| Screenreader | 1 | aangenomen | `aria-live`, `aria-expanded`/`-pressed` en `textContent` staan er, maar er heeft **nooit een screenreader gedraaid**. Ontbreekt sowieso: schermtitel bij fasewissel, antwoordgroeplabel, `twee plaatsen gestegen`. |
| Zoom tot 200% | 1 | aangenomen | `maximum-scale` is weg, dus zoomen kán weer. Of de layout het houdt is niet nagekeken. |
| Reduced motion | 0 | — | Nergens gerespecteerd. Nu laag risico omdat er weinig beweegt, maar dit hoort er te staan vóór het motion-werk, niet erna. |

## Responsive

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Compact portrait | 2 | gemeten | 390×844 nagemeten: geen horizontale én geen verticale overflow meer sinds `1004c64` en `eb72578`. |
| Safe areas | 1 | gelezen | `viewport-fit=cover` staat er; geen `env(safe-area-inset-*)` in de layout. |
| Spelerslijst bij schaal | 1 | gemeten | Getest tot vijf namen. Geen compact grid, geen aggregatie boven 36, geen `Bekijk alle spelers`. |
| Medium / tablet | 0 | — | Geen tweekoloms compositie; alles blijft één kolom van 480px. |
| Large / podium | 0 | — | Geen podiumcompositie, geen spelerswand, geen grote code op kamerafstand. `P4` is niet ingevuld. |
| Landscape | 0 | — | Niet getest, geen gedrag vastgelegd. |

## Veerkracht

| Onderdeel | Niveau | Bewijs | Toelichting |
|---|---|---|---|
| Idempotente submit | 2 | gelezen | `actionId` per antwoord, hergebruikt bij retry; server autoritatief op de deadline. Dubbele tap kan geen dubbel antwoord maken. |
| Reconnect | 2 | gelezen | Transportlaag doet backoff, statusbalk toont de reden, `reconnect-state` vraagt na herstel een verse snapshot. Geen handmatige `Opnieuw proberen`. |
| Refresh / sessieherstel | 1 | aangenomen | Sessie in `localStorage`, deep link valt terug op de code-invoerflow. Niet geverifieerd of score en ingediend antwoord een refresh midden in een ronde overleven. |
| Roomfouten | 1 | gelezen | Alle codes hebben tekst, maar geen bestemming: er is geen `S21`-scherm dat ze toont met een terugkeeractie. |
| Host verliest verbinding | 1 | gelezen | Pauzereden `host_disconnected` bestaat en wordt getoond. Overdracht of nette beëindiging is nog een open besluit. |
| Falende assets | 1 | gemeten | Een ontbrekende vlag geeft een gebroken afbeelding, geen fallback. Lokaal laadt `/flags/*` sowieso niet tegen de game-server — bekend gat. |
| Testmatrix | 0 | — | `08` §9 vraagt om iOS Safari, Android, screenreader, reduced motion, 200% zoom en trage verbinding. Geen daarvan gedaan. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal | 5 | 8 | 9 | 0 |

## De conclusie die uit de bewijskolom volgt

Op papier is dit ons sterkste gebied — de audit noemt onze toegankelijkheid
"boven genre-niveau", en negen onderdelen staan op 2. Maar tel de bewijskolom:
**drie keer gemeten, acht keer gelezen, drie keer aangenomen.**

Alles is gecontroleerd in headless Chromium op één viewport. Geen echte
telefoon, geen echte screenreader, geen trage verbinding. De 2'en op
`Screenreader` en `Zoom` zijn daarom bewust 1: we weten niet of ze kloppen.

Eén middag met een echt toestel en VoiceOver verzet hier meer dan een week
bouwen.
