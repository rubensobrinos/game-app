/* ════════════════════════════════════════════
   TRANSLATIONS
════════════════════════════════════════════ */
const T = {
  nl: {
    appTitle:             'Game App',
    flagGame:             'Vlaggen Quiz',
    logoGame:             'Logo Quiz',
    geoGame:              'Geo Quiz',
    comingSoon:           'Binnenkort',
    settingLanguage:      'Taal',
    settingDifficulty:    'Moeilijkheidsgraad',
    settingMode:          'Modus',
    settingTeams:         'Teamnamen',
    settingReveal:        'Naam tonen',
    settingNext:          'Volgende vlag',
    settingNextLogo:      'Volgend logo',
    settingSpeed:         'Snelheid',
    settingCount:         'Aantal vlaggen',
    settingCountLogo:     "Aantal logo's",
    easy:                 'Gemakkelijk',
    medium:               'Normaal',
    hard:                 'Moeilijk',
    extreme:              'Extreem',
    solo:                 '1 Speler',
    team:                 'Team vs Team',
    teamALabel:           'Team A',
    teamBLabel:           'Team B',
    auto:                 'Automatisch',
    manual:               'Handmatig',
    start:                'Starten',
    guessPlaceholder:     'Wat is dit land?',
    guessLogoPlaceholder: 'Welk merk is dit?',
    turnIs:               ' is aan de beurt',
    showName:             'Toon naam',
    nextFlag2:            'Volgende →',
    quickSettings:        'Snel instellen',
    restart:              'Opnieuw',
    toSettings:           'Instellingen',
    quitToMenu:           'Hoofdmenu',
    resultsTitle:         'Resultaten',
    playAgain:            'Opnieuw spelen',
    toMenu:               'Terug naar menu',
    wins:                 'wint! 🏆',
    tie:                  'Gelijkspel! 🤝',
    realOrFakeGame:        'Echt of Nep?',
    btnReal:               'Echte vlag',
    btnFake:               'AI vlag',
    realOrFakeRevealReal:  'Echte vlag —',
    realOrFakeRevealFake:  'AI-gegenereerde vlag',
    settingCountRealOrFake:'Aantal ronden',
    settingNextRealOrFake: 'Volgende ronde',
    settingInputMode:      'Invoermethode',
    inputModeType:         'Typen',
    inputModeChoice:       'Meerkeuze',
    inputModeFlashcard:    'Typloos',
    settingChoices:        'Aantal keuzes',
    btnWrong:              '❌ Fout!',
    btnRight:              '✅ Goed!',
    stAuto:                'Auto',
    stManual:              'Hand',
    settingComments:       'Opmerkingen',
    stOn:                  'Aan',
    stOff:                 'Uit',
    settingRotation:       'Max. rotatie',
    capitalsGame:          'Hoofdsteden Quiz',
    footballGame:          "Voetballogo's",
    logoRealOrFakeGame:    'Logo: Echt of Nep?',
    higherLowerGame:       'Hoger of Lager',
    oddOneOutGame:         'Buitenbeentje',
    guessCapitalPlaceholder: 'Wat is de hoofdstad?',
    guessClubPlaceholder:  'Welke club is dit?',
    settingMetric:         'Vergelijk op',
    metricPopulation:      'Inwoners',
    metricArea:            'Oppervlak',
    metricGdp:             'BBP',
    settingCountCountry:   'Aantal landen',
    settingCountClub:      'Aantal clubs',
    settingCountRounds:    'Aantal rondes',
    btnRealLogo:           'Echt logo',
    btnFakeLogo:           'Nep logo',
    logoRealReveal:        'Echt logo —',
    logoFakeReveal:        'Nep logo (AI)',
    hlQuestionPopulation:  'Welk land heeft meer inwoners?',
    hlQuestionArea:        'Welk land is groter in oppervlak?',
    hlQuestionGdp:         'Welk land heeft een hoger BBP?',
    hlUnitPopulation:      'inwoners',
    hlUnitArea:            'km²',
    hlUnitGdp:             'mld $',
    oddQuestion:           'Welke hoort er niet bij?',
    oddNotBelong:          'hoort er niet bij',
    oddOthersIn:           'De andere liggen in',
    oddStartWith:          'De andere beginnen met',
    geoRecordsGame:        'Records',
    newRecord:             '🎉 Nieuw record!',
    bestScore:             'Beste',
    settingVisual:         'Weergave',
    visualFlags:           'Vlaggen',
    visualGeo:             'Silhouetten',
    settingTheme:          "Thema's",
    themeAll:              'Alles',
    settingCategory:       'Categorie',
    correctComments:  ['Geweldig! 🎯','Lekker bezig! 🔥','Top! ✨','Ja! 💪','Knap hoor! 🌟','Raak! 🎪','Yes! 🎉','Mooi zo! 👏','Goed! ⚡','Netjes! 😎','Schitterend! 💎','Dat klopt! 🚀','Boom! 💥','Boom! 🎊','Precies! 🏹'],
    wrongComments:    ['Oef! 😅','Helaas! 💔','Bijna! 🤔','Niet helemaal! 🙈','Au! 😵','Volgende keer! 💪','Toch niet... 😬','Hmm! 🤷','Zo dicht! 😬','Jammer! 🫠'],
    streakComments:   {
      2:  ['Dubbel! 🔥🔥','Twee op een rij! ✌️','Weer goed! 🎯','Dat was raak! ⚡','Vuur! 🔥','Lekker! 💪'],
      3:  ['Hattrick! 🔥🔥🔥','Drie achter elkaar! 🎪','Op dreef! 🚀','Niet te stoppen! 💥','Derde keer goed! 🎯','Doordender! 💎'],
      4:  ['Vier op een rij! 🔥','Waanzin! 🤯','Op rolletjes! 🎢','Vier stuks! ✨','Dit is jouw avond! 🌟','Knallend! 💥'],
      5:  ['VIJF OP EEN RIJ! 🏆','Fenomenaal! 👑','Wie ben jij?! 🤯','Vijf goed! 🔥🔥🔥🔥🔥','Expert alert! 🚨','Spectaculair! 🎉'],
      7:  ['Onstopbaar! 👑','Zeven! Dit meen je niet! 😱','Legendarisch! 🏆','Je bent in de zone! ⚡','Ben je een robot?! 🤖','Ongelooflijk! 🌟'],
      10: ['TIEN OP EEN RIJ! 🤯','Zijn jij stiekem een prof?! 👀','God mode! 👾','Dit kan toch niet! 😭','Iemand checken of ze spieken! 🔍','TIEN!! 🏆🏆🏆'],
    },
    streakBroken:     ['Streak van {n} verbroken! 😭','Au, weg is de streak van {n}! 💔','Oef, na {n} goed... 😬','Streak van {n} sneuvelt! 🫠','En daar gaat streak {n}! 😅'],
    scorePhrases: [
      { min: 100, emoji: '🏆', text: 'Perfect! Jij bent een ware expert!' },
      { min: 80,  emoji: '🤩', text: 'Uitstekend! Bijna alles goed!' },
      { min: 60,  emoji: '😄', text: 'Goed gedaan! Meer dan de helft goed!' },
      { min: 40,  emoji: '😅', text: 'Niet slecht, maar er valt nog wat te leren.' },
      { min: 20,  emoji: '😬', text: 'Oef... nog wat oefenen!' },
      { min: 0,   emoji: '💀', text: 'Wacht, heb jij de vragen wel gezien?' },
    ],
  },
  en: {
    appTitle:             'Game App',
    flagGame:             'Flag Quiz',
    logoGame:             'Logo Quiz',
    geoGame:              'Geo Quiz',
    comingSoon:           'Coming Soon',
    settingLanguage:      'Language',
    settingDifficulty:    'Difficulty',
    settingMode:          'Mode',
    settingTeams:         'Team Names',
    settingReveal:        'Name reveal',
    settingNext:          'Next flag',
    settingNextLogo:      'Next logo',
    settingSpeed:         'Speed',
    settingCount:         'Number of flags',
    settingCountLogo:     'Number of logos',
    easy:                 'Easy',
    medium:               'Medium',
    hard:                 'Hard',
    extreme:              'Extreme',
    solo:                 '1 Player',
    team:                 'Team vs Team',
    teamALabel:           'Team A',
    teamBLabel:           'Team B',
    auto:                 'Automatic',
    manual:               'Manual',
    start:                'Start',
    guessPlaceholder:     'What country is this?',
    guessLogoPlaceholder: 'What brand is this?',
    turnIs:               ' is up',
    showName:             'Show name',
    nextFlag2:            'Next →',
    quickSettings:        'Quick settings',
    restart:              'Restart',
    toSettings:           'Settings',
    quitToMenu:           'Main menu',
    resultsTitle:         'Results',
    playAgain:            'Play again',
    toMenu:               'Back to menu',
    wins:                 'wins! 🏆',
    tie:                  "It's a tie! 🤝",
    realOrFakeGame:        'Real or Fake?',
    btnReal:               'Real flag',
    btnFake:               'AI flag',
    realOrFakeRevealReal:  'Real flag —',
    realOrFakeRevealFake:  'AI-generated flag',
    settingCountRealOrFake:'Number of rounds',
    settingNextRealOrFake: 'Next round',
    settingInputMode:      'Input method',
    inputModeType:         'Type',
    inputModeChoice:       'Multiple choice',
    inputModeFlashcard:    'No typing',
    settingChoices:        'Number of choices',
    btnWrong:              '❌ Wrong!',
    btnRight:              '✅ Correct!',
    stAuto:                'Auto',
    stManual:              'Manual',
    settingComments:       'Comments',
    stOn:                  'On',
    stOff:                 'Off',
    settingRotation:       'Max. rotation',
    capitalsGame:          'Capitals Quiz',
    footballGame:          'Football Logos',
    logoRealOrFakeGame:    'Logo: Real or Fake?',
    higherLowerGame:       'Higher or Lower',
    oddOneOutGame:         'Odd One Out',
    guessCapitalPlaceholder: 'What is the capital?',
    guessClubPlaceholder:  'Which club is this?',
    settingMetric:         'Compare by',
    metricPopulation:      'Population',
    metricArea:            'Area',
    metricGdp:             'GDP',
    settingCountCountry:   'Number of countries',
    settingCountClub:      'Number of clubs',
    settingCountRounds:    'Number of rounds',
    btnRealLogo:           'Real logo',
    btnFakeLogo:           'Fake logo',
    logoRealReveal:        'Real logo —',
    logoFakeReveal:        'Fake logo (AI)',
    hlQuestionPopulation:  'Which country has more people?',
    hlQuestionArea:        'Which country is larger by area?',
    hlQuestionGdp:         'Which country has a higher GDP?',
    hlUnitPopulation:      'people',
    hlUnitArea:            'km²',
    hlUnitGdp:             'bn $',
    oddQuestion:           "Which one doesn't belong?",
    oddNotBelong:          "doesn't belong",
    oddOthersIn:           'The others are in',
    oddStartWith:          'The others start with',
    geoRecordsGame:        'Records',
    newRecord:             '🎉 New record!',
    bestScore:             'Best',
    settingVisual:         'Display',
    visualFlags:           'Flags',
    visualGeo:             'Silhouettes',
    settingTheme:          'Themes',
    themeAll:              'All',
    settingCategory:       'Category',
    correctComments:  ['Amazing! 🎯','Nice one! 🔥','Top! ✨','Yes! 💪','Impressive! 🌟','Nailed it! 🎪','Boom! 🎉','Well done! 👏','Correct! ⚡','Smooth! 😎','Brilliant! 💎','That\'s right! 🚀','Spot on! 🏹','Crushing it! 💥','Legend! 🎊'],
    wrongComments:    ['Oops! 😅','Too bad! 💔','Almost! 🤔','Not quite! 🙈','Ouch! 😵','Next time! 💪','Nope! 😬','Hmm! 🤷','So close! 😬','Unlucky! 🫠'],
    streakComments:   {
      2:  ['Double! 🔥🔥','Two in a row! ✌️','Again! 🎯','Nailed it again! ⚡','On fire! 🔥','Let\'s go! 💪'],
      3:  ['Hat trick! 🔥🔥🔥','Three straight! 🎪','On a roll! 🚀','Can\'t stop you! 💥','Three for three! 🎯','Steamrolling! 💎'],
      4:  ['Four in a row! 🔥','Insane! 🤯','Rolling! 🎢','Four clean! ✨','Your night! 🌟','Blazing! 💥'],
      5:  ['FIVE IN A ROW! 🏆','Phenomenal! 👑','Who are you?! 🤯','Five correct! 🔥🔥🔥🔥🔥','Expert alert! 🚨','Spectacular! 🎉'],
      7:  ['Unstoppable! 👑','Seven! You\'re kidding! 😱','Legendary! 🏆','In the zone! ⚡','Are you a robot?! 🤖','Unbelievable! 🌟'],
      10: ['TEN IN A ROW! 🤯','Are you secretly a pro?! 👀','God mode! 👾','This can\'t be real! 😭','Is someone peeking?! 🔍','TEN!! 🏆🏆🏆'],
    },
    streakBroken:     ['Streak of {n} broken! 😭','Oof, streak of {n} gone! 💔','After {n} correct... 😬','Streak of {n} falls! 🫠','There goes streak {n}! 😅'],
    scorePhrases: [
      { min: 100, emoji: '🏆', text: "Perfect! You're a true expert!" },
      { min: 80,  emoji: '🤩', text: 'Excellent! Almost perfect!' },
      { min: 60,  emoji: '😄', text: 'Well done! More than half right!' },
      { min: 40,  emoji: '😅', text: "Not bad, but there's room to improve." },
      { min: 20,  emoji: '😬', text: 'Oops... keep practicing!' },
      { min: 0,   emoji: '💀', text: 'Wait, did you even look at the questions?' },
    ],
  },
  es: {
    appTitle:             'Game App',
    flagGame:             'Quiz de Banderas',
    logoGame:             'Quiz de Logos',
    geoGame:              'Quiz Geo',
    comingSoon:           'Próximamente',
    settingLanguage:      'Idioma',
    settingDifficulty:    'Dificultad',
    settingMode:          'Modo',
    settingTeams:         'Nombres de equipo',
    settingReveal:        'Mostrar nombre',
    settingNext:          'Siguiente bandera',
    settingNextLogo:      'Siguiente logo',
    settingSpeed:         'Velocidad',
    settingCount:         'Número de banderas',
    settingCountLogo:     'Número de logos',
    easy:                 'Fácil',
    medium:               'Normal',
    hard:                 'Difícil',
    extreme:              'Extremo',
    solo:                 '1 Jugador',
    team:                 'Equipo vs Equipo',
    teamALabel:           'Equipo A',
    teamBLabel:           'Equipo B',
    auto:                 'Automático',
    manual:               'Manual',
    start:                'Iniciar',
    guessPlaceholder:     '¿Qué país es este?',
    guessLogoPlaceholder: '¿Qué marca es esta?',
    turnIs:               ' es su turno',
    showName:             'Mostrar nombre',
    nextFlag2:            'Siguiente →',
    quickSettings:        'Ajustes rápidos',
    restart:              'Reiniciar',
    toSettings:           'Ajustes',
    quitToMenu:           'Menú principal',
    resultsTitle:         'Resultados',
    playAgain:            'Jugar de nuevo',
    toMenu:               'Volver al menú',
    wins:                 '¡gana! 🏆',
    tie:                  '¡Empate! 🤝',
    realOrFakeGame:        '¿Real o Falsa?',
    btnReal:               'Bandera real',
    btnFake:               'Bandera IA',
    realOrFakeRevealReal:  'Bandera real —',
    realOrFakeRevealFake:  'Bandera generada por IA',
    settingCountRealOrFake:'Número de rondas',
    settingNextRealOrFake: 'Siguiente ronda',
    settingInputMode:      'Método de entrada',
    inputModeType:         'Escribir',
    inputModeChoice:       'Opción múltiple',
    inputModeFlashcard:    'Sin escribir',
    settingChoices:        'Número de opciones',
    btnWrong:              '❌ ¡Incorrecto!',
    btnRight:              '✅ ¡Bien!',
    stAuto:                'Auto',
    stManual:              'Manual',
    settingComments:       'Comentarios',
    stOn:                  'Sí',
    stOff:                 'No',
    settingRotation:       'Rotación máx.',
    capitalsGame:          'Quiz de Capitales',
    footballGame:          'Logos de Fútbol',
    logoRealOrFakeGame:    'Logo: ¿Real o Falso?',
    higherLowerGame:       'Mayor o Menor',
    oddOneOutGame:         'El Intruso',
    guessCapitalPlaceholder: '¿Cuál es la capital?',
    guessClubPlaceholder:  '¿Qué club es este?',
    settingMetric:         'Comparar por',
    metricPopulation:      'Población',
    metricArea:            'Superficie',
    metricGdp:             'PIB',
    settingCountCountry:   'Número de países',
    settingCountClub:      'Número de clubes',
    settingCountRounds:    'Número de rondas',
    btnRealLogo:           'Logo real',
    btnFakeLogo:           'Logo falso',
    logoRealReveal:        'Logo real —',
    logoFakeReveal:        'Logo falso (IA)',
    hlQuestionPopulation:  '¿Qué país tiene más habitantes?',
    hlQuestionArea:        '¿Qué país es más grande en superficie?',
    hlQuestionGdp:         '¿Qué país tiene un PIB mayor?',
    hlUnitPopulation:      'habitantes',
    hlUnitArea:            'km²',
    hlUnitGdp:             'mm $',
    oddQuestion:           '¿Cuál no encaja?',
    oddNotBelong:          'no encaja',
    oddOthersIn:           'Los demás están en',
    oddStartWith:          'Los demás empiezan por',
    geoRecordsGame:        'Récords',
    newRecord:             '🎉 ¡Nuevo récord!',
    bestScore:             'Mejor',
    settingVisual:         'Vista',
    visualFlags:           'Banderas',
    visualGeo:             'Siluetas',
    settingTheme:          'Temas',
    themeAll:              'Todos',
    settingCategory:       'Categoría',
    correctComments:  ['¡Genial! 🎯','¡Bien! 🔥','¡Exacto! ✨','¡Sí! 💪','¡Impresionante! 🌟','¡Correcto! 🎪','¡Boom! 🎉','¡Bien hecho! 👏','¡Acertado! ⚡','¡Suave! 😎','¡Brillante! 💎','¡Eso es! 🚀','¡En el blanco! 🏹','¡Aplastante! 💥','¡Leyenda! 🎊'],
    wrongComments:    ['¡Vaya! 😅','¡Lástima! 💔','¡Casi! 🤔','¡No del todo! 🙈','¡Ay! 😵','¡La próxima! 💪','¡No! 😬','¡Hmm! 🤷','¡Tan cerca! 😬','¡Mala suerte! 🫠'],
    streakComments:   {
      2:  ['¡Doble! 🔥🔥','¡Dos seguidos! ✌️','¡Otra vez! 🎯','¡De nuevo! ⚡','¡En llamas! 🔥','¡Vamos! 💪'],
      3:  ['¡Hat trick! 🔥🔥🔥','¡Tres seguidos! 🎪','¡Rodando! 🚀','¡Imparable! 💥','¡Tres de tres! 🎯','¡Arrasando! 💎'],
      4:  ['¡Cuatro seguidos! 🔥','¡Locura! 🤯','¡Sin parar! 🎢','¡Cuatro limpios! ✨','¡Tu noche! 🌟','¡Brutal! 💥'],
      5:  ['¡CINCO SEGUIDOS! 🏆','¡Fenomenal! 👑','¿Quién eres?! 🤯','¡Cinco correctos! 🔥🔥🔥🔥🔥','¡Alerta experto! 🚨','¡Espectacular! 🎉'],
      7:  ['¡Imparable! 👑','¡Siete! ¡No puede ser! 😱','¡Legendario! 🏆','¡En la zona! ⚡','¿Eres un robot?! 🤖','¡Increíble! 🌟'],
      10: ['¡DIEZ SEGUIDOS! 🤯','¿Eres secretamente un pro?! 👀','¡Modo dios! 👾','¡Esto no puede ser real! 😭','¿Alguien está mirando?! 🔍','¡DIEZ!! 🏆🏆🏆'],
    },
    streakBroken:     ['¡Racha de {n} rota! 😭','¡Adiós racha de {n}! 💔','Tras {n} correctos... 😬','¡Cae la racha de {n}! 🫠','¡Ahí va la racha {n}! 😅'],
    scorePhrases: [
      { min: 100, emoji: '🏆', text: '¡Perfecto! ¡Eres un verdadero experto!' },
      { min: 80,  emoji: '🤩', text: '¡Excelente! ¡Casi perfecto!' },
      { min: 60,  emoji: '😄', text: '¡Bien hecho! ¡Más de la mitad correcto!' },
      { min: 40,  emoji: '😅', text: 'No está mal, pero hay margen de mejora.' },
      { min: 20,  emoji: '😬', text: '¡Uf... sigue practicando!' },
      { min: 0,   emoji: '💀', text: '¿Espera, viste las preguntas?' },
    ],
  }
};

