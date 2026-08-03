// locales/nl.mjs — UI0. NL is leidend voor deze fase (EN/ES volgen in UI1b).
// Plat `{ key: string }`-object, zelfde patroon als de singleplayer-app se
// `T['nl']` in `app.js`. Geen enkel scherm is hier al gevuld — deze paar
// sleutels dienen alleen om de i18n-bedrading zelf (`applyI18n()`,
// `data-i18n`) aan te tonen in `js/app.mjs`.

export const nl = Object.freeze({
  'app.title': 'Rounda',
  'scaffold.ready': 'Frontend-scaffold gereed — schermen volgen in UI1–UI5.',

  // — Hamburgermenu (taal van de app zelf, niet de vraagtaal — die zit in
  // host-setup-state's config.language) + licht/donker-thema —
  'menu.open': 'Menu',
  'menu.language': 'Taal',
  'menu.theme': 'Thema',
  'menu.themeDark': 'Donker',
  'menu.themeLight': 'Licht',

  // — UI1-sleutels (Home + Preview/join) —
  'home.title': 'Rounda',
  'home.promise': 'Geen account. Geen download. Iedereen speelt op zijn eigen telefoon.',
  'home.quickStart': 'Start direct een game',
  'home.creating': 'Potje maken…',
  'home.divider': 'of',
  'home.codeLabel': 'Voer de gamecode in',
  'home.codePlaceholder': '123456',
  'home.codeSubmit': 'Meedoen met code',
  'home.codeInvalid': 'Vul een code van 6 cijfers in',
  'home.hostSetupLink': 'Spel aanpassen',

  // — S02: Spel aanpassen (host-setup.mjs) —
  'hostSetup.back': 'Terug',
  'hostSetup.title': 'Spel aanpassen',
  'hostSetup.start': 'Start met deze instellingen',
  'hostSetup.reset': 'Herstel standaardinstellingen',
  'hostSetup.gameTypeGroup': 'Spelvorm',
  'hostSetup.gameTypeFixed': 'Vlaggen (meerkeuze) — enige beschikbare spelvorm voor nu',
  'hostSetup.contentGroup': 'Moeilijkheid en taal',
  'hostSetup.difficultyLabel': 'Moeilijkheid',
  'hostSetup.difficulty.easy': 'Makkelijk',
  'hostSetup.difficulty.normal': 'Normaal',
  'hostSetup.difficulty.hard': 'Moeilijk',
  'hostSetup.difficulty.extreme': 'Extreem',
  'hostSetup.languageLabel': 'Vraagtaal',
  'hostSetup.language.nl': 'Nederlands',
  'hostSetup.language.en': 'Engels',
  'hostSetup.language.es': 'Spaans',
  'hostSetup.roundsGroup': 'Aantal rondes',
  'hostSetup.roundsLabel': 'Aantal rondes',
  'hostSetup.modeGroup': 'Spelmodus',
  'hostSetup.modeFixed': 'Individuele modus — teams zijn nog niet beschikbaar',
  'hostSetup.rulesGroup': 'Aanvullende regels',
  'hostSetup.pacingLabel': 'Tempo',
  'hostSetup.pacing.auto': 'Automatisch',
  'hostSetup.pacing.host': 'Host bepaalt het tempo',
  'hostSetup.speedBonusLabel': 'Snelheidsbonus',
  'hostSetup.allowLateJoinLabel': 'Laat spelers later nog meedoen',
  'hostSetup.hostParticipatesLabel': 'Ik doe zelf ook mee',

  'join.title': 'Meedoen',
  'join.previewing': 'Bezig met ophalen…',
  'join.submitting': 'Bezig met meedoen…',
  'join.nameLabel': 'Hoe noemen we je?',
  // Zichtbare aanwijzing dat de naam optioneel blijft — "Hoe noemen we je?"
  // klinkt op zichzelf als een verplicht veld (reviewfeedback T4-1 punt 6).
  'join.nameOptionalHint': 'Optioneel — laat leeg voor een voorgestelde naam.',
  // Telbaar via `tCount('join.waitingCount', n)` — alleen ná een
  // uitnodigingslink, een gamecode heeft geen preview met spelersaantal.
  'join.waitingCount.one': '{n} speler wacht al',
  'join.waitingCount.other': '{n} spelers wachten al',
  'join.namePlaceholder': 'bv. Tom',
  'join.submit': 'Meedoen',
  'join.retry': 'Opnieuw proberen',
  'join.joined': 'Meegedaan!',

  // — UI3/UI4-sleutels (toegevoegd door CT/regie-agent, zie HANDOFF-UI) —
  'game.screenTitle': 'Spelscherm',
  'game.flagAlt': 'Te raden vlag',
  'game.questionPrompt': 'Welke vlag is dit?',
  'game.round': 'Ronde',
  'game.secondsLeft': 'seconden te gaan',
  'game.sending': 'Versturen…',
  'game.received': 'Antwoord ontvangen',
  'game.tooLate': 'Te laat — deze ronde telt niet meer',
  'game.notAccepted': 'Niet gelukt, probeer opnieuw',
  'game.answered': 'beantwoord',
  'game.correctAnswer': 'Het juiste antwoord',
  // Resultaatstempel (09-CONTENT-AND-MICROCOPY.md §9): drie gelijkwaardige
  // staten via één component, hoofdletters via CSS (text-transform) — niet
  // in de vertaalwaarde zelf, dat is beter lokaliseerbaar.
  'game.resultCorrect': 'Juist',
  'game.resultIncorrect': 'Onjuist',
  'game.resultNoAnswer': 'Geen antwoord',
  // M2/E09: sr-only-label op de foute eigen keuze — naast de kleur/icoon,
  // niet in plaats van (11 K: kleur nooit de enige informatiedrager).
  'game.ownAnswer': 'Jouw antwoord',
  'game.roundPoints': 'Punten deze ronde',
  // S14: sociale headline, hooguit één per ronde (gameplay.mjs) / stand
  // (scoreboard.mjs) — zie social-headline.mjs voor de selectielogica.
  'headline.selfSoleCorrect': 'Jij was de enige met het juiste antwoord! ⭐',
  'headline.everyoneCorrect': 'Iedereen had het goed! 🎉',
  'headline.everyoneWrong': 'Niemand had het goed deze ronde!',
  'headline.misleadingAnswer': 'Veel spelers dachten dat het {country} was!',
  'headline.comeback': '{naam} klimt {n} plaatsen! 📈',
  'standings.title': 'Tussenstand',
  'standings.you': 'Jij',
  'standings.moveUp.one': '{n} plaats gestegen',
  'standings.moveUp.other': '{n} plaatsen gestegen',
  'standings.moveDown.one': '{n} plaats gedaald',
  'standings.moveDown.other': '{n} plaatsen gedaald',
  'standings.moveSame': 'Geen verandering',
  'standings.sharedPlace': 'Gedeelde plaats',
  // S15: aria-label bij de bewegingsbadge (↑/↓/—) — de badge zelf is beknopt
  // beeldschrift, dit is wat een screenreader in plaats daarvan voorleest.
  'standings.moveUp.one': '{n} plaats gestegen',
  'standings.moveUp.other': '{n} plaatsen gestegen',
  'standings.moveDown.one': '{n} plaats gedaald',
  'standings.moveDown.other': '{n} plaatsen gedaald',
  'standings.moveSame': 'Geen verandering',
  'podium.title': 'Eindstand',
  'podium.first': '🥇',
  'podium.second': '🥈',
  'podium.third': '🥉',
  'podium.rematch': 'Revanche',
  'podium.waitForHost': 'Wachten tot de host een nieuwe game start…',
  'podium.newGame': 'Nieuw spel',
  'podium.share': 'Deel uitslag',
  // Deel uitslag (03 §4.5): uitsluitend de eigen score/positie, privacy-
  // vriendelijk — nooit andermans naam of score, geen roomcode/link.
  'podium.shareWon': 'Ik heb net Rounda gewonnen met {score} punten! 🏆',
  'podium.shareResult': 'Ik scoorde {score} punten in Rounda!',
  'podium.shareGeneric': 'We speelden net Rounda!',
  'podium.close': 'Afsluiten',

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
  'connection.connected': 'We zijn weer verbonden.',
  'connection.answerSaved': 'Je antwoord blijft bewaard.',

  // — Pauzeredenen (DECISIONS.md #11 via messageForPauseReason) —
  'pause.host': 'Gepauzeerd door de host',
  'pause.host_disconnected': 'Gepauzeerd — de host is de verbinding kwijt',
  'pause.no_answers': 'Gepauzeerd — niemand heeft geantwoord',
  'pause.server_recovery': 'Gepauzeerd — de server herstelt zich',
  'pause.unknown': 'Gepauzeerd',
  // Hoofdletters via CSS (text-transform), niet in de vertaalwaarde — zelfde
  // regel als de resultaatstempels (T4-3).
  'pause.hostStamp': 'Game gepauzeerd',

  // — Sessie-beëindiging (messageForSessionTermination) —
  'session.kicked': 'Je bent verwijderd door de host.',
  'session.pause': 'Pauzeer',
  'session.resume': 'Hervat',
  'session.revoked': 'Je sessie is beëindigd.',
  'session.unknown': 'Je bent losgekoppeld.',
  'session.backToStart': 'Terug naar start',
  'session.terminatedTitle': 'Sessie beëindigd',
  'session.duplicateTab': 'Deze game staat ook open in een ander tabblad. Dit tabblad kan een verouderde stand tonen.',

  // — UI5: Hostbalk (lock/kick/finish/next; pauze zit hierboven) —
  'hostbar.lock': 'Room vergrendelen',
  'hostbar.unlock': 'Room ontgrendelen',
  'hostbar.next': 'Volgende',
  'hostbar.finish': 'Game beëindigen',
  'hostbar.finishConfirm': 'Weet je zeker dat je het potje wilt beëindigen?',
  'hostbar.players': 'Spelers beheren',
  'hostbar.kick': 'Verwijder',
  'hostbar.kickConfirmPrefix': 'Verwijderen uit deze game:',

  // — UI2: Lobby + Delen —
  'room.scanToJoin': 'Scan om mee te doen',
  'lobby.title': 'Lobby',
  'lobby.waiting': 'Wachten tot de host start…',
  'lobby.emptyTitle': 'Nog niemand binnen',
  'lobby.emptyHint': 'Laat iemand de QR scannen om te beginnen.',
  'lobby.locked': 'Room vergrendeld',
  'lobby.unlocked': 'Nieuwe spelers kunnen weer meedoen',
  'lobby.playerJoined': 'Je bent binnen',
  'lobby.playerWaitingForHost': 'De host start zo',
  'lobby.playerInviteHint': 'Nodig iemand uit',
  'lobby.playerSelf': 'Je speelt als {naam}',
  'lobby.recentJoins': 'Recent binnengekomen',
  'lobby.viewAllShow': 'Bekijk alle spelers',
  'lobby.viewAllHide': 'Verberg volledige lijst',
  // Telbaar via `tCount('lobby.playerCount', n)` — `{n}` wordt ingevuld.
  'lobby.playerCount.one': '{n} speler',
  'lobby.playerCount.other': '{n} spelers',
  'lobby.share': 'Uitnodigen',
  'lobby.shareQr': 'Toon QR-code',
  'lobby.shareNative': 'Delen',
  'lobby.shareCopy': 'Kopieer link',
  'lobby.copied': 'Gekopieerd!',
  'lobby.copyFailed': 'Kopiëren lukte niet — selecteer en kopieer handmatig',
  'lobby.code': 'Code',
  'lobby.back': 'Terug',
  'lobby.start': 'Start Rounda',
});
