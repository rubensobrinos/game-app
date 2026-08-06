# Prompt — T4-1: Terminologie- en directe tekstcorrecties

**Status: uitgevoerd.** Onderdeel van [`../PROGRESS.md`](../PROGRESS.md), thema 4.

## Brondocument

`09-CONTENT-AND-MICROCOPY.md` §3 (Terminologie), §4, §5, §11, §12.

## Wat is gedaan

Alle acht correcties uit de oorspronkelijke prompt zijn doorgevoerd in
`frontend/locales/{nl,en,es}.mjs`, met concrete EN/ES-waarden (niet meer aan
de uitvoerder overgelaten — reviewfeedback punt 7):

| Sleutel | NL | EN | ES |
|---|---|---|---|
| `home.quickStart` | Start direct een game | Start a game now | Empieza una partida ahora |
| `home.codeLabel` | Voer de gamecode in | Enter the game code | Introduce el código de la partida |
| `join.nameLabel` | Hoe noemen we je? | What should we call you? | ¿Cómo te llamamos? |
| `podium.rematch` | Revanche | Rematch | Revancha |
| `hostbar.lock` | Room vergrendelen | Lock the room | Bloquear la sala |
| `hostbar.unlock` | Room ontgrendelen | Unlock the room | Desbloquear la sala |
| `hostbar.finish` | Game beëindigen | End the game | Finalizar la partida |
| `hostbar.finishConfirm` | Weet je zeker dat je het potje wilt beëindigen? | Are you sure you want to end the game? | ¿Seguro que quieres finalizar la partida? |

De `game`/`potje`-inconsistentie in `09` §12 zelf (`Game beëindigen` naast
`...het potje wilt beëindigen`) is **letterlijk overgenomen**, niet zelf
gladgestreken — zie `PROGRESS.md` §3.

## Extra, bovenop de oorspronkelijke prompt (reviewfeedback)

1. **Zichtbare optioneel-aanwijzing** (punt 6): `join.nameLabel` alleen
   veranderen naar "Hoe noemen we je?" verwijderde de enige zichtbare
   aanwijzing dat een naam niet verplicht is. Nieuwe sleutel
   `join.nameOptionalHint`: "Optioneel — laat leeg voor een voorgestelde
   naam.", gerenderd als `<span class="field-label-hint">` onder het
   naamveld in `views/join.mjs`.
2. **Locale-parity-test** (punt 7): `frontend/locales/locales.test.mjs`
   (nieuw) bewaakt dat nl/en/es exact dezelfde sleutels hebben en geen enkele
   waarde leeg is. Voorkomt precies dit soort stille drift in het vervolg.

## Definition of done — behaald

- Alle acht sleutels + de nieuwe hint-sleutel bijgewerkt in alle drie de talen.
- `frontend/locales/locales.test.mjs`: 4/4 groen.
- `node --test` (372 tests, frontend + locales + client/flow): groen.
- Handmatig geverifieerd in headless Chromium: home toont de nieuwe
  startknop-/codelabeltekst, de join-hint verschijnt onder het naamveld.
- `PROGRESS.md`-rijen voor §3 (rematch), §4, §5, §12 (lock/finish) naar
  niveau 2.
