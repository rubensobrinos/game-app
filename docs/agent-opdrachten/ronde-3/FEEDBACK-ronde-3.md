# Feedback ronde 3 — producteigenaar, 5 aug 2026

Vier bevindingen op de live build, in volgorde van ernst zoals de
producteigenaar ze zelf rangschikte. **Nog niet toegewezen.**

| # | Bevinding | Ernst |
| --- | --- | --- |
| F1 | Verversen van de hostpagina maakt de game kapot | blokkeert de pilot |
| F2 | Eerste room niet meer joinbaar terwijl het hosttabblad openstond | hoog |
| F3 | `/game/{code}` stuurt naar de homepage in plaats van de joinflow | middel |
| F4 | Fonts komen van Google Fonts; eerste klik reageert soms niet | klein |

---

## F1 — een refresh van de hostpagina beëindigt de game

> "Ik ververste `/host/844895` en kreeg *Deze game bestaat niet (meer)*."

De spec zegt dat een host binnen de reconnect-termijn moet kunnen terugkeren.
Dat gebeurt niet.

**Waarom dit vóór de pilot moet:** op een telefoon is één onbedoelde swipe of
één keer wegklikken genoeg om de quiz voor de hele kamer te beëindigen. De
pilot is een avond met echte mensen; als dit daar gebeurt is de avond voorbij
en meten we niets.

Te onderzoeken: waar het hosttoken leeft en of het een herlaadbeurt overleeft,
en of "Deze game bestaat niet (meer)" hier de juiste melding is of een
verkeerd geraden foutcode. Verwant aan het besluit dat een solopartij een
reload niet overleeft — maar dit is de multiplayerkant, en die hóórt het wél
te overleven.

## F2 — de eerste room stierf terwijl zijn tabblad nog openstond

> "Mijn allereerste room (844 895) was al niet meer joinbaar terwijl het
> hosttabblad nog openstond."

Vermoeden van de producteigenaar: het aanmaken van een nieuwe room vanuit
dezelfde browser doodt de vorige. Dat is plausibel — één opslagplek voor
"jouw sessie" per browser, die bij een tweede room overschreven wordt — maar
het is niet bevestigd. Waarschijnlijk dezelfde wortel als F1.

Onderzoek F1 en F2 samen; het is vermoedelijk één reparatie.

## F3 — de directe link werkt niet

`/game/{code}` uit de adresbalk delen stuurt de ontvanger naar de homepage in
plaats van naar de joinflow. Als de QR-code een andere route gebruikt is de QR
zelf niet stuk — maar de link kopiëren en plakken is wat mensen dóén, en dat
werkt nu niet.

## F4 — fonts en de eerste klik

Twee kleine dingen, mogelijk hetzelfde:

- De fonts komen van Google Fonts; er kwam zelfs een 503 voorbij. De spec wil
  assets in eigen beheer. Zelf hosten haalt een externe storing én een
  privacylek weg.
- Het eerste klikje op "Start direct een game" deed pas bij de tweede poging
  iets. Dat kan een trage eerste interactie zijn — bijvoorbeeld omdat er nog
  op een lettertype gewacht wordt.
