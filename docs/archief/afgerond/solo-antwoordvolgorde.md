# Solo: de antwoordvolgorde na een herlaadbeurt

Solo overleeft sinds 5 aug 2026 een reload — vraag, score en resterende tijd
komen correct terug. Twee zichtbare gaten bleven staan (gemeten door de lead):

| Wat | Wat je ziet |
| --- | --- |
| De vier antwoorden staan in een andere volgorde | vóór: Frankrijk, Duitsland, Spanje, Italië · ná: alfabetisch |
| Je eigen keuze is niet meer gemarkeerd | "Antwoord ontvangen" staat er wel, maar je weet niet meer waarop je tikte |

Samen betekent dat: reload je nadat je hebt geantwoord, dan kun je niet meer
zien wat je koos.

De oorzaak is bewust gekozen: `buildQuestionSequence` wordt bij herstel
opnieuw opgebouwd en dat is deterministisch, **behalve** de weergavevolgorde
van de meerkeuze-opties. Vier optie-ID's van de huidige ronde opslaan kost een
handvol bytes — de hele opgeslagen state is nu 909 bytes.

Scoring en vergrendeling zijn wél correct: je kunt na een reload niet nog eens
antwoorden en je punten worden niet verdubbeld.