/* ════════════════════════════════════════════
   STATE
════════════════════════════════════════════ */
const state = {
  lang:        'nl',
  studyMode:   false,   // menu toggle: false = Play, true = Study
  // 'flags' | 'logos' | 'real-or-fake' | 'capitals' | 'football'
  // | 'logo-real-or-fake' | 'higher-lower' | 'odd-one-out' | 'geo-records'
  currentGame: 'flags',
  settings: {
    difficulty:  'easy',
    mode:        'solo',
    teamNames:   ['Team A', 'Team B'],
    autoReveal:  false,
    autoNext:    false,
    flagCount:   10,
    inputMode:    'type',   // 'type' | 'choice' | 'flashcard'
    choiceCount:  4,        // 2 | 3 | 4
    metric:       'population', // higher-lower: 'population' | 'area' | 'gdp'
    showComments: false,    // enthusiastic mid-round reactions
    maxRotation:  0,        // GEO quiz: max degrees silhouette is rotated (0 = off)
    oddVisual:    'flags',  // odd-one-out: 'flags' | 'geo'
    logoThemes:   [],       // logos: selected theme keys ([] = all)
    recordCategory: 'mountains', // geo-records: which superlative category
  },
  game: {
    items:          [],
    index:          0,
    scores:         [0, 0],
    currentTeam:    0,
    phase:          'flag',   // 'flag' | 'reveal' | 'done'
    choicesPool:    [],       // full pool for choice mode
    currentChoices: [],       // choices for current round (choice mode)
    streak:         0,        // current correct streak
  }
};

let timerInterval = null;

/* ════════════════════════════════════════════
   GAME CONFIG
════════════════════════════════════════════ */
// Per-game settings labels/placeholders.
const GAME_CONFIG = {
  flags:               { title: 'flagGame',           nextLabel: 'settingNext',            countLabel: 'settingCount',          placeholder: 'guessPlaceholder' },
  logos:               { title: 'logoGame',           nextLabel: 'settingNextLogo',        countLabel: 'settingCountLogo',      placeholder: 'guessLogoPlaceholder' },
  'real-or-fake':      { title: 'realOrFakeGame',      nextLabel: 'settingNextRealOrFake',  countLabel: 'settingCountRealOrFake' },
  capitals:            { title: 'capitalsGame',        nextLabel: 'settingNext',            countLabel: 'settingCountCountry',   placeholder: 'guessCapitalPlaceholder' },
  football:            { title: 'footballGame',        nextLabel: 'settingNextLogo',        countLabel: 'settingCountClub',      placeholder: 'guessClubPlaceholder' },
  'logo-real-or-fake': { title: 'logoRealOrFakeGame',  nextLabel: 'settingNextRealOrFake',  countLabel: 'settingCountRealOrFake' },
  'higher-lower':      { title: 'higherLowerGame',     nextLabel: 'settingNextRealOrFake',  countLabel: 'settingCountRounds' },
  'odd-one-out':       { title: 'oddOneOutGame',       nextLabel: 'settingNextRealOrFake',  countLabel: 'settingCountRounds' },
  'geo-records':       { title: 'geoRecordsGame',      nextLabel: 'settingNextRealOrFake',  countLabel: 'settingCountRounds' },
  geo:                 { title: 'geoGame',             nextLabel: 'settingNext',            countLabel: 'settingCountCountry',   placeholder: 'guessPlaceholder' },
};

// Seconds the recall (flashcard) timer runs before revealing the answer.
const FLASHCARD_SECONDS = 8;

// Games without an "extreme" difficulty tier (their source data only has easy/medium/hard).
const NO_EXTREME_GAMES = ['logos', 'football', 'logo-real-or-fake'];

// Games with a binary real/fake choice (no input modes, no reveal toggle).
const ROF_GAMES    = ['real-or-fake', 'logo-real-or-fake'];
// Games with their own bespoke round UI (no input modes).
const CUSTOM_GAMES = ['higher-lower', 'odd-one-out', 'geo-records'];
// GEO quiz uses type-only input (silhouette → type the country).
const GEO_GAMES = ['geo'];

function isROFGame(g = state.currentGame)    { return ROF_GAMES.includes(g); }
function isCustomGame(g = state.currentGame) { return CUSTOM_GAMES.includes(g); }
// True for the classic type/choice/flashcard quiz games.
function isStandardGame(g = state.currentGame) { return !isROFGame(g) && !isCustomGame(g); }

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ════════════════════════════════════════════
   PERSISTENCE (localStorage)
════════════════════════════════════════════ */
const LS_SETTINGS = 'gameapp.state';
const LS_SCORES   = 'gameapp.highscores';

function saveSettings() {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify({ lang: state.lang, settings: state.settings }));
  } catch (e) { /* private mode / quota — ignore */ }
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_SETTINGS));
    if (!data) return;
    if (data.lang && T[data.lang]) state.lang = data.lang;
    if (data.settings && typeof data.settings === 'object') {
      for (const k of Object.keys(state.settings)) {
        if (k in data.settings) state.settings[k] = data.settings[k];
      }
    }
  } catch (e) { /* corrupt — ignore */ }
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(LS_SCORES)) || {}; }
  catch (e) { return {}; }
}

