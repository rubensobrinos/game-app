# Prompt — M4: Mute-mechanisme (zonder geluid eronder)

Onderdeel van [`README.md`](README.md), fase M4. Vereist niets — onafhankelijk
van `M0`–`M3` en van `O-008`.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §5 (Beheer): "iedere speler heeft lokale
mute; mute is altijd bereikbaar zonder actieve vraag te blokkeren; voorkeur
blijft lokaal bewaard." `08-ACCESSIBILITY-AND-RESILIENCE.md` §2.5: "lokale
mute; geen status alleen auditief." `11-DESIGN-QA-CHECKLIST.md` K: "Is
geluid uitschakelbaar en niet essentieel?"

## Waarom dit los van geluid zelf kan

`O-008` (wie bestuurt geluid: host, speler, of beide) staat open, en er
bestaan nog geen geluidsassets. Maar de **schakelaar en de voorkeur** hangen
daar niet van af — een speler moet mute altijd kunnen zetten, ook vóórdat er
iets te muten valt. Dit is exact hetzelfde patroon als de bestaande taal-/
themaknop (`app-menu.mjs`, `preferences.mjs`): een UI-control + een
`localStorage`-voorkeur, niets meer.

## Wat dit is

1. **`preferences.mjs` uitbreiden**: `loadMuted(storage)`/`saveMuted(storage,
   muted)`, zelfde vorm als `loadTheme`/`saveTheme` (valideren, falen stil bij
   een gooiende storage, geen default-aanname anders dan `false`).
2. **Een schakelaar in `app-menu.mjs`**, als derde sectie naast Taal en
   Thema (`role="group"`, `aria-labelledby`, `aria-pressed` — zelfde
   discipline als de bestaande twee secties). Geen apart paneel: dit is
   dezelfde plek waar een speler al zijn taal/thema regelt, en `06` §5 eist
   toegankelijkheid "zonder actieve vraag te blokkeren" — het bestaande menu
   is al overal bereikbaar, dus geen nieuwe locatie nodig.
3. **Geen geluidslogica.** Dit bouwt een schakelaar die een boolean bewaart
   en toont — er is nu niets om daadwerkelijk te muten. Toekomstig
   geluidswerk (`M4`-vervolg zodra `O-008` besloten is) leest deze voorkeur,
   bouwt 'm niet opnieuw.

## Regels

- Geen `<audio>`-element, geen mixer, geen categorieën hier — dat is
  expliciet `06` §5/§6's latere laag, geblokkeerd op `O-008`.
- Volg exact het bestaande taal-/thema-patroon (`setLang`/`setTheme`'s
  vorm) — geen nieuw state-management ernaast verzinnen.

## Definition of done

- Schakelaar zichtbaar in het hamburgermenu, met `aria-pressed` dat
  meewisselt, net als taal/thema.
- Voorkeur overleeft een paginareload (`localStorage`), getest zoals
  `preferences.test.mjs` de andere twee test.
- `PROGRESS.md`: "Mute-mechanisme" van niveau 0 naar 1 (schakelaar bestaat,
  niets om te muten) — niveau 2 pas zodra er daadwerkelijk geluid is dat de
  schakelaar iets laat doen.
