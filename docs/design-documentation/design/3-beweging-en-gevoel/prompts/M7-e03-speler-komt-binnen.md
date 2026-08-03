# Prompt — M7: E03, Speler komt binnen (niveau 0 → 1)

**✅ Gedaan — commit `ed6d313`.** Reconciliatie (bestaande rijen blijven hun
DOM-node houden), nieuwe-chip-fade, gedebouncete (300ms) tellerpuls. Sound-
clustering blijft geparkeerd op `O-008` (geen geluid om te clusteren) — de
puls-debounce dekt de visuele kant van "bulkjoins geclusterd".

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M5`, gebruikt
wel thema 2's tokens (geleverd, `8eb1996`).

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E03: nieuwe spelerchip fade + lichte
scale, teller pulseert één keer, optionele korte joincue, bij bulkjoins
worden cues geclusterd.
`11-DESIGN-QA-CHECKLIST.md` D: "Krijgt een nieuwe join visuele feedback?",
"Worden bulkjoins gebatcht?" — beide ontbraken tot nu in `PROGRESS.md`'s
Criteria-citatie, wordt hierbij toegevoegd samen met C (zie `M6`).

## Belangrijke bevinding: de huidige renderlogica herbouwt de hele lijst

**Dit is geen aanname, geverifieerd in `lobby.mjs`'s `update()`:**

```js
list.textContent = '';
for (const [playerId, name] of model.participants) {
  // ... maakt voor ELKE speler een nieuw <li>, elke keer opnieuw
}
```

Bij élke `update()`-aanroep (dus bij élke join, niet alleen de nieuwe) wordt
de complete `<ul>` leeggemaakt en van nul opnieuw opgebouwd uit
`model.participants` (een `Map`, hertekend in iteratievolgorde). Een naïeve
"voeg `.lobby-player` een fade-in-animatie toe"-fix zou daardoor **elke
bestaande speler opnieuw laten fade-in'en bij elke nieuwe join** — precies
het "carrousel"/ruis-effect dat `06` §2 en §7 willen vermijden, niet een
enkele nieuwe chip die binnenkomt. Dit moet dus eerst een reconciliatie
worden (bestaande `playerId`'s hergebruiken hun bestaande DOM-node, alleen
écht nieuwe `playerId`'s krijgen een nieuw, geanimeerd `<li>`) vóór er
enige animatie op mag.

## Wat dit is

1. **Reconciliatie i.p.v. volledige herbouw** in `lobby.mjs`'s `update()`:
   houd een `Map<playerId, HTMLElement>` van gerenderde rijen bij; bij een
   nieuwe `update()`-aanroep: verwijder rijen voor `playerId`'s die niet
   meer in `model.participants` zitten, laat bestaande rijen ongemoeid
   (geen re-render, dus geen hertriggerde animatie), voeg alleen nieuwe
   `playerId`'s toe als nieuw element.
2. **Nieuwe chip**: `opacity` 0→1 + lichte `scale` (bv. 0.95→1) via
   `--motion-base`/`--ease-enter` op het nieuwe `<li>` alleen.
3. **Teller pulseert één keer** bij verandering: `countLine`'s tekst
   verandert al; voeg een korte scale/opacity-puls toe (`--motion-fast`),
   die alleen afvuurt als `playerCount` daadwerkelijk wijzigde t.o.v. de
   vorige render (niet bij elke `update()`-aanroep die toevallig hetzelfde
   aantal doorgeeft — bv. een `rename`-delta raakt `participants` maar niet
   `playerCount`). Een CSS-`animation`-klasse moet expliciet af/aan gezet
   worden (reflow forceren of de klasse verwijderen+opnieuw toevoegen) om
   'm te laten herhalen — simpelweg dezelfde klasse laten staan triggert
   'm niet opnieuw.
4. **Bulkjoins clusteren**: `applyPlayerChanged` in `session-shell.mjs`
   verwerkt vandaag één `delta` per `room:player-changed`-event (geen
   array — geverifieerd, geen serverbatching). "Geclusterd" is dus een
   **cliëntzijdig debounce-patroon**: verzamel joins die binnen een kort
   venster (bv. 300–500 ms) binnenkomen en render/pulseer ze als één
   groep i.p.v. per join een aparte animatie/cue af te vuren. Dit hoort in
   `session-shell.mjs` (waar de events al binnenkomen), niet in
   `lobby.mjs` zelf — `lobby.mjs` blijft puur een renderer.
5. **Joincue (geluid)**: buiten scope — zit vast op de geluidsarchitectuur
   (`O-008`), net als de rest van §5. Alleen de visuele/tekstuele kant hier.

## Reduced motion

Chip-fade en teller-puls zijn opacity/scale — dekt door `M0`'s blanket-regel
zonder extra werk (geen bestaande, geharde scale zoals `M0` moest fixen).
Verifiëren, niet aannemen.

## Regels

- Geen volledige lijstherbouw meer bij elke `update()` — dit is de kern van
  de fix, niet optioneel.
- Debounce-venster expliciet benoemen in code/commentaar (geen magische
  timeout zonder uitleg).
- Geen geluid, geen haptiek — die blijven geparkeerd op `O-008`.

## Definition of done

- Handmatig geverifieerd (Playwright): 3 snel-achter-elkaar-joinende spelers
  laten niet 3× de hele lijst opnieuw animeren — alleen de nieuwe rijen
  krijgen de fade-in, bestaande rijen blijven ongemoeid in de DOM (zelfde
  node-referentie vóór en ná).
- Tellerpuls vuurt alleen bij een daadwerkelijke `playerCount`-wijziging,
  niet bij elke render.
- Debounce-gedrag voor bulkjoins gedemonstreerd (bv. 5 joins binnen 300 ms
  resulteren in één render-cyclus met alle 5 nieuwe chips, niet 5 losse).
- CDP-geverifieerd onder reduced motion: geen scale/fade zichtbaar, chips
  verschijnen instant.
- `PROGRESS.md`: E03 van niveau 0 naar 1, Criteria-regel uitgebreid met
  checklist-sectie D.