// Record a solo result; returns the best score + whether this beat the old record.
function recordHighScore(score, total) {
  const scores = loadScores();
  const key    = `${state.currentGame}|${state.settings.difficulty}`;
  const prev   = scores[key];
  const isRecord = prev != null && score > prev.score;
  if (prev == null || score > prev.score) {
    scores[key] = { score, total };
    try { localStorage.setItem(LS_SCORES, JSON.stringify(scores)); } catch (e) {}
  }
  const best = (prev != null && prev.score >= score) ? prev : { score, total };
  return { bestScore: best.score, bestTotal: best.total, isRecord };
}

// Image path for a quiz item, per current game.
function itemImgSrc(item) {
  switch (state.currentGame) {
    case 'logos':    return `logos/${item.slug}.svg`;
    case 'football': return `football/${item.slug}.png`;
    default:         return `flags/${item.iso2}.png`; // flags, capitals, higher-lower, odd-one-out
  }
}

const CONTINENT_LABELS = {
  'Europe':        { nl: 'Europa',         en: 'Europe',        es: 'Europa' },
  'Asia':          { nl: 'Azië',           en: 'Asia',          es: 'Asia' },
  'Africa':        { nl: 'Afrika',         en: 'Africa',        es: 'África' },
  'North America': { nl: 'Noord-Amerika',  en: 'North America', es: 'América del Norte' },
  'South America': { nl: 'Zuid-Amerika',   en: 'South America', es: 'América del Sur' },
  'Oceania':       { nl: 'Oceanië',        en: 'Oceania',       es: 'Oceanía' },
};
function localizedContinent(c) { return CONTINENT_LABELS[c]?.[state.lang] ?? c; }

function capitalName(item)       { const f = COUNTRY_FACTS[item.iso2]; return f ? f[`capital_${state.lang}`] : ''; }
function capitalRevealText(item) { return `${capitalName(item)} · ${item[`name_${state.lang}`]}`; }

// The label shown in the reveal box for the standard quiz games.
function revealLabel(item) {
  if (state.currentGame === 'capitals') return capitalRevealText(item);
  return item[`name_${state.lang}`];
}

// Reveal text for the real/fake games.
function revealROFText(item) {
  if (item.type === 'real') {
    if (state.currentGame === 'logo-real-or-fake')
      return `${t('logoRealReveal')} ${item.logo[`name_${state.lang}`]}`;
    return `${t('realOrFakeRevealReal')} ${item.country[`name_${state.lang}`]}`;
  }
  return state.currentGame === 'logo-real-or-fake' ? t('logoFakeReveal') : t('realOrFakeRevealFake');
}

function formatNumber(v) {
  return v.toLocaleString(state.lang === 'en' ? 'en-US' : state.lang === 'es' ? 'es-ES' : 'nl-NL');
}

/* ════════════════════════════════════════════
   FUZZY ANSWER CHECK
════════════════════════════════════════════ */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyThreshold(target) {
  return target.length >= 6 ? 1 : 0;
}

function checkAnswer(input, item) {
  const inp = normalize(input);
  if (!inp) return false;

  let targets, aliases;
  if (state.currentGame === 'capitals') {
    const f = COUNTRY_FACTS[item.iso2] ?? {};
    targets = [normalize(f[`capital_${state.lang}`] ?? '')];
    aliases = f.capitalAliases?.[state.lang] ?? [];
  } else {
    targets = [normalize(item[`name_${state.lang}`])];
    aliases = item.aliases?.[state.lang] ?? [];
  }
  for (const a of aliases) {
    const na = normalize(a);
    if (na) targets.push(na);
  }
  for (const tgt of targets) {
    if (!tgt) continue;
    if (inp === tgt) return true;
    if (levenshtein(inp, tgt) <= fuzzyThreshold(tgt)) return true;
  }
  return false;
}

/* ════════════════════════════════════════════
   GEO QUIZ HELPERS
════════════════════════════════════════════ */
// Build name → difficulty map from existing COUNTRIES (runs once at load).
const GEO_DIFF_MAP = (() => {
  const m = {};
  if (typeof COUNTRIES === 'undefined') return m;
  for (const c of COUNTRIES) {
    for (const k of ['name_en','name_nl','name_es']) {
      const n = c[k]; if (n) m[n.toLowerCase()] = c.difficulty;
    }
    for (const lang of ['en','nl','es']) {
      for (const a of (c.aliases?.[lang] ?? [])) {
        if (a) m[a.toLowerCase()] = c.difficulty;
      }
    }
  }
  return m;
})();

function geoCountryDifficulty(gc) {
  const d = GEO_DIFF_MAP[(gc.name || '').toLowerCase()];
  if (d) return d;
  for (const a of (gc.aliases || [])) {
    const d2 = GEO_DIFF_MAP[(a || '').toLowerCase()];
    if (d2) return d2;
  }
  return 'extreme';
}

// Check a typed answer against a GEO_COUNTRIES entry (name + aliases array).
function checkGeoAnswer(input, gc) {
  const inp = normalize(input);
  if (!inp) return false;
  const targets = [normalize(gc.name), ...(gc.aliases || []).map(normalize)].filter(Boolean);
  for (const tgt of targets) {
    if (inp === tgt) return true;
    if (levenshtein(inp, tgt) <= fuzzyThreshold(tgt)) return true;
  }
  return false;
}

// Render the GEO silhouette with optional rotation.
function renderGeoSvg(gc) {
  const svgEl = el('geo-svg');
  svgEl.innerHTML = gc.shape || '';
  const maxRot = state.settings.maxRotation;
  const deg    = maxRot > 0 ? Math.round((Math.random() * 2 - 1) * maxRot) : 0;
  state.game.geoRotation = deg;
  svgEl.style.transform  = deg !== 0 ? `rotate(${deg}deg)` : '';
}

/* ════════════════════════════════════════════
   I18N
════════════════════════════════════════════ */
function t(key) {
  return T[state.lang][key] ?? key;
}

function applyI18n() {
  const lang = state.lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = T[lang][key];
    if (val !== undefined && typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const val = T[lang][key];
    if (val !== undefined) el.placeholder = val;
  });
}

/* ════════════════════════════════════════════
   SCREENS
════════════════════════════════════════════ */
function show(id) {
  stopTimer();
  closeQuickMenu();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ════════════════════════════════════════════
   SETTINGS UI HELPERS
════════════════════════════════════════════ */
function activateGroup(groupId, value) {
  document.querySelectorAll(`#${groupId} .btn-opt`).forEach(b => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}

function updateSettingsVisibility() {
  const g        = state.currentGame;
  const standard = isStandardGame();
  const mode     = state.settings.inputMode;
  const isChoice = mode === 'choice';
  const isFlash  = mode === 'flashcard';
  const isGeo = g === 'geo';
  el('input-mode-group').style.display   = (standard && !isGeo) ? '' : 'none';
  el('choice-count-group').style.display = (standard && !isGeo && isChoice) ? '' : 'none';
  el('reveal-row').style.display         = (standard && !isGeo && !isChoice && !isFlash) ? '' : 'none';
  el('rotation-group').style.display     = isGeo ? '' : 'none';
  el('metric-group').style.display       = (g === 'higher-lower') ? '' : 'none';
  el('odd-visual-group').style.display   = (g === 'odd-one-out') ? '' : 'none';
  el('theme-group').style.display        = (g === 'logos') ? '' : 'none';
  el('category-group').style.display     = (g === 'geo-records') ? '' : 'none';
  const diffGroup = el('difficulty-group');
  if (diffGroup) diffGroup.style.display = (g === 'geo-records') ? 'none' : '';
}

function syncSettingsUI() {
  activateGroup('lang-selector',        state.lang);
  activateGroup('difficulty-selector',  state.settings.difficulty);
  activateGroup('mode-selector',        state.settings.mode);
  activateGroup('input-mode-selector',  state.settings.inputMode);
  activateGroup('choice-count-selector', String(state.settings.choiceCount));
  activateGroup('metric-selector',       state.settings.metric);
  activateGroup('odd-visual-selector',   state.settings.oddVisual);
  el('reveal-toggle').checked     = state.settings.autoReveal;
  el('next-toggle').checked       = state.settings.autoNext;
  el('comments-toggle').checked   = state.settings.showComments;
  el('count-display').textContent    = state.settings.flagCount;
  el('count-slider').value           = state.settings.flagCount;
  el('rotation-display').textContent = state.settings.maxRotation + '°';
  el('rotation-slider').value        = state.settings.maxRotation;
  el('team-names-group').style.display = state.settings.mode === 'team' ? '' : 'none';
  updateSettingsVisibility();
  refreshToggleStateLabels();
}

// Auto/Manual chips aren't [data-i18n] elements, so keep them in sync explicitly.
function refreshToggleStateLabels() {
  const a  = t('stAuto'), m = t('stManual');
  const on = t('stOn'),  off = t('stOff');
  el('reveal-state').textContent    = state.settings.autoReveal    ? a   : m;
  el('next-state').textContent      = state.settings.autoNext      ? a   : m;
  el('comments-state').textContent  = state.settings.showComments  ? on  : off;
  el('qm-reveal-state').textContent = state.settings.autoReveal    ? a   : m;
  el('qm-next-state').textContent   = state.settings.autoNext      ? a   : m;
}

function openSettings(game) {
  state.currentGame = game;
  const cfg = GAME_CONFIG[game] ?? GAME_CONFIG.flags;
  el('settings-title').dataset.i18n      = cfg.title;
  el('setting-next-label').dataset.i18n  = cfg.nextLabel;
  el('setting-count-label').dataset.i18n = cfg.countLabel;
  if (cfg.placeholder) el('guess-input').dataset.i18nPlaceholder = cfg.placeholder;
  updateDifficultyOptions();   // hide 'extreme' where unsupported + clamp
  renderThemeSelector();       // logos: build theme buttons
  renderCategorySelector();    // geo-records: build category buttons
  syncSettingsUI();
  applyI18n();
  show('screen-settings');
}

// Some games have no "extreme" tier — hide that button and clamp the setting.
function updateDifficultyOptions() {
  const hideExtreme = NO_EXTREME_GAMES.includes(state.currentGame);
  const btn = document.querySelector('#difficulty-selector .btn-extreme');
  if (btn) btn.style.display = hideExtreme ? 'none' : '';
  if (hideExtreme && state.settings.difficulty === 'extreme') {
    state.settings.difficulty = 'hard';
  }
}

// Logos: multi-select theme buttons ([] = all). Built from LOGO_THEME_LIST.
function renderThemeSelector() {
  if (state.currentGame !== 'logos') return;
  const cont = el('theme-selector');
  if (!cont || typeof LOGO_THEME_LIST === 'undefined') return;
  const sel = state.settings.logoThemes || [];
  const allActive = sel.length === 0;
  cont.innerHTML =
    `<button class="btn-opt ${allActive ? 'active' : ''}" data-theme="__all">${t('themeAll')}</button>` +
    LOGO_THEME_LIST.map(th =>
      `<button class="btn-opt ${sel.includes(th.key) ? 'active' : ''}" data-theme="${th.key}">${th[state.lang]}</button>`
    ).join('');
}

// Geo-records: single-select category buttons, built from GEO_RECORDS.
function renderCategorySelector() {
  if (state.currentGame !== 'geo-records') return;
  const cont = el('category-selector');
  if (!cont || typeof GEO_RECORDS === 'undefined') return;
  const cur = state.settings.recordCategory;
  cont.innerHTML = Object.keys(GEO_RECORDS).map(key => {
    const c = GEO_RECORDS[key];
    return `<button class="btn-opt ${key === cur ? 'active' : ''}" data-category="${key}">${c.emoji} ${c['label_' + state.lang]}</button>`;
  }).join('');
}

/* ════════════════════════════════════════════
   QUICK MENU (in-game hamburger)
════════════════════════════════════════════ */
function syncQuickMenu() {
  const cfg  = GAME_CONFIG[state.currentGame] ?? GAME_CONFIG.flags;
  const mode = state.settings.inputMode;
  activateGroup('qm-lang-selector', state.lang);
  el('qm-reveal-toggle').checked        = state.settings.autoReveal;
  el('qm-next-toggle').checked          = state.settings.autoNext;
  const hideReveal = !isStandardGame() || mode === 'choice' || mode === 'flashcard';
  el('qm-reveal-section').style.display = hideReveal ? 'none' : '';
  el('qm-next-label').dataset.i18n      = cfg.nextLabel;
  applyI18n();
  refreshToggleStateLabels();
}

function openQuickMenu() {
  stopTimer();          // pause the round while the menu is open
  syncQuickMenu();
  el('quick-menu').hidden          = false;
  el('quick-menu-backdrop').hidden = false;
}

// resume=true → we're staying in the game, so reconcile timer/buttons to current settings.
function closeQuickMenu(resume) {
  const wasOpen = !el('quick-menu').hidden;
  el('quick-menu').hidden          = true;
  el('quick-menu-backdrop').hidden = true;
  if (resume && wasOpen && el('screen-game').classList.contains('active')) {
    applyRoundControls();
  }
}

function toggleQuickMenu() {
  if (el('quick-menu').hidden) openQuickMenu();
  else closeQuickMenu(true);
}

// Reconcile the current round's timer + manual buttons to current settings.
// Called after the menu closes (settings may have changed while it was open).
function applyRoundControls() {
  if (!el('screen-game').classList.contains('active')) return;
  const g         = state.game;
  const isROF     = isROFGame();
  const custom    = isCustomGame();
  const inputMode = (isROF || custom) ? 'real-or-fake' : state.settings.inputMode;
  const isChoice  = inputMode === 'choice';
  const isFlash   = inputMode === 'flashcard';

  if (g.phase === 'flag') {
    if (isChoice || custom) return; // these handle their own flow (tap-based)
    if (isFlash || (!isROF && state.settings.autoReveal)) {
      el('btn-show-name').style.display = 'none';
      el('btn-wrong').style.display     = isFlash ? '' : 'none';
      startTimer(10, () => revealItem(isFlash ? true : null));
    } else {
      stopTimer();
      el('btn-show-name').style.display = isROF ? 'none' : '';
      el('btn-wrong').style.display     = 'none';
    }
  } else if (g.phase === 'reveal') {
    if (state.settings.autoNext) {
      el('btn-next').style.display = 'none';
      startTimer(3, nextRound);
    } else {
      stopTimer();
      el('btn-next').style.display = '';
    }
  }
}

// Re-render the reveal line in the current language (it has no data-i18n, so
// applyI18n won't touch it). Used when language is switched mid-round.
function renderRevealText() {
  const g = state.game;
  if (g.phase !== 'reveal') return;
  const item = g.items[g.index];
  if (!item) return;
  if (isROFGame()) {
    el('reveal-name').textContent = revealROFText(item);
  } else if (state.currentGame === 'higher-lower' || state.currentGame === 'geo-records') {
    el('hl-question').textContent = compareQuestion(item);
  } else if (state.currentGame === 'odd-one-out') {
    el('oo-question').textContent = t('oddQuestion');
    el('reveal-name').textContent = oddRevealText(item);
  } else {
    el('reveal-name').textContent = revealLabel(item);
  }
}

function exitToMenu() {
  closeQuickMenu();      // plain hide; show() below also stops the timer
  show('screen-menu');
}

function restartGame() {
  closeQuickMenu();
  startGame();
}

/* ════════════════════════════════════════════
   TIMER
════════════════════════════════════════════ */
function startTimer(seconds, onDone) {
  clearInterval(timerInterval);
  const fill = el('timer-fill');
  fill.style.width = '100%';
  fill.classList.remove('urgent');
  const end = Date.now() + seconds * 1000;

  timerInterval = setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) {
      clearInterval(timerInterval);
      fill.style.width = '0%';
      onDone();
      return;
    }
    const pct = left / (seconds * 1000);
    fill.style.width = (pct * 100) + '%';
    fill.classList.toggle('urgent', pct < 0.3);
  }, 60);
}

