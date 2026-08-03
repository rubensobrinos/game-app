# Prompt — M10: E14, Podium (niveau 1 → richting 2)

**✅ Gedaan — commit `148a132`.** Entrance-animatie, confetti en een
programmatische reduced-motion-gate (nieuw ontdekt gat: de stagger-keten
liep door ongeacht de systeemvoorkeur) toegevoegd bovenop thema 1's
al bestaande stagger/skip-mechanisme.

**Herschreven 3 aug 2026 — de oorspronkelijke versie overlapte fors met
werk dat thema 1 er intussen bij bouwde.** Terwijl deze prompt nog klaarlag,
bouwde thema 1 (`b547c8f`, prompt 08 — S20) zelf al de 3→2→1-
reveal-volgorde (`revealNext()`, `PODIUM_STEP_DELAY_MS = 1400`) én de
klik-om-te-skippen-interactie (`steps.onclick`) in `podium.mjs` — met het
expliciete commentaar "geen motion-tokens (thema 3 levert die pas) — een
vaste vertraging... geen eigen animatiesysteem vooruitlopend op dat werk."
Ook de winnaar-accent (`.podium-step-1 { border-color:
var(--color-accent-competition) }`) staat al, statisch, in `components.css`.

**Wat dit betekent:** de stagger-logica, de skip-interactie en de
winnaar-kleur zijn al klaar. Dit is dus geen nieuwe bouw van die dingen,
maar het **toevoegen van motion bovenop hun bestaande reveal-mechanisme**
(instant `hidden`-toggle → een échte entrance-animatie), plus confetti, plus
een reduced-motion-check die er nog niet is: `revealNext()`'s timers lopen
vandaag door ongeacht `prefers-reduced-motion`, wat `06` §7's "podium direct
compleet" onder reduced motion schendt.

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M9`, gebruikt
thema 2's tokens — `--motion-stage`/`--ease-stage` (`06` §3: "podium: stage
easing, niet cartoonesk stuiterend").

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E14 en `11-DESIGN-QA-CHECKLIST.md` H.
Vier van de zes H-vragen zijn al voldaan (niet dit werk): "Zijn 1, 2, 3
helder?" (bestaande styling), "Ziet een niet-podiumspeler zijn eigen
eindpositie?" (`selfLine`), "Is `Revanche` primair?" (bestaande
`.podium-rematch`-styling), "Kan de finale snel overgeslagen worden?"
(`steps.onclick`, al gebouwd door thema 1). Twee resteren: "Is confetti
beperkt en reduced-motionvriendelijk?" (niets gebouwd) en de motion zelf
(instant toggle, geen entrance).

## Wat dit is (het restant)

1. **Echte entrance-animatie i.p.v. instant `hidden`-toggle.** `.podium-step
   [hidden] { display: none }` bestaat al (nodig, niet aanraken) — een
   CSS-`transition` kan niet animeren over een `display:none`-grens, dus
   gebruik een `@keyframes`-animatie (`opacity`/`transform`) die start zodra
   `hidden` weggaat, via een class die `podium.mjs`'s `revealNext()`
   tegelijk met `item.hidden = false` toevoegt. Duur/easing:
   `--motion-stage`/`--ease-stage`.
2. **Skip blijft instant, niet "alles tegelijk animeren".** De bestaande
   `steps.onclick`-handler zet alle overige stappen synchroon zichtbaar —
   laat die **zonder** de entrance-class doen (`hidden = false` zonder de
   animatieklasse), zodat skippen echt "direct volledig" is, niet een
   burst van gelijktijdige animaties.
3. **Reduced motion — nieuw gat, niet eerder gedekt.** `revealNext()`'s
   `setTimeout`-keten (1400ms per stap) loopt vandaag door ongeacht
   `prefers-reduced-motion`. Check
   `window.matchMedia('(prefers-reduced-motion: reduce)').matches` aan het
   begin van `update()`: zo ja, roep direct hetzelfde "toon alles nu"-pad
   aan als de skip-klik gebruikt (geen timers, geen animatieklasse) i.p.v.
   de staggerketen te starten.
4. **Confetti, bewust minimaal.** Een klein, vast aantal DOM-elementen
   (12–20), CSS-only (`transform`/`opacity`, geen canvas/library), vaste
   korte duur (~1.5–2 s), geen lus, `aria-hidden="true"`. Alleen ná de
   laatste stap (winnaar) verschenen, niet bij elke stap. Onder reduced
   motion: helemaal niet tonen (`06` §7: "confetti uit"). **Expliciet
   aanmerken voor `M5`'s audit** zodra die draait — niet aannemen dat
   "klein" automatisch "goedgekeurd" betekent.

## Regels

- Geen wijziging aan `revealNext()`'s volgorde, `PODIUM_STEP_DELAY_MS`, de
  skip-logica zelf, `.podium-rematch`, `selfLine`, of `.podium-step-1`'s
  bestaande kleur — dit raakt uitsluitend de motion-laag erbovenop.
- Confetti is decoratief (`aria-hidden`) — de uitslag zelf is al meteen in
  de DOM/accessibility tree (bestaand gedrag, niet hiervan afhankelijk).

## Definition of done

- Handmatig geverifieerd: elke stap krijgt een zichtbare entrance
  (opacity/transform) i.p.v. instant verschijnen; skip blijft instant voor
  de resterende stappen; confetti begrensd in aantal/duur, alleen bij de
  laatste stap.
- CDP-geverifieerd onder reduced motion: geen stagger-vertraging (alles
  direct zichtbaar, geen timers), geen entrance-animatie, geen confetti.
- Genoemd als openstaand controlepunt voor `M5`: confetti's
  transform/opacity-only-opzet, ter bevestiging in die audit.
- `PROGRESS.md`: E14 van niveau 1 (stagger/skip/winnaar-accent al aanwezig)
  naar niveau 2-richting (motion + confetti + reduced-motion-gedekt).
