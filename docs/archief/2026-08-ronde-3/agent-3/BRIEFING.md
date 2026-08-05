# Agent 3 — betrouwbaarheid & solo

**Lees eerst `../README.md`.** Jij zit in tests, contrast en de soloflow. Agent
1 zit in het protocol, agent 2 in de vraagselectie.

## Ronde 1 — de flaky Redis-race (middel, ~1 dag)

`STATUS.md` noemt een keten-race onder Redis die **ongeveer 1 op de 7 keer**
faalt (matrixrij 13). Hij staat er al dagen en blokkeert CI: een suite die soms
rood is, wordt een suite die niemand nog gelooft.

Draai hem herhaald tot je hem betrapt (`node --test` in een lus, met de
test-Redis op `redis://127.0.0.1:6380`), en **repareer de oorzaak, niet de
test**. Een `await` erbij of een ruimere drempel is geen fix als de race blijft
bestaan. Kom je tot de conclusie dat het gedrag zelf goed is en alleen de
assertie te scherp, onderbouw dat dan met wat je gemeten hebt.

## Ronde 2 — contrastcontrole (klein, ~halve dag)

`contrast.test.mjs` toetst alleen de kleurtokens in `base.css` en
`components.css`. De hardgecodeerde 1c-kleuren in `rounda-1c.css` vallen buiten
élke controle — een agent ontdekte zelf dat zijn labelkleur op de magenta
revealkaart 4,30:1 haalde waar AA 4,5 eist.

Breid de controle uit naar `rounda-1c.css`, op **beide** thema's (donker én
licht). Verwacht dat er meer dan één kleur doorheen zakt; lever een lijst met
wat je vindt in plaats van stilletjes waarden bij te stellen. Wat er echt fout
is repareer je; wat een bewuste keuze lijkt, meld je.

## Ronde 3 — solo overleeft geen reload (middel, ~1 dag)

"Alleen spelen" (besluit C-1) draait op de mocktransport in het geheugen van
één pagina. Ververs je, dan is je partij weg: `app.mjs` herkent de solosessie,
ruimt hem op en stuurt je naar home. Dat is nu een bewuste grens, geen bug.

Maak dat het een partij overleeft. Voor de hand liggend: de mockstate in
`sessionStorage` bewaren en bij het opstarten terugzetten. Let op wat er níét
in mag: geen speler-invoer die je niet kunt vertrouwen bij het terugzetten, en
geen state die zo groot wordt dat opslaan merkbaar wordt.

Blijft het na je onderzoek een slecht idee, zeg dat dan met de reden — dat is
een geldige uitkomst.

## Niet doen

- `server/transport/`, `server/protocol/` (agent 1) of `server/rules/`
  (agent 2) aanraken.
- Een falende test groen maken door de assertie te verzwakken.
- De multiplayerflow aanpassen om solo makkelijker te maken.