function stopTimer() {
  clearInterval(timerInterval);
  el('timer-fill').style.width = '0%';
  el('timer-fill').classList.remove('urgent');
}

/* ════════════════════════════════════════════
   GAME
════════════════════════════════════════════ */
function renderScoreChips() {
  const g = state.game;
  const chipsEl = el('score-chips');
  if (state.settings.mode === 'solo') {
    chipsEl.innerHTML = `<div class="score-chip">⭐ ${g.scores[0]}</div>`;
  } else {
    const names = teamNames();
    chipsEl.innerHTML = names.map((name, i) =>
      `<div class="score-chip ${g.currentTeam === i ? 'active' : ''}">
        ${name}: ${g.scores[i]}
      </div>`
    ).join('');
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ════════════════════════════════════════════
   FAKE FLAG GENERATOR (Canvas)
════════════════════════════════════════════ */
const FAKE_PALETTES = {
  // Easy: obviously non-flag color combos (pink, purple, cyan, brown)
  easy: [
    ['#FF69B4','#8B4513','#00CED1'],
    ['#7B68EE','#FF6347','#90EE90'],
    ['#DC143C','#9400D3','#FFD700'],
    ['#00FFFF','#FF4500','#8B008B'],
    ['#FF8C00','#6A0DAD','#00FF7F'],
    ['#A0522D','#FF1493','#1E90FF'],
    ['#32CD32','#FF4500','#191970'],
    ['#FF00FF','#228B22','#DAA520'],
    ['#9400D3','#00FF00','#FF8C00'],
    ['#48D1CC','#B22222','#DDA0DD'],
    ['#FF6347','#20B2AA','#F0E68C'],
    ['#8B0000','#00FA9A','#4169E1'],
  ],
  // Medium: real flag colors, wrong/unlikely combinations
  medium: [
    ['#CE1126','#FFD700','#003082'],
    ['#009A44','#CE1126','#FFFFFF'],
    ['#003082','#CE1126','#009A44'],
    ['#FFFFFF','#CE1126','#003087'],
    ['#000000','#009A44','#FFCE00'],
    ['#FF8000','#000000','#FFFFFF'],
    ['#CE1126','#006847','#FFD100'],
    ['#003399','#009A44','#CE1126'],
    ['#FFCE00','#FFFFFF','#CE1126'],
    ['#006847','#000000','#CE1126'],
    ['#003082','#FFFFFF','#009A44'],
    ['#EF3340','#FFFFFF','#009A44'],
  ],
  // Hard: realistic palettes (common national colors), standard patterns
  hard: [
    ['#CE1126','#FFFFFF','#003087'],
    ['#CE1126','#FFFFFF','#00209F'],
    ['#009A44','#FFD100','#CE1126'],
    ['#000000','#DD0000','#FFCE00'],
    ['#FF8000','#FFFFFF','#0032A0'],
    ['#006847','#FFFFFF','#CE1126'],
    ['#003399','#FFFFFF','#CC0000'],
    ['#002395','#FFFFFF','#ED2939'],
    ['#003082','#FFDE00','#FFFFFF'],
    ['#DC143C','#FFFFFF','#003580'],
    ['#008751','#FCD116','#CE1126'],
    ['#0055A4','#FFFFFF','#EF4135'],
  ],
  // Extreme: virtually indistinguishable — exact real-flag proportions & colors
  extreme: [
    ['#CE1126','#FFFFFF','#002395'],
    ['#003087','#FFFFFF','#CE1126'],
    ['#009A44','#FFD700','#CE1126'],
    ['#000000','#FFCE00','#DD0000'],
    ['#003399','#CE1126','#FFFFFF'],
    ['#EF3340','#FFFFFF','#003DA5'],
    ['#006847','#CE1126','#FFFFFF'],
    ['#0032A0','#FFFFFF','#FF8000'],
    ['#DC143C','#003580','#FFFFFF'],
    ['#002395','#ED2939','#FFFFFF'],
    ['#DD0000','#FFCE00','#000000'],
    ['#0055A4','#EF4135','#FFFFFF'],
  ],
};

const FAKE_PATTERNS = {
  easy:    ['hstripes', 'vstripes'],
  medium:  ['hstripes', 'vstripes', 'left-block', 'hstripes-star', 'saltire', 'quartered'],
  hard:    ['hstripes', 'vstripes', 'hstripes-star', 'vstripes-star', 'cross', 'nordic', 'left-block', 'diagonal', 'chevron', 'saltire', 'quartered', 'sunburst'],
  extreme: ['hstripes', 'vstripes', 'hstripes-star', 'nordic', 'cross', 'chevron', 'left-block', 'saltire', 'quartered', 'sunburst'],
};

function generateFakeParams(difficulty) {
  const diff = difficulty ?? state.settings.difficulty ?? 'hard';
  const palettes = FAKE_PALETTES[diff] ?? FAKE_PALETTES.hard;
  const patterns = FAKE_PATTERNS[diff] ?? FAKE_PATTERNS.hard;
  return {
    palette: palettes[Math.floor(Math.random() * palettes.length)],
    pattern: patterns[Math.floor(Math.random() * patterns.length)],
  };
}

function drawFakeStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
}

function generateFakeFlag(canvas, params) {
  const W = 480, H = 300;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const [c1, c2, c3] = params.palette;

  ctx.clearRect(0, 0, W, H);

  switch (params.pattern) {
    case 'hstripes': {
      const cols = [c1, c2, c3 || c1];
      const h = H / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, W, h); });
      break;
    }
    case 'vstripes': {
      const cols = [c1, c2, c3 || c1];
      const w = W / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w, H); });
      break;
    }
    case 'hstripes-star': {
      const cols = [c1, c2, c3 || c1];
      const h = H / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, W, h); });
      drawFakeStar(ctx, W / 2, H / 2, H * 0.17, c3 ? c1 : c2);
      break;
    }
    case 'vstripes-star': {
      const cols = [c1, c2, c3 || c1];
      const w = W / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w, H); });
      drawFakeStar(ctx, W / 2, H / 2, H * 0.17, c3 ? c2 : c1);
      break;
    }
    case 'cross': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2;
      const cw = W * 0.13;
      ctx.fillRect((W - cw) / 2, 0, cw, H);
      ctx.fillRect(0, (H - cw) / 2, W, cw);
      break;
    }
    case 'nordic': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const cw = Math.round(W * 0.10);
      const cx = Math.round(W * 0.35);
      ctx.fillStyle = c2;
      ctx.fillRect(cx - cw / 2, 0, cw, H);
      ctx.fillRect(0, (H - cw) / 2, W, cw);
      if (c3) {
        const inner = Math.round(cw * 0.36);
        ctx.fillStyle = c3;
        ctx.fillRect(cx - inner / 2, 0, inner, H);
        ctx.fillRect(0, (H - inner) / 2, W, inner);
      }
      break;
    }
    case 'left-block': {
      ctx.fillStyle = c3 || c2; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2; ctx.fillRect(0, 0, W * 0.30, H);
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W * 0.15, H);
      break;
    }
    case 'diagonal': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H);
      ctx.closePath(); ctx.fill();
      if (c3) drawFakeStar(ctx, W * 0.38, H * 0.38, H * 0.17, c3);
      break;
    }
    case 'chevron': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H / 2);
      ctx.fillStyle = c2; ctx.fillRect(0, H / 2, W, H / 2);
      if (c3) {
        ctx.fillStyle = c3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(W * 0.40, H / 2); ctx.lineTo(0, H);
        ctx.closePath(); ctx.fill();
      }
      break;
    }

    // ── 3 extreme themes ────────────────────────────────────

    case 'saltire': {
      // Diagonal cross (like Scotland / Jamaica)
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const diag = Math.sqrt(W * W + H * H);
      const cw   = W * 0.14;
      const ang  = Math.atan2(H, W);
      ctx.fillStyle = c2;
      [ang, -ang].forEach(a => {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(a);
        ctx.fillRect(-diag / 2, -cw / 2, diag, cw);
        ctx.restore();
      });
      if (c3) {
        // Thin inner saltire line
        const inner = cw * 0.35;
        ctx.fillStyle = c3;
        [ang, -ang].forEach(a => {
          ctx.save();
          ctx.translate(W / 2, H / 2);
          ctx.rotate(a);
          ctx.fillRect(-diag / 2, -inner / 2, diag, inner);
          ctx.restore();
        });
      }
      break;
    }

    case 'quartered': {
      // 4-quadrant flag (like Panama)
      ctx.fillStyle = c1;
      ctx.fillRect(0,     0,     W / 2, H / 2);  // top-left
      ctx.fillRect(W / 2, H / 2, W / 2, H / 2);  // bottom-right
      ctx.fillStyle = c2;
      ctx.fillRect(W / 2, 0,     W / 2, H / 2);  // top-right
      ctx.fillRect(0,     H / 2, W / 2, H / 2);  // bottom-left
      if (c3) {
        // Thin separating lines
        const lw = W * 0.025;
        ctx.fillStyle = c3;
        ctx.fillRect((W - lw) / 2, 0, lw, H);
        ctx.fillRect(0, (H - lw) / 2, W, lw);
      }
      break;
    }

    case 'sunburst': {
      // Central circle with radiating wedges (sun motif)
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const rays    = 16;
      const rayLen  = Math.max(W, H);
      const wedge   = (2 * Math.PI) / rays;
      ctx.fillStyle = c2;
      for (let i = 0; i < rays; i += 2) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rayLen, i * wedge - Math.PI / 2, (i + 1) * wedge - Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Central disc
      ctx.fillStyle = c3 || c1;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, H * 0.22, 0, 2 * Math.PI);
      ctx.fill();
      break;
    }
  }
}

