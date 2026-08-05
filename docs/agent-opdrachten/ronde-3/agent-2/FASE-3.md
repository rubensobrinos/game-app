# Agent 2 — fase 3: de gedeelde link en de fonts

Twee losse punten uit `../FEEDBACK-ronde-3.md` (F3 en F4). Beide klein, beide
zichtbaar voor iedere gast.

## F3 — `/game/{code}` uit de adresbalk werkt niet

Deel je de link uit je adresbalk, dan belandt de ontvanger op de homepagina in
plaats van in de joinflow. De QR-code gebruikt een andere route en is niet
stuk — maar een link kopiëren en plakken is wat mensen dóén.

Kijk in `client/flow/route-resolver.mjs` en `frontend/js/app.mjs` (de tak
`route.route === 'game' || route.route === 'host'`). Zonder lokale sessie valt
de code nu terug op de code-invoerflow; de vraag is of dat werkt zoals bedoeld
en waarom de ontvanger op home eindigt.

Let op de reverse proxy: `/game/...` moet bij de app aankomen en niet als
bestand behandeld worden. Als het daaraan ligt, **meld je dat** — `caddy/` is
infrastructuur en niet van jou.

## F4 — de fonts komen van Google

Er kwam zelfs een 503 voorbij. De spec wil assets in eigen beheer. Zelf hosten
haalt twee dingen weg: een storing bij een derde partij, en het feit dat elke
speler zijn IP-adres bij Google achterlaat.

Haal de lettertypen binnen, zet ze bij de andere assets, en verwijder de
verwijzing naar Google. Let op de licentie: neem het licentiebestand mee.

Er is ook een melding dat het **eerste** klikje op "Start direct een game" pas
bij de tweede poging iets deed. Dat kan hiermee samenhangen (wachten op een
font). Kijk of het na het zelf hosten weg is; is het er nog, meld het dan met
wat je gemeten hebt in plaats van het te raden.

## Hoe je oplevert

F3 is een gedragsverandering: laat zien dat een verse browser zonder sessie via
`/game/{code}` in de joinflow uitkomt. F4 is te controleren met het
netwerktabblad — er hoort geen enkel verzoek naar een ander domein te gaan.
