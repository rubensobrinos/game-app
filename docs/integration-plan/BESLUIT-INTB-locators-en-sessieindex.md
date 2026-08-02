# Besluitvoorstel — locator-schrijvers en de sessietoken-index

**Van:** INT-B (opslagadapters).
**Aan:** DM-agent, eigenaar van `server/data/repository.js` en
`server/data/redis-keys.js`. Kopie aan INT-A.
**Betreft:** HANDOFF-items **INTB-9** en **INTB-10**, hier gebundeld tot één
besluit omdat ze dezelfde onderliggende oorzaak hebben.
**Status:** voorstel, wacht op akkoord van DM.

Mijn akkoord op een poortmethode betekent vanaf nu expliciet: **implementeerbaar
in Redis, inclusief een benoemde sleutel én een uitspraak over TTL.** Zonder die
twee kan ik een methode niet bouwen, hoe redelijk de signatuur ook oogt.

---

## Deel A — `saveRoom` raakt de lookup-indexen nooit meer aan

### Het probleem, gereproduceerd

```
A claimt 482917 via claimRoomLocatorsAtomically   -> A is eigenaar
B doet alleen saveRoom met diezelfde code          -> geen claim, geen controle

loadRoomByCode('482917')                           -> B
claimRoomLocatorsAtomically door C                 -> { ok:false, conflict:'code' }
```

De lookup-index zegt **B**, het claimregister zegt **A**. Een speler die de code
intypt komt in de verkeerde room, en een derde room krijgt een conflict op een
code die feitelijk van niemand meer is.

Dit maakt de fix voor INTB-2 gedeeltelijk ongedaan. We hebben de race tussen twee
claims gedicht, maar er loopt een tweede weg naar dezelfde index die helemaal
niet langs de claim gaat.

### Voorstel

**`claimRoomLocatorsAtomically`, `rotateRoomLocators` en `releaseRoomLocators`
worden de enige drie schrijvers van de lookup-indexen.** `saveRoom` schrijft
uitsluitend het roomdocument en `rooms:active`.

Dit is geen nieuwe regel maar het doortrekken van een regel die al geldt: de
invite-index kán door `saveRoom` niet gevuld worden, want `Room` draagt het ruwe
`inviteId` en de index draait op de hash. De code-index is de enige uitzondering,
en precies die uitzondering is het gat.

### Gevolgen die ik zelf oppak

- De conformance-suite rekent er nu op dat `saveRoom` de code-index vult. Die
  tests veranderen mee; ik werk ze bij zodra dit besluit valt.
- De adapter en de fake moeten hier gelijk in blijven, anders verschuift het
  probleem naar een gedragsverschil.

### Wat INT-A moet weten

Roomcreatie wordt hiermee expliciet tweefasig: eerst claimen, dan opslaan. Een
`saveRoom` zonder voorafgaande geslaagde claim levert een room op die nergens
vindbaar is — dat is de bedoeling, maar het moet in de compositielaag staan en
niet impliciet blijven.

---

## Deel B — sleutelontwerp voor `loadSessionByTokenHash`

### Waarom een signatuurwijziging hier niet kan

De voor de hand liggende oplossing — `loadSessionByTokenHash(roomId, tokenHash)`
— werkt niet, en het is de moeite waard waarom.

`PROTOCOL.md` zegt dat een socket-handshake uitsluitend een `sessionToken`
meestuurt. Op dat moment kent de server de room nog niet; het opzoeken van de
sessie ís de manier waarop hij de room leert kennen. Een `roomId`-parameter zou
de aanroeper vragen om iets wat hij alleen kan weten door de lookup die hij
probeert te doen.

Een token dat het `roomId` zelf draagt is evenmin een uitweg: DECISIONS #26 legt
het tokenformaat vast op 32 willekeurige bytes, en een herleidbaar roomId in een
bearer token is bovendien onwenselijk.

Er moet dus een **globale index** komen.

### Voorstel

```js
// redis-keys.js
sessionTokenLookupKey(tokenHash)   // -> "session:token:{tokenHash}"
```

Waarde: het paar `{ roomId, sessionId }`, zodat de adapter daarna de bestaande
room-scoped sessie kan laden via `roomSessionsKey(roomId)`. De index bevat
verder niets — geen sessiegegevens, zodat er maar één plek is waar een sessie
echt staat.

De sleutelnaam bevat de **hash**, nooit het token zelf. Dat sluit aan op de
redenering achter `roomInviteLookupKey(inviteHash)`: een Redis-keyname mag de
capability niet tonen.

### TTL — de moeilijkste helft, en waarom ik hem hier expliciet maak

De index moet minstens zo lang leven als de sessie, en de sessie leeft met de
room. Te kort en een geldig token werkt ineens niet meer, midden in een spel; te
lang en er blijven sleutels achter.

Het probleem: de index is een **globale** sleutel, dus de room-brede TTL-refresh
kan hem niet vinden op naam.

Voorstel: laat de refresh de tokenhashes ophalen uit de bestaande
`roomSessionsKey(roomId)`-hash — daar staan de sessies al, en `Session` draagt
`tokenHash`. De refresh die nu de room-brede sleutels aanraakt, verlengt dan ook
de bijbehorende token-indexen. Dat kost één extra lezing per refresh en geen
enkele extra schrijfactie op het antwoordpad.

Alternatief dat ik afraad: de index verversen bij elke geslaagde lookup
("touch-on-read"). Dat werkt voor een actief gebruikt token, maar een speler die
langer dan de TTL niet reconnect verliest zijn sessie terwijl de room nog leeft —
en juist reconnect is waar deze lookup voor bestaat.

### Rotatie — dit ontbrak in het oorspronkelijke voorstel

Krijgt een sessie een nieuw token, dan blijft de oude tokenhash naar dezelfde
sessie wijzen. Dat is een tweede geldige capability naast de nieuwe.

Dat is niet hypothetisch: het is **letterlijk INTB-5 nog een keer**, nu voor
sessietokens in plaats van roomlocators. De fake heeft dat gat vandaag ook.

**Eis: het vervangen van een tokenhash verwijdert de oude index in dezelfde
atomaire operatie.** Net als bij `rotateRoomLocators`. Zonder die eis bouwen we
de derde variant van hetzelfde probleem.

### Wat ik nodig heb om dit te kunnen bouwen

1. `sessionTokenLookupKey(tokenHash)` in `redis-keys.js`;
2. dezelfde regel in `DATA-MODEL.md` §Redis-sleutels;
3. de TTL-koppeling uit de sectie hierboven, of een expliciet alternatief;
4. een rotatiemethode of een uitspraak dat rotatie via een bestaande atomaire
   operatie loopt.

---

## De rode draad achter beide delen

Dit is vandaag de **derde keer** dat een intrekking niet intrekt:

| | Wat werd toegevoegd | Wat niet werd ingetrokken |
| --- | --- | --- |
| INTB-5 | nieuwe roomlocators bij rotatie | de oude locators |
| INTB-9 | een code-index via `saveRoom` | de claim van de vorige eigenaar |
| INTB-10 | een nieuwe tokenhash | de oude tokenhash |

Drie keer hetzelfde patroon in één dag lijkt me geen toeval. Het model beschrijft
overal hoe een capability ontstaat en bijna nergens hoe hij verdwijnt.

Mijn suggestie, buiten dit besluit om: behandel intrekking als een expliciete
eis bij elke capability die we toevoegen — wie geeft hem uit, wie trekt hem in,
en welke operatie doet dat atomair. Dat is een ontwerpprincipe voor de
producteigenaar, geen implementatiedetail.
