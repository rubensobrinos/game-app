# Prompt — M11: Besluitverzoek `E16` — overlay/dialoog-transities toevoegen aan `06`

Onderdeel van [`README.md`](README.md). **Geen bouwtaak — een
besluitverzoek**, geschreven zoals `docs/handoff-principles.md` §4 het
voorschrijft: een concreet voorstel, het besluit blijft bij de
producteigenaar. Dit item bestond tot nu toe alleen als voorstel binnen
`PROGRESS.md`, zonder dat de bevestiging waar `M3` op wacht ooit ergens is
gevraagd — dat is hierbij rechtgezet (`REVIEW.md`'s bevinding).

## Wat ontbreekt

`06-MOTION-SOUND-AND-FEEDBACK.md` beschrijft vijftien momenten (`E01`–`E15`),
geen enkele daarvan is een dialoog/overlay-transitie. Drie bestaande
dialogen — hamburgermenu, QR-overlay, pauze-overlay — wisselen vandaag puur
via `hidden`/`display:none`: geen fade, geen scale, niets. Dat is geen
editorial keuze maar een reëel gat: precies de plekken waar `06` §2's regel
("feedback op input start vrijwel onmiddellijk") al door focusbeheer wordt
gedekt, maar niet door motion.

## Concreet voorstel

Een zestiende event toevoegen aan `06` §4:

| # | Moment | Fase | Wat vuurt |
|---|---|---|---|
| E16 | Overlay/dialoog open-dicht | overal | Fade/scale bij openen (`--motion-base`/`--ease-enter`), fade bij sluiten (`--motion-fast`), reduced motion: instant tonen/verbergen zoals nu. |

En één gedeelde implementatie-eis: een dialoog-lifecycle-helper (open →
is-opening → open → is-closing → hidden, met `inert`/`pointer-events:none`
tijdens het sluiten, een fallback-timer voor `transitionend`, en correcte
focus-timing) — niet drie losse fade-implementaties in hamburgermenu.mjs,
qr-overlay en pauze-overlay apart. Volledige technische uitwerking staat al
klaar in [`M3-e16-dialoog-transities.md`](M3-e16-dialoog-transities.md),
inclusief de open/sluit-randgevallen (heropenen tijdens het sluiten,
cleanup bij unmount).

## Wat het besluit raakt

- **Wijzigt een goedgekeurd brondocument.** `06` is niet mijn document om
  zelf uit te breiden — `00-DESIGN-INDEX.md`'s autoriteitshiërarchie is
  daar expliciet over: een agent lost geen open PO-besluiten stilzwijgend
  op en bewerkt geen autoritatieve specs zonder akkoord.
- **Nieuw gedeeld mechanisme.** De dialoog-lifecycle-helper zou de eerste
  gedeelde overlay-abstractie in deze codebase worden — vergelijkbaar met
  hoe `UI-14`'s `BroadcastChannel` het eerste cross-tab-mechanisme was en
  daarom apart is voorgelegd.
- **Raakt drie bestaande, werkende dialogen.** Geen van de drie is kapot —
  dit voegt motion toe aan iets dat functioneel al goed werkt, dus de vraag
  is prioriteit/scope, niet een bugfix.

## Wat ik nodig heb om verder te kunnen

1. **Bevestigd, bouw het** — dan pak ik `M3` op zoals die er al ligt, met
   de gedeelde lifecycle-helper als uitgangspunt.
2. **Anders, met een richting** — bv. alleen fade zonder scale, een andere
   duur, of de drie dialogen toch apart laten i.p.v. één gedeelde helper.
3. **Nog niet, bewust** — dan blijft `E16` een vastgelegd voorstel in
   `PROGRESS.md`, met dit bestand als vindplaats voor wanneer het wel aan
   de orde komt. `M3` blijft dan expliciet geparkeerd, niet zoek.

## Regels

- Geen eigen aanname over de exacte duur/easing doorvoeren zonder bevestiging
  — dit voorstel is een startpunt, geen besluit.
- `06` zelf blijft ongewijzigd totdat dit bevestigd is.
