# 11 — Design QA Checklist

Gebruik deze checklist bij ontwerp-review, pull request, release candidate en regressietest.

## A. Productpositionering

- [ ] Voelt het als world-party-game, niet als schooltool of SaaS-dashboard?
- [ ] Is nul-account/nul-download zichtbaar in de ervaring?
- [ ] Is het volledig bruikbaar zonder gedeeld scherm?
- [ ] Voegt een groot hostscherm sociale waarde toe zonder afhankelijkheid?
- [ ] Is de wereld inhoudelijk/visueel herkenbaar zonder drukke decoratie?

## B. Primaire taak en hiërarchie

- [ ] Is binnen twee seconden duidelijk waar de gebruiker is?
- [ ] Is duidelijk wat er nu gebeurt?
- [ ] Is één volgende actie dominant?
- [ ] Zijn secundaire acties visueel lichter?
- [ ] Zijn instellingen progressief onthuld?
- [ ] Staat decoratie nooit boven taak of status?

## C. Start en join

- [ ] Kan de host direct een standaardpotje starten?
- [ ] Verandert de knop direct naar `Potje maken…`?
- [ ] Kan een speler via QR/link zonder code opnieuw invoeren?
- [ ] Is handmatige code-invoer paste- en keyboardvriendelijk?
- [ ] Is naam kiezen één duidelijke stap?
- [ ] Zijn roomfouten specifiek en herstelbaar?

## D. Lobby

- [ ] Zijn QR en code permanent zichtbaar voor de host?
- [ ] Is de code leesbaar op relevante kijkafstand?
- [ ] Is het spelersaantal zichtbaar?
- [ ] Krijgt een nieuwe join visuele feedback?
- [ ] Worden bulkjoins gebatcht?
- [ ] Heeft de lege lobby een concrete uitnodigingsactie?
- [ ] Is `Start game — N spelers` dominant?
- [ ] Werkt de layout met 0, 2, 8, 35 en 200 spelers?
- [ ] Kan de speler iemand uitnodigen indien room open is?

## E. Vraag en antwoord

- [ ] Is vraaginhoud de visuele hoofdrolspeler?
- [ ] Zijn antwoordtargets groot genoeg?
- [ ] Hebben opties letter en vormidentiteit?
- [ ] Werkt active feedback op touch?
- [ ] Is hover alleen enhancement?
- [ ] Is selected anders dan correct?
- [ ] Krijgt submitting een zichtbare state?
- [ ] Wordt `Verstuurd ✓` in dezelfde component getoond?
- [ ] Blijft correctheid verborgen tot ronde-einde?
- [ ] Past de kern binnen gangbare mobiele viewport of is scroll veilig ontworpen?
- [ ] Zijn lange labels getest?

## F. Timer en rondeflow

- [ ] Is de timer rustig tijdens de normale fase?
- [ ] Neemt urgentie pas in de laatste seconden toe?
- [ ] Is countdown kort en vooraf geladen?
- [ ] Is ronde sluiten duidelijk zonder correctheidskleur?
- [ ] Is de volgorde reveal → resultaat → headline → leaderboard consistent?
- [ ] Kan motion de vervolgstap niet onnodig blokkeren?

## G. Reveal en leaderboard

- [ ] Is correct antwoord duidelijk met kleur, icoon en tekst?
- [ ] Is de eigen keuze zichtbaar?
- [ ] Zijn punten en bonus begrijpelijk?
- [ ] Is rankbeweging tekstueel en visueel aangegeven?
- [ ] Wordt maximaal één sociale headline getoond?
- [ ] Is de headline feitelijk en niet vernederend?
- [ ] Toont leaderboard top vijf plus eigen rij?
- [ ] Zijn ties consistent afgehandeld?
- [ ] Werkt antwoordverdeling zonder kleur als enige codering?

## H. Podium

- [ ] Is de definitieve uitslag zonder animatie direct begrijpelijk?
- [ ] Zijn 1, 2 en 3 helder?
- [ ] Ziet een niet-podiumspeler zijn eigen eindpositie?
- [ ] Is `Revanche` primair?
- [ ] Is confetti beperkt en reduced-motionvriendelijk?
- [ ] Kan de finale snel worden overgeslagen of verkort?

## I. Componentkwaliteit

- [ ] Zijn hero, primary, secondary, quiet en destructive onderscheidend?
- [ ] Heeft ieder interactief component default/hover/focus/active/disabled/loading?
- [ ] Is disabled niet alleen opacity 0.5?
- [ ] Is focusring overal zichtbaar?
- [ ] Zijn iconen bij belangrijke acties gelabeld?
- [ ] Zijn emoji niet als definitieve logo/medaille gebruikt?
- [ ] Zijn kleurrollen tokens en niet hardcoded per pagina?

## J. Content en taal

- [ ] Is copy kort, menselijk en actief?
- [ ] Worden Nederlandse en Engelse termen niet willekeurig gemengd?
- [ ] Benoemt een fout de vervolgstap?
- [ ] Is `Loading…` vervangen door activiteitsspecifieke tekst?
- [ ] Zijn singular/plural en lange vertalingen getest?
- [ ] Is sociale copy gevarieerd zonder geforceerde humor?

## K. Accessibility

- [ ] Werkt keyboard-only?
- [ ] Is focusvolgorde logisch?
- [ ] Is kleur nooit de enige informatiedrager?
- [ ] Zijn screenreader-updates gedoseerd?
- [ ] Is resultaat volledig aangekondigd?
- [ ] Werkt 200% zoom/tekstvergroting voldoende?
- [ ] Respecteert motion de systeemvoorkeur?
- [ ] Is geluid uitschakelbaar en niet essentieel?
- [ ] Zijn touch targets en afstanden voldoende?

## L. Resilience

- [ ] Bestaat een ontworpen langzame-loadingstate?
- [ ] Bestaat een reconnectstate?
- [ ] Herstelt refresh naam, score en actuele game-state?
- [ ] Is answer submit idempotent?
- [ ] Kan een dubbele tap geen dubbel antwoord maken?
- [ ] Is deadlinegedrag server-authoritative?
- [ ] Is hostdisconnect begrijpelijk voor spelers?
- [ ] Zijn verlopen/vergrendelde/volle rooms specifiek afgehandeld?
- [ ] Blokkeert een mislukte audio- of decoratieve asset de game niet?

## M. Responsive en performance

- [ ] Werkt compact portrait?
- [ ] Werkt landscape zonder stateverlies?
- [ ] Werkt hosttelefoon anders maar consistent met podiumdesktop?
- [ ] Is QR op echte apparaten scanbaar?
- [ ] Is code op kamerafstand leesbaar?
- [ ] Zijn animaties performant op middelmatige Androidhardware?
- [ ] Is layout stabiel bij binnenkomende spelers?
- [ ] Zijn 100+ spelers geaggregeerd in plaats van allemaal geanimeerd?

## N. Releasebewijs

- [ ] Screenshots/video van happy path mobiel.
- [ ] Screenshots/video van host/podiumdesktop.
- [ ] Error- en reconnectdemo.
- [ ] Accessibilitycheck vastgelegd.
- [ ] Copyreview NL/EN.
- [ ] Geen regressie in anti-afkijklogica.
- [ ] Featureflag/rollback aanwezig.
- [ ] Product Owner heeft open beslissingen voor deze scope bevestigd.