/* ════════════════════════════════════════════
   FAKE LOGO GENERATOR (Canvas)
════════════════════════════════════════════ */
const FAKE_LOGO_COLORS = [
  '#E63946', '#457B9D', '#2A9D8F', '#F4A261', '#264653', '#6A4C93',
  '#1D3557', '#E76F51', '#06D6A0', '#118AB2', '#EF476F', '#F79824',
  '#3A86FF', '#8338EC', '#FB5607', '#219EBC', '#D62828', '#4CB944',
];
const FAKE_LOGO_SHAPES = [
  'circle', 'roundedSquare', 'triangle', 'hexagon',
  'twoCircles', 'ring', 'swoosh', 'bars',
  'shield', 'diamond', 'spark', 'flower',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateFakeLogoParams(difficulty) {
  const c1 = pick(FAKE_LOGO_COLORS);
  let   c2 = pick(FAKE_LOGO_COLORS);
  if (c2 === c1) c2 = pick(FAKE_LOGO_COLORS);
  return { shape: pick(FAKE_LOGO_SHAPES), c1, c2 };
}

function drawLogoShape(ctx, shape, cx, cy, r, c1, c2) {
  ctx.fillStyle = c1;
  ctx.strokeStyle = c1;
  switch (shape) {
    case 'circle':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, 2 * Math.PI); ctx.fill();
      break;
    case 'roundedSquare': {
      const s = r * 1.7, x = cx - s / 2, y = cy - s / 2, rad = s * 0.22;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + s, y, x + s, y + s, rad);
      ctx.arcTo(x + s, y + s, x, y + s, rad);
      ctx.arcTo(x, y + s, x, y, rad);
      ctx.arcTo(x, y, x + s, y, rad);
      ctx.closePath(); ctx.fill();
      // Inner diamond shape (no text)
      ctx.fillStyle = c2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      const dw = r * 0.6;
      ctx.fillRect(-dw / 2, -dw / 2, dw, dw);
      ctx.restore();
      break;
    }
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8);
      ctx.closePath(); ctx.fill();
      // Inverted inner triangle
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.45); ctx.lineTo(cx + r * 0.45, cy - r * 0.15); ctx.lineTo(cx - r * 0.45, cy - r * 0.15);
      ctx.closePath(); ctx.fill();
      break;
    case 'hexagon':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath(); ctx.fill();
      // Inner hexagon
      ctx.fillStyle = c2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        ctx[i ? 'lineTo' : 'moveTo'](cx + r * 0.45 * Math.cos(a), cy + r * 0.45 * Math.sin(a));
      }
      ctx.closePath(); ctx.fill();
      break;
    case 'twoCircles':
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(cx - r * 0.4, cy, r * 0.75, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(cx + r * 0.4, cy, r * 0.75, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'ring':
      ctx.lineWidth = r * 0.35;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0.4, 2 * Math.PI); ctx.stroke();
      // Center dot
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, 2 * Math.PI); ctx.fill();
      break;
    case 'swoosh':
      ctx.lineWidth = r * 0.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.5);
      ctx.quadraticCurveTo(cx, cy - r * 1.2, cx + r, cy - r * 0.2);
      ctx.stroke();
      break;
    case 'bars':
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === 1 ? c2 : c1;
        ctx.fillRect(cx - r + i * r * 0.75, cy - r + i * r * 0.3, r * 0.5, r * 2 - i * r * 0.3);
      }
      break;
    case 'shield': {
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy - r * 0.3);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy + r * 0.3);
      ctx.lineTo(cx - r, cy - r * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.3, 0, 2 * Math.PI); ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.fillStyle = c1;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      ctx.restore();
      ctx.fillStyle = c2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7);
      ctx.restore();
      break;
    }
    case 'spark': {
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.18, cy - r);
      ctx.lineTo(cx - r * 0.32, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.08, cy - r * 0.05);
      ctx.lineTo(cx - r * 0.18, cy + r);
      ctx.lineTo(cx + r * 0.32, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.08, cy + r * 0.05);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'flower': {
      ctx.fillStyle = c1;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i * 2 * Math.PI) / 6);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.55, r * 0.28, r * 0.55, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, 2 * Math.PI); ctx.fill();
      break;
    }
  }
}

function generateFakeLogo(canvas, params) {
  const S = 300;
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  drawLogoShape(ctx, params.shape, S / 2, S / 2, 90, params.c1, params.c2);
}

// Fallback badge drawn on the canvas when a football crest fails to load.
function drawInitials(canvas, name) {
  const W = 300, H = 300;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#3a86ff';
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 120, 0, 2 * Math.PI); ctx.fill();
  const initials = (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 90px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, W / 2, H / 2 + 6);
}

/* ════════════════════════════════════════════
   HIGHER / LOWER + ODD-ONE-OUT ROUND BUILDERS
════════════════════════════════════════════ */
// Two values are a "fair" compare pair if they differ by at least `margin` (relative).
function fairPair(va, vb, margin) {
  const hi = Math.max(va, vb);
  return hi > 0 && (hi - Math.min(va, vb)) / hi >= margin;
}

// Generic pair builder for compare games (higher/lower, geo-records).
// Skips near-equal pairs (<10%) so rounds are fairly guessable, but relaxes
// late so we can still fill the requested count.
function buildComparePairs(pool, count, valueFn, makeRound) {
  const rounds = [];
  let guard = 0;
  const cap = count * 60;
  while (rounds.length < count && guard < cap && pool.length >= 2) {
    guard++;
    const a = pick(pool), b = pick(pool);
    if (a === b) continue;
    const va = valueFn(a), vb = valueFn(b);
    if (va === vb) continue;
    if (!fairPair(va, vb, 0.10) && guard < cap * 0.66) continue; // relax margin only near the end
    rounds.push(makeRound(a, b, va, vb));
  }
  return rounds;
}

function buildHigherLowerRounds(count, diff) {
  const metric = state.settings.metric;
  let pool = COUNTRIES.filter(c => {
    const f = COUNTRY_FACTS[c.iso2];
    return c.difficulty === diff && f && typeof f[metric] === 'number';
  });
  if (pool.length < 2) {  // difficulty too sparse → fall back to all countries with this metric
    pool = COUNTRIES.filter(c => typeof COUNTRY_FACTS[c.iso2]?.[metric] === 'number');
  }
  return buildComparePairs(pool, count, c => COUNTRY_FACTS[c.iso2][metric],
    (a, b) => ({ kind: 'hl', metric, a, b }));
}

function buildGeoRecordsRounds(count) {
  const key = state.settings.recordCategory;
  const cat = (typeof GEO_RECORDS !== 'undefined' && GEO_RECORDS[key]) ? GEO_RECORDS[key]
            : (typeof GEO_RECORDS !== 'undefined' ? GEO_RECORDS[Object.keys(GEO_RECORDS)[0]] : null);
  if (!cat) return [];
  return buildComparePairs(cat.items, count, it => it.value,
    (a, b) => ({ kind: 'geo', cat: key, a, b }));
}

/* ── Odd-one-out: two shared-trait axes for variety ── */
function oddByContinent(pool) {
  const byCont = {};
  pool.forEach(c => { const k = COUNTRY_FACTS[c.iso2].continent; (byCont[k] ??= []).push(c); });
  const conts = Object.keys(byCont).filter(k => byCont[k].length >= 3);
  if (!conts.length) return null;
  const majCont = pick(conts);
  const others  = pool.filter(c => COUNTRY_FACTS[c.iso2].continent !== majCont);
  if (!others.length) return null;
  const odd = pick(others);
  return { axis: 'continent', shared: majCont, oddTrait: COUNTRY_FACTS[odd.iso2].continent,
           cards: shuffle([...shuffle(byCont[majCont]).slice(0, 3), odd]), odd };
}

function oddByLetter(pool) {
  // Group by first letter, but only where NL and EN agree (so the shown names match the letter).
  const byLetter = {};
  pool.forEach(c => {
    const le = c.name_en[0].toUpperCase(), ln = c.name_nl[0].toUpperCase();
    if (le === ln) (byLetter[le] ??= []).push(c);
  });
  const letters = Object.keys(byLetter).filter(l => byLetter[l].length >= 3);
  if (!letters.length) return null;
  const L = pick(letters);
  const others = pool.filter(c => c.name_en[0].toUpperCase() !== L && c.name_nl[0].toUpperCase() !== L);
  if (!others.length) return null;
  const odd = pick(others);
  return { axis: 'letter', shared: L,
           cards: shuffle([...shuffle(byLetter[L]).slice(0, 3), odd]), odd };
}

function buildOddOneOutRounds(count, diff) {
  const geo  = state.settings.oddVisual === 'geo';
  const pool = COUNTRIES.filter(c => {
    if (!COUNTRY_FACTS[c.iso2]?.continent) return false;
    if (geo && !(typeof COUNTRY_SHAPES !== 'undefined' && COUNTRY_SHAPES[c.iso2])) return false;
    return true;
  });
  const rounds = [];
  let guard = 0;
  const cap = count * 60;
  while (rounds.length < count && guard < cap) {
    guard++;
    const useLetter = Math.random() < 0.4;   // mix continent + letter rounds
    const round = useLetter ? oddByLetter(pool) : oddByContinent(pool);
    if (round) rounds.push(round);
    else if (!useLetter) break; // continent impossible → pool unusable, stop
  }
  return rounds;
}

function startGame() {
  const count = state.settings.flagCount;
  const diff  = state.settings.difficulty;

  if (state.currentGame === 'real-or-fake') {
    let   pool      = COUNTRIES.filter(c => c.difficulty === diff);
    if (!pool.length) pool = COUNTRIES.slice();
    const realCount = Math.ceil(count / 2);
    const fakeCount = count - realCount;
    const realItems = shuffle(pool).slice(0, Math.min(realCount, pool.length))
      .map(c => ({ type: 'real', country: c }));
    const fakeItems = Array.from({ length: fakeCount }, () => ({ type: 'fake', fakeParams: generateFakeParams(diff) }));
    state.game.items = shuffle([...realItems, ...fakeItems]);
    state.game.choicesPool = [];
  } else if (state.currentGame === 'logo-real-or-fake') {
    let   pool      = LOGOS.filter(l => l.difficulty === diff);
    if (!pool.length) pool = LOGOS.slice();
    const realCount = Math.ceil(count / 2);
    const fakeCount = count - realCount;
    const realItems = shuffle(pool).slice(0, Math.min(realCount, pool.length))
      .map(l => ({ type: 'real', logo: l }));
    const fakeItems = Array.from({ length: fakeCount }, () => ({ type: 'fake', fakeParams: generateFakeLogoParams(diff) }));
    state.game.items = shuffle([...realItems, ...fakeItems]);
    state.game.choicesPool = [];
  } else if (state.currentGame === 'higher-lower') {
    state.game.items       = buildHigherLowerRounds(count, diff);
    state.game.choicesPool = [];
  } else if (state.currentGame === 'geo-records') {
    state.game.items       = buildGeoRecordsRounds(count);
    state.game.choicesPool = [];
  } else if (state.currentGame === 'odd-one-out') {
    state.game.items       = buildOddOneOutRounds(count, diff);
    state.game.choicesPool = [];
  } else if (state.currentGame === 'geo') {
    // GEO quiz: silhouettes from GEO_COUNTRIES, difficulty mapped by country name
    const geoPool = (typeof GEO_COUNTRIES !== 'undefined' ? GEO_COUNTRIES : [])
      .filter(gc => gc.shape && geoCountryDifficulty(gc) === diff);
    const fallback = geoPool.length ? geoPool :
      (typeof GEO_COUNTRIES !== 'undefined' ? GEO_COUNTRIES.filter(gc => gc.shape) : []);
    state.game.items       = shuffle(fallback).slice(0, Math.min(count, fallback.length));
    state.game.choicesPool = [];
  } else {
    let source = COUNTRIES;                         // flags, capitals
    if (state.currentGame === 'logos')    source = LOGOS;
    if (state.currentGame === 'football') source = FOOTBALL;
    const capitalsOK = c => COUNTRY_FACTS[c.iso2]?.capital_en;
    let pool = source.filter(c => c.difficulty === diff);
    if (state.currentGame === 'capitals') pool = pool.filter(capitalsOK);
    if (!pool.length) {                             // difficulty not available for this game → use all
      pool = source.slice();
      if (state.currentGame === 'capitals') pool = pool.filter(capitalsOK);
    }
    // Logos: filter by selected themes ([] = all).
    if (state.currentGame === 'logos' && state.settings.logoThemes?.length && typeof LOGO_THEMES !== 'undefined') {
      const themed = pool.filter(l => state.settings.logoThemes.includes(LOGO_THEMES[l.slug]));
      if (themed.length) pool = themed;             // ignore empty selection combos
    }
    state.game.items       = shuffle(pool).slice(0, Math.min(count, pool.length));
    state.game.choicesPool = pool; // full pool for building distractors
  }

  state.game.index       = 0;
  state.game.scores      = [0, 0];
  state.game.currentTeam = 0;
  state.game.streak      = 0;

  show('screen-game');
  renderRound();
}

function buildChoicesForRound(item) {
  const pool    = state.game.choicesPool;
  const n       = state.settings.choiceCount;
  const others  = shuffle(pool.filter(c => c !== item)).slice(0, n - 1);
  const choices = shuffle([item, ...others]);
  state.game.currentChoices = choices;
  return choices;
}

function renderChoiceGrid(choices) {
  const isLogoLike = state.currentGame === 'logos' || state.currentGame === 'football';
  const grid       = el('choice-grid');
  grid.className = `choice-grid cols-${choices.length}`;
  grid.innerHTML = choices.map((c, i) => {
    const src  = itemImgSrc(c);
    const name = c[`name_${state.lang}`] ?? '';
    const err  = state.currentGame === 'football'
      ? ` onerror="footballFallback(this)" data-name="${name.replace(/"/g, '')}"` : '';
    return `<button class="choice-card" data-choice-index="${i}">
      <img src="${src}" alt="" class="${isLogoLike ? 'choice-logo-img' : 'choice-flag-img'}"${err}>
    </button>`;
  }).join('');
}

