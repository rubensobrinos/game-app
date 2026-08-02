// locales/en.mjs — UI1. English translations for every key that currently
// exists (UI0/UI1's home+join screens, plus the UI3/UI4 keys already added
// ahead of their DOM screens). Screens still to be built (UI2/UI5) add their
// own keys here when they land — this file no longer needs to wait for a
// dedicated "UI1b" pass, it grows alongside nl.mjs from now on.

export const en = Object.freeze({
  'app.title': 'Play Aseso',
  'scaffold.ready': 'Frontend scaffold ready — screens follow in UI1–UI5.',

  'menu.open': 'Menu',
  'menu.language': 'Language',
  'menu.theme': 'Theme',
  'menu.themeDark': 'Dark',
  'menu.themeLight': 'Light',

  'home.title': 'Play Aseso',
  'home.quickStart': 'Quick start',
  'home.divider': 'or',
  'home.codeLabel': 'Got a code?',
  'home.codePlaceholder': '123456',
  'home.codeSubmit': 'Join with code',
  'home.codeInvalid': 'Enter a 6-digit code',
  'join.title': 'Join',
  'join.previewing': 'Loading…',
  'join.submitting': 'Joining…',
  'join.nameLabel': 'Your name (optional)',
  'join.namePlaceholder': 'e.g. Tom',
  'join.submit': 'Join',
  'join.retry': 'Try again',
  'join.joined': 'Joined!',

  'game.round': 'Round',
  'game.sending': 'Sending…',
  'game.received': 'Answer received',
  'game.tooLate': 'Too late — this round no longer counts',
  'game.notAccepted': 'Not accepted, try again',
  'game.answered': 'answered',
  'game.correctAnswer': 'The correct answer',
  'game.youWereRight': 'Correct!',
  'game.youWereWrong': 'Sorry, wrong',
  'game.yourScore': 'Your score',
  'standings.title': 'Standings',
  'standings.you': 'You',
  'podium.title': 'Final standings',
  'podium.first': '🥇',
  'podium.second': '🥈',
  'podium.third': '🥉',
  'podium.rematch': 'Play again!',
  'podium.waitForHost': 'Waiting for the host to start a new game…',
});
