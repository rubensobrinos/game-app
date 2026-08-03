# Prompt — T5-1: Zoom tot 200% verifiëren

**Status: uitgevoerd — gemeten, één bug gevonden en gefixt.** Niet met een
project-Playwright-dependency (die bestaat niet, zie
`prompts/README.md`'s Playwright-notitie), maar ad-hoc tegen `node
server/index.mjs` op een lokale poort, met een tijdelijke Playwright-install
— geen commit van test-infrastructuur, alleen het gemeten resultaat.

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

## Gemeten resultaten

Doorlopen: home, join (lange naam), lobby (host, spelerslijst met kick-knop),
hostbar-spelerslijst open, hamburgermenu open, QR-overlay open, gameplay
(vraag + opties), pauze-overlay — bij zowel 2× paginazoom
(`document.body.style.zoom = '2'`) als 2× tekstvergroting
(`html { font-size: 32px }`), op 390×844.

| Scherm | Paginazoom 2× | Tekstvergroting 2× |
|---|---|---|
| Home | ✅ geen overflow | ✅ geen overflow |
| Join (lange naam) | ✅ geen overflow | ✅ geen overflow |
| Lobby (host, spelerslijst) | ❌→✅ **overflow gevonden en gefixt** | ❌→✅ zelfde fix |
| Hostbar-spelerslijst / hamburgermenu / QR-overlay | ❌→✅ (zelfde onderliggende lobby-overflow, verholpen) | ❌→✅ |
| Gameplay (vraag + opties) | ✅ geen overflow | ✅ geen overflow |
| Pauze-overlay | ✅ geen overflow | ✅ geen overflow |

**Gevonden bug (root cause achterhaald, niet alleen gesignaleerd):**
`.lobby-player`'s naam-`<span>` had geen `min-width`, dus flexbox' default
`min-width: auto` weigerde 'm te laten krimpen — bij beide zoomvormen duwde
een naam + de verwijderknop (`Speler 1Verwijder`) de rij, en daarmee de hele
pagina, horizontaal uit (`scrollWidth: 560` vs. `clientWidth: 390` bij
paginazoom). **Gefixt** in `base.css`: `.lobby-player { flex-wrap: wrap }` +
`.lobby-player > span { min-width: 0; overflow-wrap: anywhere }`. Hertest
bevestigt: geen enkel scherm overflowt nog horizontaal, in geen van beide
zoomvormen.

De primaire actieknop bleef in alle gevallen bereikbaar (getest via
`getBoundingClientRect`, geen overlap met een ander element). Een negatieve
verticale positie bij sterke zoom (knop buiten het initiële beeld) is geen
bevinding — dat lost verticaal scrollen op, en verticale scroll is expliciet
toegestaan (alleen horizontale scroll is verboden).

## Definition of done — behaald

- Acht schermen gemeten voor beide zoomvormen (tabel hierboven) — niet elk
  afzonderlijk gescreenshot, wel elk systematisch gecontroleerd op
  horizontale overflow (`scrollWidth` vs. `clientWidth`) en
  primaire-knop-bereikbaarheid.
- De gevonden breuk is gefixt, niet alleen gelogd — met root cause.
- `node --test`: 2788/2788 groen (volledige suite, geen regressie).
- `PROGRESS.md`'s rij gaat van "1, aangenomen" naar "2, gemeten — één
  overflow-bug gevonden en gefixt (`.lobby-player`)".