// Replace a broken football crest with an initials badge.
function footballFallback(img) {
  if (img.dataset.fbDone) return;
  img.dataset.fbDone = '1';
  const name = img.getAttribute('data-name') || '';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  const span = document.createElement('span');
  span.className = img.className + ' logo-fallback';
  span.textContent = initials;
  img.replaceWith(span);
}

function renderRound() {
  const g             = state.game;
  const item          = g.items[g.index];
  const isRealOrFake  = isROFGame();
  const inputMode     = isRealOrFake ? 'real-or-fake' : state.settings.inputMode;

  el('round-current').textContent = g.index + 1;
  el('round-total').textContent   = g.items.length;
  renderScoreChips();

  // team banner
  const banner = el('team-banner');
  if (state.settings.mode === 'team') {
    banner.style.display = '';
    el('team-banner-name').textContent = teamNames()[g.currentTeam];
  } else {
    banner.style.display = 'none';
  }

  // ── Custom-mechanic games dispatch ──────────────────────
  el('hl-area').style.display  = 'none';
  el('oo-area').style.display  = 'none';
  el('geo-area').style.display = 'none';
  if (state.currentGame === 'higher-lower' || state.currentGame === 'geo-records') { renderCompareRound(item); return; }
  if (state.currentGame === 'odd-one-out')  { renderOORound(item); return; }

  // ── GEO quiz: silhouette ────────────────────────────────
  if (state.currentGame === 'geo') {
    el('flag-wrap').style.display   = 'none';
    el('choice-area').style.display = 'none';
    el('geo-area').style.display    = '';
    renderGeoSvg(item);

    const input = el('guess-input');
    input.value = ''; input.disabled = false;
    input.placeholder = t('guessPlaceholder');

    el('input-row').style.display        = '';
    el('real-or-fake-area').style.display = 'none';
    el('reveal-box').style.display       = 'none';
    el('reveal-box').className           = 'reveal-box';
    hideRoundComment();
    el('btn-show-name').style.display    = state.settings.autoReveal ? 'none' : '';
    el('btn-wrong').style.display        = 'none';
    el('btn-next').style.display         = 'none';
    g.phase = 'flag';
    if (state.settings.autoReveal) startTimer(10, () => revealItem(null));
    else stopTimer();
    setTimeout(() => input.focus(), 100);
    return;
  }

  // ── Choice mode: show name + flag/logo grid ─────────────
  if (inputMode === 'choice') {
    el('flag-wrap').style.display   = 'none';
    el('choice-area').style.display = '';
    el('choice-name').textContent   = state.currentGame === 'capitals'
      ? capitalName(item) : item[`name_${state.lang}`];

    const choices = buildChoicesForRound(item);
    renderChoiceGrid(choices);

    el('input-row').style.display       = 'none';
    el('real-or-fake-area').style.display = 'none';
    el('reveal-box').style.display      = 'none';
    el('reveal-box').className          = 'reveal-box';
    el('btn-show-name').style.display   = 'none';
    el('btn-wrong').style.display       = 'none';
    el('btn-next').style.display        = 'none';
    g.phase = 'flag';
    stopTimer();
    return;
  }

  // ── Single-image modes (type, flashcard, real-or-fake) ──
  el('flag-wrap').style.display   = '';
  el('choice-area').style.display = 'none';

  const imgEl    = el('flag-img');
  const canvasEl = el('fake-flag-canvas');
  const wrapEl   = el('flag-wrap');
  wrapEl.classList.remove('logo-mode');
  imgEl.onerror = null;

  if (isRealOrFake) {
    const isLogoRof = state.currentGame === 'logo-real-or-fake';
    if (item.type === 'real') {
      imgEl.src = isLogoRof ? `logos/${item.logo.slug}.svg` : `flags/${item.country.iso2}.png`;
      imgEl.alt = isLogoRof ? 'logo' : 'vlag';
      imgEl.style.display    = '';
      canvasEl.style.display = 'none';
      if (isLogoRof) wrapEl.classList.add('logo-mode');
    } else {
      imgEl.style.display    = 'none';
      canvasEl.style.display = '';
      if (isLogoRof) { wrapEl.classList.add('logo-mode'); generateFakeLogo(canvasEl, item.fakeParams); }
      else           { generateFakeFlag(canvasEl, item.fakeParams); }
    }
  } else if (state.currentGame === 'logos' || state.currentGame === 'football') {
    imgEl.src = itemImgSrc(item);
    imgEl.alt = 'logo';
    imgEl.style.display    = '';
    canvasEl.style.display = 'none';
    wrapEl.classList.add('logo-mode');
    if (state.currentGame === 'football') {
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        canvasEl.style.display = '';
        drawInitials(canvasEl, item[`name_${state.lang}`]);
      };
    }
  } else {
    imgEl.src = itemImgSrc(item);   // flags, capitals
    imgEl.alt = 'vlag';
    imgEl.style.display    = '';
    canvasEl.style.display = 'none';
  }

  // answer area
  el('real-or-fake-area').style.display = isRealOrFake ? '' : 'none';
  el('input-row').style.display         = (!isRealOrFake && inputMode === 'type') ? '' : 'none';

  if (isRealOrFake) {
    const isLogoRof = state.currentGame === 'logo-real-or-fake';
    el('btn-real').disabled = false;
    el('btn-fake').disabled = false;
    const rLab = el('btn-real').querySelector('.choice-label');
    const fLab = el('btn-fake').querySelector('.choice-label');
    rLab.dataset.i18n = isLogoRof ? 'btnRealLogo' : 'btnReal'; rLab.textContent = t(rLab.dataset.i18n);
    fLab.dataset.i18n = isLogoRof ? 'btnFakeLogo' : 'btnFake'; fLab.textContent = t(fLab.dataset.i18n);
    el('btn-real').querySelector('.choice-icon').textContent = isLogoRof ? '™️' : '🌍';
  } else if (inputMode === 'type') {
    const input = el('guess-input');
    input.value       = '';
    input.disabled    = false;
    input.placeholder = t((GAME_CONFIG[state.currentGame] ?? GAME_CONFIG.flags).placeholder ?? 'guessPlaceholder');
  }

  // reset reveal + comment
  el('reveal-box').style.display = 'none';
  el('reveal-box').className     = 'reveal-box';
  hideRoundComment();

  // buttons per mode
  const isFlashcard = inputMode === 'flashcard';
  el('btn-show-name').style.display = (isRealOrFake || isFlashcard || state.settings.autoReveal) ? 'none' : '';
  el('btn-wrong').style.display     = 'none';   // recall shows its buttons only after the timer
  el('btn-right').style.display     = 'none';
  el('btn-next').style.display      = 'none';

  g.phase = 'flag';

  if (isFlashcard) {
    startTimer(FLASHCARD_SECONDS, flashcardReveal);
  } else if (!isRealOrFake && state.settings.autoReveal) {
    startTimer(10, () => revealItem(null));
  } else {
    stopTimer();
  }

  if (!isRealOrFake && inputMode === 'type') {
    setTimeout(() => el('guess-input').focus(), 100);
  }
}

function guessRealOrFake(isRealGuess) {
  const g = state.game;
  if (g.phase !== 'flag') return;
  g.phase = 'reveal';

  const item    = g.items[g.index];
  const correct = isRealGuess ? item.type === 'real' : item.type === 'fake';

  if (correct) g.scores[g.currentTeam]++;
  showRoundComment(correct);

  el('btn-real').disabled = true;
  el('btn-fake').disabled = true;

  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = `reveal-box ${correct ? 'correct' : 'wrong'}`;
  el('reveal-icon').textContent = correct ? '✅' : '❌';
  el('reveal-name').textContent = revealROFText(item);

  renderScoreChips();

  if (state.settings.autoNext) {
    startTimer(3, nextRound);
  } else {
    el('btn-next').style.display = '';
  }
}

// forcedCorrect: null = check input (type mode), true = correct (flashcard timer), false = wrong (flashcard btn)
function revealItem(forcedCorrect = null) {
  const g = state.game;
  if (g.phase !== 'flag') return;
  if (state.currentGame === 'real-or-fake') return;
  g.phase = 'reveal';

  stopTimer();

  const item    = g.items[g.index];
  let   correct;

  if (forcedCorrect !== null) {
    // Flashcard mode: forced result
    correct = forcedCorrect;
    const input = el('guess-input');
    if (!input.disabled) input.disabled = true;
  } else {
    const input   = el('guess-input');
    const guess   = input.value;
    input.disabled = true;
    correct = state.currentGame === 'geo'
      ? checkGeoAnswer(guess, item)
      : checkAnswer(guess, item);
  }

  if (correct) g.scores[g.currentTeam]++;
  showRoundComment(correct);

  el('btn-show-name').style.display = 'none';
  el('btn-wrong').style.display     = 'none';

  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = `reveal-box ${correct ? 'correct' : 'wrong'}`;
  el('reveal-icon').textContent = correct ? '✅' : '❌';
  el('reveal-name').textContent = state.currentGame === 'geo'
    ? item.name
    : revealLabel(item);

  renderScoreChips();

  if (state.settings.autoNext) {
    startTimer(3, nextRound);
  } else {
    el('btn-next').style.display = '';
  }
}

/* ════════════════════════════════════════════
   RECALL (flashcard): timer → reveal → self-score
════════════════════════════════════════════ */
// Timer expired (or the card was tapped): reveal the answer and offer Goed/Fout.
function flashcardReveal() {
  const g = state.game;
  if (g.phase !== 'flag') return;
  if (state.settings.inputMode !== 'flashcard' || !isStandardGame()) return;
  g.phase = 'reveal';
  stopTimer();

  const item = g.items[g.index];
  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = 'reveal-box';   // neutral — the player judges themselves
  el('reveal-icon').textContent = '';
  el('reveal-name').textContent = revealLabel(item);

  el('btn-show-name').style.display = 'none';
  el('btn-right').style.display     = '';
  el('btn-wrong').style.display     = '';
  el('btn-next').style.display      = 'none';
}

// The player tapped Goed/Fout: score and go straight to the next round.
function flashcardScore(correct) {
  const g = state.game;
  if (g.phase !== 'reveal') return;
  if (correct) g.scores[g.currentTeam]++;
  el('btn-right').style.display = 'none';
  el('btn-wrong').style.display = 'none';
  showRoundComment(correct);
  renderScoreChips();
  nextRound();
}

function selectChoice(index) {
  const g = state.game;
  if (g.phase !== 'flag') return;
  g.phase = 'reveal';

  stopTimer();

  const item      = g.items[g.index];
  const choices   = g.currentChoices;
  const correct   = choices[index] === item;

  if (correct) g.scores[g.currentTeam]++;
  showRoundComment(correct);

  // Highlight cards
  document.querySelectorAll('.choice-card').forEach((card, i) => {
    card.disabled = true;
    if (choices[i] === item) card.classList.add('correct');
    else if (i === index)    card.classList.add('wrong');
    else                     card.classList.add('faded');
  });

  // Show reveal
  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = `reveal-box ${correct ? 'correct' : 'wrong'}`;
  el('reveal-icon').textContent = correct ? '✅' : '❌';
  el('reveal-name').textContent = revealLabel(item);

  el('btn-next').style.display = 'none';
  renderScoreChips();

  if (state.settings.autoNext) {
    startTimer(3, nextRound);
  } else {
    el('btn-next').style.display = '';
  }
}

/* ════════════════════════════════════════════
   HIGHER / LOWER
════════════════════════════════════════════ */
// Hide the shared single-image/answer widgets that the custom games don't use.
function hideSharedRoundUI() {
  el('flag-wrap').style.display         = 'none';
  el('choice-area').style.display       = 'none';
  el('input-row').style.display         = 'none';
  el('real-or-fake-area').style.display = 'none';
  el('btn-show-name').style.display     = 'none';
  el('btn-wrong').style.display         = 'none';
  el('btn-next').style.display          = 'none';
  const hint = el('btn-hint'); if (hint) hint.style.display = 'none';
  el('reveal-box').style.display        = 'none';
  el('reveal-box').className            = 'reveal-box';
}

// ── Compare games (higher-lower over countries, geo-records over superlatives) ──
function compareValue(item, side) {
  const it = side === 0 ? item.a : item.b;
  return item.kind === 'geo' ? it.value : COUNTRY_FACTS[it.iso2][item.metric];
}
function compareQuestion(item) {
  return item.kind === 'geo' ? GEO_RECORDS[item.cat][`q_${state.lang}`] : t('hlQuestion' + cap(item.metric));
}
function compareUnit(item) {
  return item.kind === 'geo' ? GEO_RECORDS[item.cat].unit : t('hlUnit' + cap(item.metric));
}

