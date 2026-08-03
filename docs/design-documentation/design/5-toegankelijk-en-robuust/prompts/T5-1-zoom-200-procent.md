# Prompt — T5-1: Zoom tot 200% verifiëren

**Status in `PROGRESS.md`:** Zoom tot 200% | niveau 1 | bewijs: **aangenomen**
("`maximum-scale` is weg, dus zoomen kán weer. Of de layout het houdt is niet
nagekeken.")

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §3: "grote tekstinstelling tot minimaal
200% waar haalbaar." `11-DESIGN-QA-CHECKLIST.md` K: "Werkt 200%
zoom/tekstvergroting voldoende?"

## Wat er nu vaststaat en wat niet

Vaststaand (gelezen): `frontend/index.html` heeft geen `maximum-scale`/
`user-scalable=no` meer — pinch-zoom is dus niet geblokkeerd. Niet vastgesteld:
of enig scherm bij 200% tekst- of paginazoom content afsnijdt, overlapt, of
horizontaal laat scrollen op een manier die de primaire actie onbereikbaar
maakt.

## Contract

Twee aparte tests, niet één:

1. **Browser-zoom 200%** (viewport blijft gelijk, alles schaalt) — test via
   Playwright: `page.setViewportSize` ongewijzigd,
   `page.evaluate(() => document.body.style.zoom = '2')` of
   `page.emulateMedia`/CSS-`transform: scale(2)`-equivalent, of eenvoudiger:
   render op de helft van de huidige breedte (390×844 → 195×422) als
   benadering van "twee keer zo groot op hetzelfde scherm".
2. **Tekstvergroting alleen** (`font-size` op `html` verdubbelen via
   `page.addStyleTag`) — dit is het scenario dat `08` §3 bedoelt
   ("tekstinstelling"), niet paginazoom. Beide kunnen verschillend breken.

Doorloop minimaal: home, join (met een lange naam), lobby (met de
deelnemerslijst open), gameplay (vraag + 4 opties), scoreboard, podium,
hostbalk met de spelerslijst open, hamburgermenu open, pauze-overlay,
QR-overlay.

## Regels

- Geen horizontale scroll op de hoofdpagina (`.screen`-inhoud mag intern
  scrollen, de pagina zelf niet — zelfde discipline als de bestaande
  compact-portrait-fix).
- De primaire actie (Snel starten, Meedoen, Start Rounda, antwoordoptie)
  blijft altijd bereikbaar zonder dat een ander element 'm overlapt.
- Tekst mag afbreken/omvouwen; tekst mag **niet** ongelezen worden afgesneden
  door een vaste hoogte (`08` §3, laatste regel: "geen vaste pixelhoogte die
  vertaalde tekst afsnijdt" — hetzelfde principe geldt voor vergrote tekst).

## Definition of done

- Playwright-script met screenshots vóór/na voor elk scherm uit de lijst
  hierboven, voor beide zoomvormen.
- Gevonden breuken gefixt óf expliciet als apart issue vastgelegd met
  scherm + precieze breekpunt — niet stilzwijgend overgeslagen.
- `PROGRESS.md`'s rij gaat van "1, aangenomen" naar "gemeten", met het
  daadwerkelijke resultaat (kan ook eerlijk "0, gemeten: breekt op X" zijn).
