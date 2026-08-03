# 08 — Accessibility en Resilience

## 1. Uitgangspunt

Toegankelijkheid en technisch herstel zijn onderdeel van de kernervaring. Een snelle browsergame verliest vertrouwen zodra een tap onduidelijk is, een verbinding hapert of kleur de enige uitleg geeft.

Bestaande sterke punten zoals focusringen, aria-live, tabular nums en ellipsis moeten behouden of verbeterd worden.

## 2. Toegankelijkheidsbaseline

### 2.1 Keyboard

- alle acties bereikbaar;
- zichtbare `focus-visible`;
- logische volgorde volgens visuele hiërarchie;
- Enter/Space activeert buttons;
- Escape sluit sheets/modals waar veilig;
- focus keert terug naar trigger;
- geen keyboardtrap buiten bedoelde modal.

### 2.2 Screenreader

- schermtitel bij statewissel;
- roomcode semantisch leesbaar, niet cijfer voor cijfer onbegrijpelijk;
- answer options als groep met duidelijke labels;
- submittedstatus één keer aangekondigd;
- timerupdates niet iedere seconde spammen;
- reveal kondigt resultaat, gekozen en correct antwoord aan;
- rankmovement krijgt tekst `twee plaatsen gestegen`.

### 2.3 Kleur en contrast

- kleur nooit de enige informatiedrager;
- correct/incorrect ook met icoon en tekst;
- answer identity ook met letter/vorm;
- minimaal AA-contrast;
- focusring contrasteert tegen dark en light;
- grafieken hebben labels/patronen of tekstwaarden.

### 2.4 Motion

- respecteer `prefers-reduced-motion`;
- geen noodzakelijke informatie alleen via beweging;
- geen flitsende patronen;
- podium is direct begrijpelijk zonder revealanimatie;
- timerurgentie wordt ook tekstueel/numeriek duidelijk.

### 2.5 Geluid

- lokale mute;
- geen status alleen auditief;
- volume/mix bescheiden;
- captions zijn niet nodig voor niet-spraakcues, maar visuele equivalenten wel;
- autoplaybeperkingen worden correct behandeld.

### 2.6 Touch en motoriek

- grote targets;
- voldoende afstand;
- geen precieze drag als enige interactie;
- optie blijft stabiel tijdens tap;
- destructive actions gescheiden van primary;
- timeouts houden rekening met configuratie en eventuele toegankelijkheidsmodus.

### 2.7 Taal en cognitieve helderheid

- korte zinnen;
- één instructie per state;
- jargon vermijden;
- foutmelding benoemt oplossing;
- consistente termen: `room`, `potje`, `host`, `antwoord`, `tussenstand`;
- geen plots wisselende Engelse systeemwoorden in Nederlandse interface.

## 3. Internationale en contentrobuustheid

Test minimaal:

- Nederlands;
- Engels;
- Duits of een taal met langere woorden;
- taal met andere tekstrichting indien toekomstige scope relevant is;
- zeer lange landnamen;
- namen met diacritics en emoji;
- vlaggen met lichte/donkere randen;
- grote tekstinstelling tot minimaal 200% waar haalbaar.

Geen vaste pixelhoogte die vertaalde tekst afsnijdt.

## 4. Netwerkstates

### 4.1 Langzame verbinding

- behoud schermcontext;
- toon activiteit na korte drempel;
- geen dubbele acties;
- assets progressief, maar vraaginhoud vóór decoratie;
- deadlineberekening server-authoritative.

### 4.2 Verbinding verloren

Speler:

1. status `Verbinding herstellen…`;
2. gekozen/ingediende state blijft zichtbaar;
3. automatisch reconnect;
4. daarna `Opnieuw proberen`;
5. duidelijke fallback naar start of roomcode indien sessie niet herstelbaar is.

Host:

- spelers zien dat host reconnect;
- room wordt niet direct vernietigd;
- timer- en pauzegedrag is deterministisch;
- herstelwindow technisch vastleggen.

### 4.3 Submit-onzekerheid

Kritieke situatie: speler tapt vóór deadline maar bevestiging is vertraagd.

Vereisten:

- client genereert idempotente submit-ID;
- server bevestigt acceptatie en timestamp;
- retry maakt geen dubbel antwoord;
- UI zegt niet `Verstuurd` vóór bevestiging;
- bij deadlinefout: specifieke melding, geen generieke netwerkerror;
- logging maakt reconstructie mogelijk zonder gevoelige data te lekken.

## 5. Refresh en sessieherstel

- tijdelijke room/spelertoken veilig lokaal;
- refresh herstelt actuele state;
- score, naam en ingediend antwoord blijven;
- verlopen token leidt naar specifieke state;
- logout/accountconcept is niet nodig;
- privévensters en storagebeperkingen hebben begrijpelijke fallback.

## 6. Roomfouten

| Fout | Tekstdoel | Herstelactie |
|---|---|---|
| code onbekend | code bestaat niet of is verkeerd | code controleren / opnieuw invoeren |
| room verlopen | potje is afgelopen | terug naar start |
| room vergrendeld | host laat niemand meer toe | wachten/host vragen of andere room |
| game gestart | late joinregel uitleggen | volgende ronde wachten of terug |
| room vol | limiet bereikt | terug of andere room |
| verwijderd | neutraal en duidelijk | terug naar start |
| serverfout | tijdelijk probleem | opnieuw proberen |

## 7. Host- en gamefailures

### Host sluit tab

- korte recoveryperiode;
- reconnect bij heropenen;
- mogelijke VIP-overdracht is OPEN;
- na timeout nette beëindiging en uitslagbehoud waar mogelijk.

### Serverrestart/deploy

- rooms niet onnodig verliezen;
- version skew tussen clients beheersen;
- duidelijke hard-refreshstrategie;
- geen half nieuwe UI met oude statecontracten.

### Geluid of asset faalt

Game gaat door. Geen ronde mag blokkeren op audio of decoratieve asset.

### Vlagafbeelding faalt

- fallback met land-/vraagcontext indien dit de vraag niet verraadt;
- preload en validatie van contentset;
- bij cruciale ontbrekende asset vraag annuleren of vervangen, geen lege onmogelijke vraag.

## 8. Privacy en veiligheid

- geen account nodig;
- verzamel minimale persoonsgegevens;
- spelersnamen zijn tijdelijk roomdata;
- geen vrije namen in analyticslogs;
- share-uitkomst bevat geen ongewenste volledige deelnemerslijst;
- roomcodes zijn niet behandeld als permanent geheim, maar rooms hebben TTL en rate limiting;
- moderatie van namen en misbruik is proportioneel en transparant;
- host kan speler verwijderen en room vergrendelen.

## 9. Testmatrix

Minimaal testen op:

- iOS Safari;
- Android Chrome op middelmatige hardware;
- desktop Chrome/Edge/Firefox/Safari waar ondersteund;
- toetsenbord-only;
- VoiceOver/TalkBack of vergelijkbare screenreader;
- reduced motion;
- dark/light/system;
- 200% zoom/tekstvergroting;
- trage 3G / packet loss simulatie;
- refresh tijdens lobby, vraag, submit en reveal;
- 2, 8, 35 en gesimuleerde 200 spelers.

## 10. Definition of Done — accessibility/resilience

Een feature is niet af wanneer alleen de happy path visueel klopt. Minimaal:

- keyboard en focus werken;
- touch feedback werkt;
- kleur heeft alternatief;
- screenreader ontvangt relevante state;
- loading/error/reconnect zijn ontworpen;
- refresh breekt state niet;
- reduced motion is gecontroleerd;
- lange tekst en vertaling breken layout niet;
- netwerkretry is idempotent.