function renderCompareRound(item) {
  const g = state.game;
  hideSharedRoundUI();
  el('oo-area').style.display = 'none';
  el('hl-area').style.display = '';

  el('hl-question').textContent = compareQuestion(item);
  const geo   = item.kind === 'geo';
  const emoji = geo ? (GEO_RECORDS[item.cat].emoji || '🏆') : '';
  for (const side of [0, 1]) {
    const it   = side === 0 ? item.a : item.b;
    const flag = el(`hl-flag-${side}`);
    const em   = el(`hl-emoji-${side}`);
    if (geo) {
      if (flag) flag.style.display = 'none';
      if (em)  { em.textContent = emoji; em.style.display = ''; }
    } else {
      if (flag) { flag.src = `flags/${it.iso2}.png`; flag.style.display = ''; }
      if (em) em.style.display = 'none';
    }
    el(`hl-name-${side}`).textContent = it[`name_${state.lang}`];
    const valEl = el(`hl-value-${side}`);
    valEl.textContent      = '';
    valEl.style.visibility = 'hidden';
    const card = el(`hl-card-${side}`);
    card.disabled  = false;
    card.className = 'hl-card';
  }
  g.phase = 'flag';
  stopTimer();
}

function selectCompare(side) {
  const g = state.game;
  if (g.phase !== 'flag') return;
  g.phase = 'reveal';
  stopTimer();

  const item    = g.items[g.index];
  const va      = compareValue(item, 0);
  const vb      = compareValue(item, 1);
  const higher  = va >= vb ? 0 : 1;
  const correct = side === higher;
  if (correct) g.scores[g.currentTeam]++;
  showRoundComment(correct);

  const unit = compareUnit(item);
  for (const s of [0, 1]) {
    const v     = s === 0 ? va : vb;
    const valEl = el(`hl-value-${s}`);
    valEl.textContent      = `${formatNumber(v)} ${unit}`;
    valEl.style.visibility = 'visible';
    const card = el(`hl-card-${s}`);
    card.disabled = true;
    if (s === higher)           card.classList.add('hl-higher');
    if (s === side && !correct) card.classList.add('hl-wrong');
  }

  const winner = higher === 0 ? item.a : item.b;
  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = `reveal-box ${correct ? 'correct' : 'wrong'}`;
  el('reveal-icon').textContent = correct ? '✅' : '❌';
  el('reveal-name').textContent = winner[`name_${state.lang}`];

  renderScoreChips();
  if (state.settings.autoNext) startTimer(3, nextRound);
  else el('btn-next').style.display = '';
}

/* ════════════════════════════════════════════
   ODD ONE OUT
════════════════════════════════════════════ */
// Explanation shown after answering: the odd one + what the other three shared.
function oddRevealText(item) {
  const oddName = item.odd[`name_${state.lang}`];
  const others  = item.cards.filter(c => c !== item.odd).map(c => c[`name_${state.lang}`]).join(', ');
  if (item.axis === 'letter') {
    return `${oddName} ${t('oddNotBelong')}. ${t('oddStartWith')} "${item.shared}": ${others}.`;
  }
  return `${oddName} ${t('oddNotBelong')} (${localizedContinent(item.oddTrait)}). `
       + `${t('oddOthersIn')} ${localizedContinent(item.shared)}: ${others}.`;
}

function renderOORound(item) {
  const g = state.game;
  hideSharedRoundUI();
  el('hl-area').style.display = 'none';
  el('oo-area').style.display = '';

  el('oo-question').textContent = t('oddQuestion');
  const geo  = state.settings.oddVisual === 'geo';
  const grid = el('oo-grid');
  grid.className = 'choice-grid cols-4';
  grid.innerHTML = item.cards.map((c, i) => {
    const inner = geo
      ? `<svg viewBox="${typeof SHAPE_VIEWBOX !== 'undefined' ? SHAPE_VIEWBOX : '0 0 100 100'}" class="oo-shape">${(typeof COUNTRY_SHAPES !== 'undefined' && COUNTRY_SHAPES[c.iso2]) || ''}</svg>`
      : `<img src="flags/${c.iso2}.png" alt="" class="choice-flag-img">`;
    return `<button class="choice-card ${geo ? 'geo-card' : ''}" data-oo-index="${i}">${inner}</button>`;
  }).join('');
  g.phase = 'flag';
  stopTimer();
}

function selectOdd(index) {
  const g = state.game;
  if (g.phase !== 'flag') return;
  g.phase = 'reveal';
  stopTimer();

  const item     = g.items[g.index];
  const correct  = item.cards[index] === item.odd;
  const oddIndex = item.cards.indexOf(item.odd);
  if (correct) g.scores[g.currentTeam]++;
  showRoundComment(correct);

  document.querySelectorAll('#oo-grid .choice-card').forEach((card, i) => {
    card.disabled = true;
    if (i === oddIndex)   card.classList.add('correct');
    else if (i === index) card.classList.add('wrong');
    else                  card.classList.add('faded');
  });

  const revealBox = el('reveal-box');
  revealBox.style.display = '';
  revealBox.className     = `reveal-box ${correct ? 'correct' : 'wrong'} detail`;
  el('reveal-icon').textContent = correct ? '✅' : '❌';
  el('reveal-name').textContent = oddRevealText(item);

  renderScoreChips();
  if (state.settings.autoNext) startTimer(3, nextRound);
  else el('btn-next').style.display = '';
}

function nextRound() {
  const g = state.game;
  if (g.phase !== 'reveal') return;
  g.phase = 'done';

  stopTimer();

  if (g.index >= g.items.length - 1) {
    showResults();
    return;
  }

  g.index++;
  if (state.settings.mode === 'team') {
    g.currentTeam = (g.currentTeam + 1) % 2;
  }
  renderRound();
}

/* ════════════════════════════════════════════
   RESULTS
════════════════════════════════════════════ */
function getScorePhrase(score, total) {
  const pct     = total ? Math.round((score / total) * 100) : 0;
  const phrases = t('scorePhrases');
  return phrases.find(p => pct >= p.min) ?? phrases[phrases.length - 1];
}

function showResults() {
  show('screen-results');
  const g      = state.game;
  const scores = g.scores;
  const rowsEl = el('results-rows');
  const winEl  = el('results-winner-text');

  const bestEl = el('results-best');

  if (state.settings.mode === 'solo') {
    const phrase = getScorePhrase(scores[0], g.items.length);
    el('results-trophy').textContent = phrase.emoji;
    rowsEl.innerHTML = `
      <div class="result-row winner">
        <span class="result-name">Score</span>
        <span class="result-score">${scores[0]} / ${g.items.length}</span>
      </div>`;
    winEl.textContent = phrase.text;
    winEl.className   = 'results-winner';

    // Highscore (solo only)
    if (bestEl) {
      const { bestScore, bestTotal, isRecord } = recordHighScore(scores[0], g.items.length);
      bestEl.textContent = isRecord
        ? `${t('newRecord')} (${scores[0]} / ${g.items.length})`
        : `${t('bestScore')}: ${bestScore} / ${bestTotal}`;
      bestEl.style.display = '';
    }
  } else {
    if (bestEl) bestEl.style.display = 'none';
    const names  = teamNames();
    const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
    rowsEl.innerHTML = names.map((name, i) => `
      <div class="result-row ${winner === i ? 'winner' : ''}">
        <span class="result-name">${winner === i ? '🏆 ' : ''}${name}</span>
        <span class="result-score">${scores[i]}</span>
      </div>`).join('');
    winEl.textContent = winner === -1
      ? t('tie')
      : `${names[winner]} ${t('wins')}`;
    winEl.className   = 'results-winner team-result';
    el('results-trophy').textContent = winner === -1 ? '🤝' : '🏆';
  }
}

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function el(id) { return document.getElementById(id); }

/* ════════════════════════════════════════════
   ROUND COMMENTS
════════════════════════════════════════════ */
function pickComment(correct, newStreak, prevStreak) {
  const lang = T[state.lang];
  if (!correct) {
    if (prevStreak >= 2) {
      const options = lang.streakBroken || [];
      return pick(Array.isArray(options) ? options : [options]).replace('{n}', prevStreak);
    }
    return pick(lang.wrongComments || []);
  }
  // Streak milestones — highest matching threshold wins, random from its array
  const thresholds = Object.keys(lang.streakComments || {})
    .map(Number).sort((a, b) => b - a);
  for (const thr of thresholds) {
    if (newStreak >= thr) {
      const opts = lang.streakComments[thr];
      return Array.isArray(opts) ? pick(opts) : opts;
    }
  }
  return pick(lang.correctComments || []);
}

function showRoundComment(correct) {
  if (!state.settings.showComments) return;
  const g        = state.game;
  const prevStreak = g.streak;
  g.streak = correct ? prevStreak + 1 : 0;
  const commentEl = el('round-comment');
  if (!commentEl) return;
  const text = pickComment(correct, g.streak, prevStreak);
  if (!text) return;
  commentEl.textContent = text;
  commentEl.style.display = '';
  commentEl.classList.remove('comment-pop');
  void commentEl.offsetWidth; // reflow to restart animation
  commentEl.classList.add('comment-pop');
}

function hideRoundComment() {
  const commentEl = el('round-comment');
  if (commentEl) commentEl.style.display = 'none';
}

function teamNames() {
  return [
    state.settings.teamNames[0].trim() || 'Team A',
    state.settings.teamNames[1].trim() || 'Team B',
  ];
}

/* ════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════ */
function wireGroup(groupId, handler) {
  el(groupId).addEventListener('click', e => {
    const btn = e.target.closest('.btn-opt');
    if (btn) handler(btn.dataset.value);
  });
}

