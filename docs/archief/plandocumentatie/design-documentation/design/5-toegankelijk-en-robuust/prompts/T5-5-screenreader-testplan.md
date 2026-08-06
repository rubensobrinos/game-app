# Prompt — T5-5: Screenreader-testplan (voor een mens met een toestel)

**Status in `PROGRESS.md`:** Screenreader | niveau 1 | bewijs: **aangenomen**
("`aria-live`, `aria-expanded`/`-pressed` en `textContent` staan er, maar er
heeft nooit een screenreader gedraaid.")

**Dit is bewust geen bouwprompt.** De conclusie van de eigen `PROGRESS.md` is
expliciet: "Eén middag met een echt toestel en VoiceOver verzet hier meer dan
een week bouwen." Een AI-agent kan dit niet leveren — geen fysiek toestel,
geen echte VoiceOver/TalkBack-sessie. Wat hier staat is het testplan zodat
wie dat toestel wél heeft niet zelf hoeft te bedenken wat te controleren.

## Wat automatisch al gecontroleerd is (en dus hier niet meer hoeft)

Playwright's accessibility-tree (`page.accessibility.snapshot()` / ARIA-
snapshot) kan rollen, namen en `aria-live`-regio's controleren zonder een
echte screenreader — dat is een reële, maar zwakkere bewijslaag dan "gemeten
met VoiceOver". Als dat nog niet is gedaan, doe dat éérst (goedkoop, geen
toestel nodig) vóór de handmatige sessie hieronder — het vangt evidente
fouten (ontbrekend label, verkeerde rol) al af zodat de handmatige sessie zich
op de dingen kan richten die alleen een écht toestel laat horen (toon, timing,
verrassende aankondigingen, focusgedrag dat van OS tot OS verschilt).

## Testplan

Apparaten: minimaal iOS Safari + VoiceOver, Android Chrome + TalkBack (`08`
§9).

Doorloop per scherm, met ogen dicht of scherm uit (niet meekijken — dat is
precies waar aannames sneuvelen):

1. **Home → Snel starten.** Wordt de knop als knop aangekondigd, niet als
   generieke tekst? Is er een aankondiging bij de overgang naar de lobby?
2. **Code-invoer → naamveld.** Wordt het invoerveld met zijn label
   aangekondigd (`join.nameLabel`)? Wordt een lege submit begrijpelijk?
3. **Lobby.** Wordt het aantal spelers aangekondigd bij een wijziging, of moet
   je er handmatig naartoe navigeren? Is de deelnemerslijst als lijst
   herkenbaar? Werkt de QR-dialoog met VoiceOver-rotor (focus erin, terug
   eruit bij sluiten — `08` §2.1's "focus keert terug naar trigger")?
4. **Gameplay.** Wordt de vraag/vlag-alt aangekondigd bij een nieuwe ronde
   (`.sr-only`-schermtitel, `game.flagAlt`)? Worden de vier opties als groep
   met duidelijke labels voorgelezen (`08` §2.2's expliciete eis)? Kondigt
   `aria-live` op de status niet té vaak aan (elke voortgangsupdate zou
   spammen — `08` §2.2: "timerupdates niet iedere seconde spammen")? Wordt de
   uitslag volledig aangekondigd (correct antwoord, eigen resultaat, score)?
5. **Tussenstand/podium.** Wordt de eigen positie duidelijk, of moet je de
   hele lijst beluisteren om 'm te vinden?
6. **Pauze-overlay.** Wordt de pauzereden meteen aangekondigd bij het ingaan?
   Werkt Escape-hervatten voor de host met een screenreader actief (soms
   onderschept een screenreader systeemtoetsen anders)?
7. **Hostbalk.** Is de spelerslijst-toggle begrijpelijk als "in-/uitklapbaar"
   (`aria-expanded`)? Kondigt het bevestigingsdialoogvenster (`window.confirm`)
   zich duidelijk aan?
8. **Hamburgermenu.** Werkt het al bekend-goede patroon (`aria-haspopup`/
   `-expanded`/`-controls`) ook merkbaar goed met een screenreader, niet
   alleen correct in de code?

## Wat `08` §2.2 expliciet vraagt en nog apart gecontroleerd moet worden

- "rankmovement krijgt tekst `twee plaatsen gestegen`" — bestaat nog niet
  (hoort bij thema 1/3's rank-movement-werk, niet hier te bouwen, wel hier te
  signaleren als afhankelijkheid).
- "roomcode semantisch leesbaar, niet cijfer voor cijfer onbegrijpelijk" —
  controleer hoe VoiceOver een zescijferige code als `482917` daadwerkelijk
  uitspreekt (vaak als heel getal, niet als cijferreeks — mogelijk een
  `aria-label` met spaties tussen cijfers nodig, `4 8 2 9 1 7`).

## Definition of done

- Elke regel hierboven heeft een concrete uitkomst (gehoord/niet gehoord,
  citaat van wat de screenreader daadwerkelijk zegt), geen samenvattend
  "werkt over het algemeen".
- Gevonden gaten worden losse, kleine issues — niet één grote catch-all-fix.
- `PROGRESS.md`'s rij gaat van "1, aangenomen" naar "gemeten", met de
  apparaten/OS-versies erbij vermeld (bewijs vervalt anders na de eerstvolgende
  OS-update).
