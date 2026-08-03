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
  'game.screenTitle': 'Spelscherm',
  'game.flagAlt': 'Te raden vlag',
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

  // — Foutmeldingen: sleutel = `edge-case-messaging.messageForErrorCode()`'s
  // teruggegeven code, vertaald hier. PROTOCOL.md's volledige foutcodetabel. —
  'error.GAME_NOT_FOUND': 'Deze game bestaat niet (meer).',
  'error.INVITE_INVALID': 'Deze uitnodiging is ongeldig.',
  'error.GAME_FULL': 'Deze game zit vol.',
  'error.GAME_ALREADY_STARTED': 'Deze game is al begonnen.',
  'error.LATE_JOIN_DISABLED': 'Deze game is al begonnen en laat geen nieuwe spelers meer toe.',
  'error.ROOM_LOCKED': 'Deze game is vergrendeld door de host.',
  'error.CODE_RATE_LIMITED': 'Te veel pogingen. Probeer het zo weer.',
  'error.TOKEN_INVALID': 'Je sessie is niet (meer) geldig.',
  'error.TOKEN_EXPIRED': 'Je sessie is verlopen.',
  'error.SESSION_REVOKED': 'Je sessie is beëindigd.',
  'error.NOT_HOST': 'Alleen de host kan dit doen.',
  'error.NOT_PLAYER': 'Alleen spelers kunnen dit doen.',
  'error.INVALID_PHASE': 'Dat kan nu niet.',
  'error.ROUND_NOT_ACTIVE': 'Er is nu geen actieve ronde.',
  'error.PLAYER_NOT_ELIGIBLE': 'Je doet nog niet mee aan deze ronde.',
  'error.ALREADY_ANSWERED': 'Je hebt deze ronde al beantwoord.',
  'error.DEADLINE_PASSED': 'Te laat — deze ronde is voorbij.',
  'error.INVALID_ANSWER_FORMAT': 'Dat antwoord kon niet verstuurd worden.',
  'error.UNSUPPORTED_EVENT': 'Dat wordt nu niet ondersteund.',
  'error.NAME_TOO_LONG': 'Die naam is te lang.',
  'error.NAME_INVALID': 'Die naam is niet geldig.',
  'error.RATE_LIMITED': 'Te veel pogingen. Wacht even.',
  'error.PROTOCOL_VERSION_UNSUPPORTED': 'Je app is verouderd — ververs de pagina.',
  'error.UNKNOWN_ERROR': 'Er ging iets mis. Probeer het opnieuw.',

  // — Verbindingsstatus (reconnect-state.mjs via messageForConnectionStatus) —
  'connection.disconnected': 'Verbinding verbroken…',
  'connection.reconnecting': 'Opnieuw verbinden…',

  // — Pauzeredenen (DECISIONS.md #11 via messageForPauseReason) —
  'pause.host': 'Gepauzeerd door de host',
  'pause.host_disconnected': 'Gepauzeerd — de host is de verbinding kwijt',
  'pause.no_answers': 'Gepauzeerd — niemand heeft geantwoord',
  'pause.server_recovery': 'Gepauzeerd — de server herstelt zich',
  'pause.unknown': 'Gepauzeerd',

  // — Sessie-beëindiging (messageForSessionTermination) —
  'session.kicked': 'Je bent verwijderd door de host.',
  'session.pause': 'Pauzeer',
  'session.resume': 'Hervat',
  'session.revoked': 'Je sessie is beëindigd.',
  'session.unknown': 'Je bent losgekoppeld.',

  // — UI5: Hostbalk (lock/kick/finish/next; pauze zit hierboven) —
  'hostbar.lock': 'Vergrendel',
  'hostbar.unlock': 'Ontgrendel',
  'hostbar.next': 'Volgende',
  'hostbar.finish': 'Beëindig',
  'hostbar.finishConfirm': 'Deze game nu beëindigen voor iedereen?',
  'hostbar.players': 'Spelers beheren',
  'hostbar.kick': 'Verwijder',
  'hostbar.kickConfirmPrefix': 'Verwijderen uit deze game:',

  // — UI2: Lobby + Delen —
  'lobby.title': 'Lobby',
  'lobby.waiting': 'Wachten tot de host start…',
  'lobby.players': 'spelers',
  'lobby.share': 'Uitnodigen',
  'lobby.shareQr': 'Toon QR-code',
  'lobby.shareNative': 'Delen',
  'lobby.shareCopy': 'Kopieer link',
  'lobby.shareCode': 'Toon code',
  'lobby.copied': 'Gekopieerd!',
  'lobby.copyFailed': 'Kopiëren lukte niet — selecteer en kopieer handmatig',
  'lobby.code': 'Code',
  'lobby.back': 'Terug',
  'lobby.start': 'Start de game',
});