function initEvents() {
  // ── Menu ────────────────────────────────
  el('btn-flags').addEventListener('click',         () => onMenuCard('flags'));
  el('btn-logos').addEventListener('click',         () => onMenuCard('logos'));
  el('btn-real-or-fake').addEventListener('click',  () => onMenuCard('real-or-fake'));
  el('btn-capitals').addEventListener('click',      () => onMenuCard('capitals'));
  el('btn-football').addEventListener('click',      () => onMenuCard('football'));
  el('btn-logo-real-or-fake').addEventListener('click', () => onMenuCard('logo-real-or-fake'));
  el('btn-higher-lower').addEventListener('click',  () => onMenuCard('higher-lower'));
  el('btn-odd-one-out').addEventListener('click',   () => onMenuCard('odd-one-out'));
  el('btn-geo-records').addEventListener('click',   () => onMenuCard('geo-records'));
  el('btn-geo').addEventListener('click',           () => onMenuCard('geo'));

  // ── Study mode ──────────────────────────
  el('mode-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.mode-toggle-btn');
    if (btn) setStudyMode(btn.dataset.mode === 'study');
  });
  el('btn-study-back').addEventListener('click', () => show('screen-menu'));
  el('study-diff-selector').addEventListener('click', e => {
    const btn = e.target.closest('.btn-opt');
    if (!btn) return;
    study.difficulty = btn.dataset.value;
    activateGroup('study-diff-selector', study.difficulty);
    renderStudyGrid();
  });
  el('study-continent-selector').addEventListener('click', e => {
    const btn = e.target.closest('.btn-opt');
    if (!btn) return;
    study.continent = btn.dataset.value;
    activateGroup('study-continent-selector', study.continent);
    renderStudyGrid();
  });
  el('study-search').addEventListener('input', e => {
    study.search = e.target.value;
    renderStudyGrid();
  });
  el('study-grid').addEventListener('click', e => {
    const tile = e.target.closest('.study-tile');
    if (tile) openStudyCard(+tile.dataset.studyIndex, false);
  });
  el('btn-study-flashcards').addEventListener('click', () => {
    if (study.list.length) openStudyCard(0, true);
  });
  el('btn-studycard-close').addEventListener('click', () => show('screen-study'));
  el('studycard-body').addEventListener('click', studyCardReveal);
  el('btn-studycard-prev').addEventListener('click', () => studyCardStep(-1));
  el('btn-studycard-next').addEventListener('click', () => studyCardStep(1));

  // ── Settings ────────────────────────────
  el('btn-back-menu').addEventListener('click', () => show('screen-menu'));

  wireGroup('lang-selector', v => {
    state.lang = v;
    activateGroup('lang-selector', v);
    applyI18n();
    refreshToggleStateLabels();
    saveSettings();
  });

  wireGroup('difficulty-selector', v => {
    state.settings.difficulty = v;
    activateGroup('difficulty-selector', v);
    saveSettings();
  });

  wireGroup('input-mode-selector', v => {
    state.settings.inputMode = v;
    activateGroup('input-mode-selector', v);
    updateSettingsVisibility();
    saveSettings();
  });

  wireGroup('choice-count-selector', v => {
    state.settings.choiceCount = +v;
    activateGroup('choice-count-selector', v);
    saveSettings();
  });

  wireGroup('metric-selector', v => {
    state.settings.metric = v;
    activateGroup('metric-selector', v);
    saveSettings();
  });

  wireGroup('odd-visual-selector', v => {
    state.settings.oddVisual = v;
    activateGroup('odd-visual-selector', v);
    saveSettings();
  });

  // Logo themes (multi-select, "__all" clears the selection).
  el('theme-selector').addEventListener('click', e => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    const key = btn.dataset.theme;
    let sel = state.settings.logoThemes || [];
    if (key === '__all')            sel = [];
    else if (sel.includes(key))     sel = sel.filter(k => k !== key);
    else                            sel = [...sel, key];
    state.settings.logoThemes = sel;
    renderThemeSelector();
    saveSettings();
  });

  // Geo-records category (single-select).
  el('category-selector').addEventListener('click', e => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    state.settings.recordCategory = btn.dataset.category;
    renderCategorySelector();
    saveSettings();
  });

  wireGroup('mode-selector', v => {
    state.settings.mode = v;
    activateGroup('mode-selector', v);
    el('team-names-group').style.display = v === 'team' ? '' : 'none';
    saveSettings();
  });

  el('reveal-toggle').addEventListener('change', e => {
    state.settings.autoReveal = e.target.checked;
    el('reveal-state').textContent = e.target.checked ? t('stAuto') : t('stManual');
    saveSettings();
  });

  el('next-toggle').addEventListener('change', e => {
    state.settings.autoNext = e.target.checked;
    el('next-state').textContent = e.target.checked ? t('stAuto') : t('stManual');
    saveSettings();
  });

  el('comments-toggle').addEventListener('change', e => {
    state.settings.showComments = e.target.checked;
    el('comments-state').textContent = e.target.checked ? t('stOn') : t('stOff');
    saveSettings();
  });

  el('count-slider').addEventListener('input', e => {
    state.settings.flagCount = +e.target.value;
    el('count-display').textContent = state.settings.flagCount;
    saveSettings();
  });

  el('rotation-slider').addEventListener('input', e => {
    state.settings.maxRotation = +e.target.value;
    el('rotation-display').textContent = state.settings.maxRotation + '°';
    saveSettings();
  });

  el('team-a-input').addEventListener('input', e => {
    state.settings.teamNames[0] = e.target.value;
    saveSettings();
  });
  el('team-b-input').addEventListener('input', e => {
    state.settings.teamNames[1] = e.target.value;
    saveSettings();
  });

  el('btn-start').addEventListener('click', startGame);

  // ── Game: exit + quick menu ─────────────
  el('btn-exit-game').addEventListener('click', exitToMenu);
  el('btn-hamburger').addEventListener('click', toggleQuickMenu);
  el('quick-menu-backdrop').addEventListener('click', () => closeQuickMenu(true));

  wireGroup('qm-lang-selector', v => {
    state.lang = v;
    activateGroup('qm-lang-selector', v);
    applyI18n();
    refreshToggleStateLabels();
    renderRevealText();
    saveSettings();
  });

  el('qm-reveal-toggle').addEventListener('change', e => {
    state.settings.autoReveal = e.target.checked;
    el('qm-reveal-state').textContent = e.target.checked ? t('stAuto') : t('stManual');
  });
  el('qm-next-toggle').addEventListener('change', e => {
    state.settings.autoNext = e.target.checked;
    el('qm-next-state').textContent = e.target.checked ? t('stAuto') : t('stManual');
  });

  el('btn-qm-restart').addEventListener('click', restartGame);
  el('btn-qm-settings').addEventListener('click', () => { closeQuickMenu(); openSettings(state.currentGame); });
  el('btn-qm-quit').addEventListener('click', exitToMenu);

  // ── Game ────────────────────────────────
  el('btn-submit').addEventListener('click', () => {
    if (state.game.phase === 'flag') revealItem();
  });

  el('guess-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && state.game.phase === 'flag') revealItem();
  });

  el('btn-show-name').addEventListener('click', () => {
    if (state.game.phase === 'flag') revealItem();
  });

  el('btn-next').addEventListener('click', () => {
    if (state.game.phase === 'reveal') nextRound();
  });

  // ── Real or Fake ────────────────────────
  el('btn-real').addEventListener('click', () => guessRealOrFake(true));
  el('btn-fake').addEventListener('click', () => guessRealOrFake(false));

  // ── Choice mode: delegate to grid (event delegation) ────
  el('choice-grid').addEventListener('click', e => {
    const card = e.target.closest('.choice-card');
    if (card && state.game.phase === 'flag') {
      selectChoice(+card.dataset.choiceIndex);
    }
  });

  // ── Recall (flashcard): tap card to reveal early, then self-score ──
  el('flag-wrap').addEventListener('click', () => {
    if (state.settings.inputMode === 'flashcard' && isStandardGame() && state.game.phase === 'flag') {
      flashcardReveal();
    }
  });
  el('btn-right').addEventListener('click', () => {
    if (state.game.phase === 'reveal') flashcardScore(true);
  });
  el('btn-wrong').addEventListener('click', () => {
    if (state.game.phase === 'reveal') flashcardScore(false);
  });

  // ── Compare games (higher-lower, geo-records): pick a side ──
  el('hl-card-0').addEventListener('click', () => selectCompare(0));
  el('hl-card-1').addEventListener('click', () => selectCompare(1));

  // ── Odd one out: tap the odd flag ────────────────────────
  el('oo-grid').addEventListener('click', e => {
    const card = e.target.closest('.choice-card');
    if (card && state.game.phase === 'flag') selectOdd(+card.dataset.ooIndex);
  });

  // ── Results ─────────────────────────────
  el('btn-play-again').addEventListener('click', startGame);
  el('btn-to-menu').addEventListener('click',    () => show('screen-menu'));

  // ── Global: Escape = close menu / open menu / go back ─
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!el('quick-menu').hidden)                            { closeQuickMenu(true); return; }
    if (el('screen-game').classList.contains('active'))      { openQuickMenu();      return; }
    if (el('screen-settings').classList.contains('active'))  { show('screen-menu');  return; }
    if (el('screen-results').classList.contains('active'))   { show('screen-menu');  return; }
    if (el('screen-study-card').classList.contains('active')){ show('screen-study'); return; }
    if (el('screen-study').classList.contains('active'))     { show('screen-menu');  return; }
  });
}

/* ════════════════════════════════════════════
   STUDY MODE (learn a topic instead of playing)
════════════════════════════════════════════ */
// Topics that support a learn view. kind decides which data + card layout.
const STUDY_TOPICS = {
  flags:    { title: 'flagGame',     kind: 'country' },
  capitals: { title: 'capitalsGame', kind: 'country' },
  football: { title: 'footballGame', kind: 'club' },
};
const STUDY_CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];

const study = {
  topic:      'flags',
  kind:       'country',
  difficulty: 'all',
  continent:  'all',
  search:     '',
  list:       [],       // current filtered items
  index:      0,
  flashcard:  false,    // true = tap-to-reveal session, false = free browse
  revealed:   true,
};

// Menu card dispatcher: play → settings, study → learn view (if supported).
function onMenuCard(game) {
  if (state.studyMode) {
    if (STUDY_TOPICS[game]) openStudy(game);
  } else {
    openSettings(game);
  }
}

function setStudyMode(on) {
  state.studyMode = on;
  document.querySelectorAll('#mode-toggle .mode-toggle-btn').forEach(b =>
    b.classList.toggle('active', (b.dataset.mode === 'study') === on));
  el('screen-menu').classList.toggle('study-active', on);
}

function studySource() { return study.kind === 'club' ? FOOTBALL : COUNTRIES; }

function studyImgSrc(item) {
  return study.kind === 'club' ? `football/${item.slug}.png` : `flags/${item.iso2}.png`;
}

// Filter the source list by difficulty, continent (countries only) and search.
function studyFilter() {
  const q = normalize(study.search);
  return studySource().filter(item => {
    if (study.difficulty !== 'all' && item.difficulty !== study.difficulty) return false;
    if (study.kind === 'country' && study.continent !== 'all') {
      const f = COUNTRY_FACTS[item.iso2];
      if (!f || f.continent !== study.continent) return false;
    }
    if (q) {
      const name = normalize(item[`name_${state.lang}`] || '');
      const cap  = study.kind === 'country' ? normalize(capitalName(item)) : '';
      if (!name.includes(q) && !cap.includes(q)) return false;
    }
    return true;
  });
}

function openStudy(topic) {
  const cfg = STUDY_TOPICS[topic];
  if (!cfg) return;
  study.topic      = topic;
  study.kind       = cfg.kind;
  study.difficulty = 'all';
  study.continent  = 'all';
  study.search     = '';
  el('study-title').dataset.i18n = cfg.title;
  el('study-search').value = '';
  activateGroup('study-diff-selector', 'all');
  buildContinentFilter();
  applyI18n();
  renderStudyGrid();
  show('screen-study');
}

// Continent chips (countries only); hidden for clubs.
function buildContinentFilter() {
  const wrap = el('study-continent-selector');
  if (study.kind !== 'country') { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = '';
  const btn = (val, label) =>
    `<button class="btn-opt${val === study.continent ? ' active' : ''}" data-value="${val}">${label}</button>`;
  wrap.innerHTML = btn('all', t('studyAll')) +
    STUDY_CONTINENTS.map(c => btn(c, localizedContinent(c))).join('');
}

function renderStudyGrid() {
  study.list = studyFilter();
  el('study-count').textContent = `${study.list.length} ${t('studyItems')}`;
  const grid = el('study-grid');
  if (!study.list.length) {
    grid.innerHTML = `<div class="study-empty">${t('studyNone')}</div>`;
    return;
  }
  grid.innerHTML = study.list.map((item, i) =>
    `<button class="study-tile" data-study-index="${i}">
       <img class="study-tile-img" src="${studyImgSrc(item)}" alt="" loading="lazy">
       <span class="study-tile-name">${item[`name_${state.lang}`]}</span>
     </button>`).join('');
}

// Fact rows for the detail card.
function studyFactsHtml(item) {
  const rows = [];
  const row = (labelKey, value) => {
    if (value) rows.push(
      `<div class="fact-row"><span class="fact-label">${t(labelKey)}</span><span class="fact-value">${value}</span></div>`);
  };
  if (study.kind === 'country') {
    const f = COUNTRY_FACTS[item.iso2] || {};
    row('studyCapital',    capitalName(item));
    row('studyContinent',  f.continent ? localizedContinent(f.continent) : '');
    row('studyPopulation', f.population ? formatNumber(f.population) : '');
    row('studyArea',       f.area ? `${formatNumber(f.area)} km²` : '');
    row('studyGdp',        f.gdp ? `${formatNumber(f.gdp)} ${t('hlUnitGdp')}` : '');
    const story = (typeof FLAG_INFO !== 'undefined' && FLAG_INFO[item.iso2]) ? FLAG_INFO[item.iso2][state.lang] : '';
    if (story) rows.push(`<div class="fact-story">${story}</div>`);
  } else {
    row('studyDifficulty', t(item.difficulty));
  }
  return rows.join('');
}

function renderStudyCard() {
  const item = study.list[study.index];
  if (!item) return;
  el('studycard-img').src = studyImgSrc(item);
  el('studycard-progress').textContent = `${study.index + 1} / ${study.list.length}`;
  const infoEl = el('studycard-info');
  infoEl.innerHTML = `<div class="studycard-name">${item[`name_${state.lang}`]}</div>` + studyFactsHtml(item);
  const hide = study.flashcard && !study.revealed;
  el('studycard-hidden').style.display = hide ? '' : 'none';
  infoEl.style.display = hide ? 'none' : '';
  el('studycard-mode').textContent = study.flashcard ? t('studyFlashcards') : '';
}

function openStudyCard(index, flashcard) {
  study.index     = index;
  study.flashcard = !!flashcard;
  study.revealed  = !flashcard;
  renderStudyCard();
  show('screen-study-card');
}

function studyCardReveal() {
  if (study.flashcard && !study.revealed) { study.revealed = true; renderStudyCard(); }
}

function studyCardStep(dir) {
  const n = study.list.length;
  if (!n) return;
  study.index    = (study.index + dir + n) % n;
  study.revealed = !study.flashcard;
  renderStudyCard();
}

// Study-mode translations, merged into the main T dictionary.
const STUDY_T = {
  nl: { modePlay: 'Spelen', modeStudy: 'Leren', studyAll: 'Alle', studySearch: 'Zoeken…',
        studyFlashcards: 'Flashcards', studyItems: 'resultaten', studyNone: 'Niets gevonden',
        studyTapReveal: 'Tik om te tonen', studyPrev: 'Vorige', studyNext: 'Volgende',
        studyCapital: 'Hoofdstad', studyContinent: 'Continent', studyPopulation: 'Inwoners',
        studyArea: 'Oppervlak', studyGdp: 'BBP', studyDifficulty: 'Niveau' },
  en: { modePlay: 'Play', modeStudy: 'Learn', studyAll: 'All', studySearch: 'Search…',
        studyFlashcards: 'Flashcards', studyItems: 'results', studyNone: 'Nothing found',
        studyTapReveal: 'Tap to reveal', studyPrev: 'Previous', studyNext: 'Next',
        studyCapital: 'Capital', studyContinent: 'Continent', studyPopulation: 'Population',
        studyArea: 'Area', studyGdp: 'GDP', studyDifficulty: 'Level' },
  es: { modePlay: 'Jugar', modeStudy: 'Aprender', studyAll: 'Todos', studySearch: 'Buscar…',
        studyFlashcards: 'Flashcards', studyItems: 'resultados', studyNone: 'Sin resultados',
        studyTapReveal: 'Toca para mostrar', studyPrev: 'Anterior', studyNext: 'Siguiente',
        studyCapital: 'Capital', studyContinent: 'Continente', studyPopulation: 'Población',
        studyArea: 'Superficie', studyGdp: 'PIB', studyDifficulty: 'Nivel' },
};
Object.keys(STUDY_T).forEach(l => { if (T[l]) Object.assign(T[l], STUDY_T[l]); });

/* ════════════════════════════════════════════
   BOOT
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  applyI18n();
  initEvents();
  show('screen-menu');
});
