# Prompt — 02: S05 — Permanente code/QR in de hostlobby (D-018/D-019)

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Fase 1, hoog
impact/laag-middel complexiteit (`10-IMPLEMENTATION-ROADMAP.md` §8).

## Brondocument

[`../../00-DESIGN-INDEX.md`](../../00-DESIGN-INDEX.md) `D-018`/`D-019`,
[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md) S05
("Altijd zichtbaar: QR; code; join-URL...").

## Uitgangspositie: dit is voor 90% al gebouwd

`frontend/js/views/room-header.mjs` bestaat al, compleet: permanente
codeweergave, een QR-pictogramknop die een modale overlay opent
(`role="dialog"`, `aria-modal`, Escape, focusbeheer — zelfde discipline als
`app-menu.mjs`), `setJoinUrl()` om de URL later bij te werken zodra die
binnenkomt, en `destroy()`. Het enige wat ontbreekt is: **CSS** (er staat nog
niets voor `.room-header`/`.room-qr-*` in `base.css`) en **het inhangen**.

Dit is dus geen nieuw scherm bouwen — het is een bestaande module aansluiten
en stylen. Deze prompt lost daarmee ook
[`UI-10`](../../../../frontend-plan/HANDOFF-UI.md) op ("`room-header.mjs` is
dode code — `D-018` daardoor nog niet zichtbaar") — vink dat item af in
`HANDOFF-UI.md` zodra het inhangen klaar is.

## Wat moet gebeuren

1. **CSS toevoegen** in `frontend/css/base.css` voor `.room-header` (code +
   QR-knop, compacte balk), `.room-header-code-value` (`tabular-nums`,
   letterspacing — het is een getal dat wordt voorgelezen), `.room-qr-overlay`/
   `.room-qr-card`/`.room-qr-image` (zelfde schermvullende overlay-stijl als
   `lobby.mjs`'s bestaande QR-overlay, hergebruik die tokens).
2. **Mountpunt regelen in `#app-header`.** Nu mount alleen `app-menu.mjs`
   (hamburger) daar, permanent voor élk scherm. `room-header.mjs` moet er
   NAAST staan, maar alleen zolang er een lopende sessie is (game/host-route
   met sessie) — niet op `/` of `/j/*`. Voorstel: `app.mjs` geeft
   `session-shell.mjs` een los subelement binnen `#app-header` mee (of
   `session-shell.mjs` krijgt de headerroot zelf door en mount zijn eigen
   kindnode erin, net zoals het nu `hostBarRoot` binnen `root` doet). Leg de
   gekozen aanpak vast in de code-comment, niet stilzwijgend kiezen.
3. **`session-shell.mjs` mount/update/destroy `room-header.mjs`**: bij een
   nieuw `room:state`-event `setJoinUrl(joinUrl)` aanroepen (dezelfde
   `joinUrl`-variabele die er al is voor de lobby); bij `destroy()` (van de
   session-shell zelf) ook `roomHeader.destroy()` aanroepen.
4. **`lobby.mjs` opschonen.** De QR/code/link-acties zitten straks op twee
   plekken (de `Delen`-rij van de lobby én de permanente header). Beslis:
   blijft de eigen `show-qr`/`show-code` van de lobby bestaan als extra
   ingang, of vervalt
   die omdat de header 'm al permanent aanbiedt? `D-018` vraagt om permanent
   zichtbaar, niet om een dubbele ingang — een keuze hier voorkomt dat je punt
   1 uit prompt 01 (dubbele weergave) er een derde bij krijgt.
5. **Lege state in de lobby** (nog niet in `room-header.mjs` zelf, hoort bij
   de lobbycompositie): `0 spelers` + `Laat iemand de QR scannen om te
   beginnen` (`04` S05), en de startknop `sticky` maken op mobiel.

## Regels

- `D-019`: code/QR blijven zichtbaar voor **iedereen**, host én speler, ook
  in een vergrendelde room. Vergrendelen blokkeert alleen het joinen zelf.
- Geen hostspecifieke variant van de code/QR/link.
- Geen `innerHTML` — `room-header.mjs` volgt dat al, blijf dat aanhouden in
  wat je eromheen bouwt.

## Definition of done

- Op `/host/{code}` én `/game/{code}`: de code staat permanent in de
  appheader, blijft zichtbaar tijdens elke fase (lobby, gameplay, scoreboard,
  podium, pauze), en verdwijnt pas als de sessie eindigt.
- QR-knop opent de modal, Escape sluit 'm, focus keert terug — al gebouwd,
  alleen verifiëren dat het na het inhangen nog steeds klopt.
- Vergrendelen van de room verandert niets aan de zichtbaarheid van code/QR.
- Lobby: lege staat toont de voorgeschreven tekst, startknop is sticky.
- Geen dubbele QR/code-ingang tenzij je bewust koos om de eigen deelrij van
  de lobby te laten staan — leg die keuze uit in de commitmessage.
- `../PROGRESS.md` bijgewerkt: S05 kan pas naar niveau 2 als alle drie de
  eerder genoemde ontbrekende criteria (permanent, lege staat, sticky) samen
  gehaald zijn — niet los aanvinken.
