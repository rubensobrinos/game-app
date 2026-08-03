# Prompt — M10: E14, Podium (niveau 0 → 1)

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M9`, gebruikt
thema 2's tokens (geleverd, `8eb1996`) — inclusief `--motion-stage` en
`--ease-stage`, letterlijk voor dit moment bedoeld (`06` §3: "podium: stage
easing, niet cartoonesk stuiterend").

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E14: optioneel 3→2→1, opbouw kort,
winnaar krijgt warme accenten, confetti beperkt, acties direct of uiterlijk
na korte finale, skip/reduced motion toont volledig podium onmiddellijk.
`11-DESIGN-QA-CHECKLIST.md` H: "Is confetti beperkt en
reduced-motionvriendelijk?", "Kan de finale snel worden overgeslagen of
verkort?" — de andere H-vragen (helderheid 1/2/3, eigen eindpositie voor
niet-podiumspeler, Revanche primair) zijn **al voldaan** in `podium.mjs` en
raken geen motion — zie hieronder, niet in deze prompt's scope.

## Wat er al klopt (geverifieerd in `podium.mjs`, niet aannemen dat het ontbreekt)

- **Eigen eindpositie voor niet-podiumspeler**: `selfLine` toont
  `standings.self`'s positie/score altijd, ongeacht of de speler in de
  top 3 zit. Al goed, geen motion-werk hier.
- **Revanche primair**: `.podium-rematch` heeft al eigen, onderscheidende
  styling (`components.css`, incl. de `:active`/`:hover`-behandeling die
  `M0` al meenam). Visuele hiërarchie is thema 2's domein, niet dit
  moment's motion-vraag.
- **Alle drie stappen verschijnen nu synchroon**: `podiumTop3(standings)`
  wordt in één `forEach` gerenderd, geen enkele stagger of vertraging. Dit
  is het daadwerkelijke gat: niveau 0 omdat er niets choreografeert, niet
  omdat de content zelf onduidelijk is.

## Wat dit is

1. **Optionele 3→2→1-opbouw**: stagger de entrance van `.podium-step-3`,
   dan `-2`, dan `-1` (brons eerst, winnaar laatst — bouwt spanning op,
   suspense-conventie). `animation-delay` per stap via `--motion-stage`
   (700–1200 ms totaal, dus elke stap ruwweg een derde daarvan uit elkaar),
   `--ease-stage` voor de curve. Alleen `opacity`/`transform`
   (translateY/scale), geen layout-eigenschappen.
2. **Winnaar-accent**: `.podium-step-1` krijgt een net iets warmere/rijkere
   visuele nadruk zodra 'm binnenkomt (bv. een korte glow/scale-emphasis
   bovenop de entrance) — geen aparte kleurbeslissing hier verzinnen als er
   al een accentkleur-token bestaat in het designsysteem; anders melden als
   open punt, niet zelf kiezen (zelfde regel als `M8`).
3. **Confetti, bewust minimaal**: een klein, vast aantal DOM-elementen (bv.
   12–20), CSS-only (`transform`/`opacity`, geen canvas/library), vaste
   korte duur (~1.5–2 s), geen lus. Bewust conservatief begrensd zodat het
   sowieso binnen `M5`'s classificatietabel past (transform/opacity-
   voorkeur) — **toch expliciet aanmerken voor `M5`'s audit** zodra die
   draait, niet aannemen dat "klein" automatisch "goedgekeurd" betekent.
4. **Skip-mechanisme**: een klik/tik ergens op het podiumscherm (of
   Escape) voltooit alle lopende stagger-/confetti-animaties direct naar
   hun eindstaat — vult "kan de finale snel worden overgeslagen" in. Acties
   (`Revanche`/wachttekst) blijven sowieso al meteen zichtbaar (bestaande
   code rendert ze synchroon, niet pas ná de animatie) — dat deel van de
   eis is dus al voldaan.
5. **Reduced motion**: volledig podium **direct** compleet, geen stagger,
   geen confetti — controleer dit programmatisch
   (`matchMedia('(prefers-reduced-motion: reduce)')`) vóór de
   stagger/confetti-stappen starten, niet alleen via CSS-duur (zelfde
   patroon als `M9`'s FLIP-check, `06` §7 noemt dit letterlijk: "podium
   direct compleet").

## Regels

- Geen wijziging aan `.podium-rematch`'s styling, `selfLine`, of de
  volgorde/inhoud van `podiumTop3` — dit raakt uitsluitend de
  entrance-choreografie en confetti.
- Confetti-elementen zijn decoratief (`aria-hidden="true"`) — de
  screenreader-aankondiging van de uitslag hangt niet af van de confetti-DOM.
- Geen eigen kleurbeslissing voor het winnaar-accent zonder eerst te
  checken of er al een token voor bestaat.

## Definition of done

- Handmatig geverifieerd: 3→2→1-opbouw zichtbaar, kort (binnen
  `--motion-stage`'s bereik), confetti begrensd in aantal en duur.
- Skip werkt: een klik tijdens de opbouw toont direct het volledige podium.
- CDP-geverifieerd onder reduced motion: geen stagger, geen confetti,
  volledig podium in één keer zichtbaar.
- Genoemd als openstaand controlepunt voor `M5`: confetti's
  transform/opacity-only-opzet, ter bevestiging in die audit.
- `PROGRESS.md`: E14 van niveau 0 naar 1, met de drie al-voldane
  H-checklistpunten (eindpositie, Revanche, 1/2/3-helderheid) expliciet
  benoemd als "niet dit werk, was al goed".
