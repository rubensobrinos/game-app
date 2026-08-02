// locales/nl.mjs — UI0. NL is leidend voor deze fase (EN/ES volgen in UI1b).
// Plat `{ key: string }`-object, zelfde patroon als de singleplayer-app se
// `T['nl']` in `app.js`. Geen enkel scherm is hier al gevuld — deze paar
// sleutels dienen alleen om de i18n-bedrading zelf (`applyI18n()`,
// `data-i18n`) aan te tonen in `js/app.mjs`.

export const nl = Object.freeze({
  'app.title': 'Play Aseso',
  'scaffold.ready': 'Frontend-scaffold gereed — schermen volgen in UI1–UI5.',

  // — Hamburgermenu (taal van de app zelf, niet de vraagtaal — die zit in
  // host-setup-state's config.language) + licht/donker-thema —
  'menu.open': 'Menu',
  'menu.language': 'Taal',
  'menu.theme': 'Thema',
  'menu.themeDark': 'Donker',
  'menu.themeLight': 'Licht',

  // — UI1-sleutels (Home + Preview/join) —
  'home.title': 'Play Aseso',
  'home.quickStart': 'Snel starten',
  'home.divider': 'of',
  'home.codeLabel': 'Heb je een code?',
  'home.codePlaceholder': '123456',
  'home.codeSubmit': 'Meedoen met code',
  'home.codeInvalid': 'Vul een code van 6 cijfers in',
  'join.title': 'Meedoen',
  'join.previewing': 'Bezig met ophalen…',
  'join.submitting': 'Bezig met meedoen…',
  'join.nameLabel': 'Jouw naam (optioneel)',
  'join.namePlaceholder': 'bv. Tom',
  'join.submit': 'Meedoen',
  'join.retry': 'Opnieuw proberen',
  'join.joined': 'Meegedaan!',

  // — UI3/UI4-sleutels (toegevoegd door CT/regie-agent, zie HANDOFF-UI) —
  'game.round': 'Ronde',
  'game.sending': 'Versturen…',
  'game.received': 'Antwoord ontvangen',
  'game.tooLate': 'Te laat — deze ronde telt niet meer',
  'game.notAccepted': 'Niet gelukt, probeer opnieuw',
  'game.answered': 'beantwoord',
  'game.correctAnswer': 'Het juiste antwoord',
  'game.youWereRight': 'Goed!',
  'game.youWereWrong': 'Helaas, fout',
  'game.yourScore': 'Jouw punten',
  'standings.title': 'Tussenstand',
  'standings.you': 'Jij',
  'podium.title': 'Eindstand',
  'podium.first': '🥇',
  'podium.second': '🥈',
  'podium.third': '🥉',
  'podium.rematch': 'Nog een keer!',
  'podium.waitForHost': 'Wachten tot de host een nieuwe game start…',
});
