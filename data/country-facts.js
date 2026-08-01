// Aanvullende feiten per land, gekoppeld op iso2 (zelfde codes als data/countries.js).
const COUNTRY_FACTS = {
  // ══════════════════════════════════════════════════════════
  // EASY
  // ══════════════════════════════════════════════════════════
  fr: {
    capital_nl: 'Parijs', capital_en: 'Paris', capital_es: 'París',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 68000000, area: 551695, gdp: 3130, continent: 'Europe',
  },
  de: {
    capital_nl: 'Berlijn', capital_en: 'Berlin', capital_es: 'Berlín',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 84000000, area: 357588, gdp: 4460, continent: 'Europe',
  },
  it: {
    capital_nl: 'Rome', capital_en: 'Rome', capital_es: 'Roma',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 59000000, area: 301340, gdp: 2250, continent: 'Europe',
  },
  es: {
    capital_nl: 'Madrid', capital_en: 'Madrid', capital_es: 'Madrid',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 48000000, area: 505990, gdp: 1580, continent: 'Europe',
  },
  nl: {
    capital_nl: 'Amsterdam', capital_en: 'Amsterdam', capital_es: 'Ámsterdam',
    capitalAliases: { nl: [], en: [], es: ['amsterdam'] },
    population: 18000000, area: 41850, gdp: 1120, continent: 'Europe',
  },
  be: {
    capital_nl: 'Brussel', capital_en: 'Brussels', capital_es: 'Bruselas',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 12000000, area: 30528, gdp: 630, continent: 'Europe',
  },
  gb: {
    capital_nl: 'Londen', capital_en: 'London', capital_es: 'Londres',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 67000000, area: 243610, gdp: 3340, continent: 'Europe',
  },
  us: {
    capital_nl: 'Washington', capital_en: 'Washington', capital_es: 'Washington',
    capitalAliases: { nl: ['washington dc'], en: ['washington dc', 'washington d.c.'], es: ['washington dc'] },
    population: 335000000, area: 9834000, gdp: 27360, continent: 'North America',
  },
  ca: {
    capital_nl: 'Ottawa', capital_en: 'Ottawa', capital_es: 'Ottawa',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 40000000, area: 9985000, gdp: 2140, continent: 'North America',
  },
  au: {
    capital_nl: 'Canberra', capital_en: 'Canberra', capital_es: 'Canberra',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 26000000, area: 7692000, gdp: 1690, continent: 'Oceania',
  },
  br: {
    capital_nl: 'Brasilia', capital_en: 'Brasília', capital_es: 'Brasilia',
    capitalAliases: { nl: ['brasilia'], en: ['brasilia'], es: [] },
    population: 216000000, area: 8516000, gdp: 2170, continent: 'South America',
  },
  jp: {
    capital_nl: 'Tokio', capital_en: 'Tokyo', capital_es: 'Tokio',
    capitalAliases: { nl: ['tokyo'], en: [], es: ['tokyo'] },
    population: 124000000, area: 377975, gdp: 4210, continent: 'Asia',
  },
  cn: {
    capital_nl: 'Peking', capital_en: 'Beijing', capital_es: 'Pekín',
    capitalAliases: { nl: ['beijing'], en: ['peking'], es: ['pekin', 'beijing'] },
    population: 1410000000, area: 9597000, gdp: 17790, continent: 'Asia',
  },
  in: {
    capital_nl: 'New Delhi', capital_en: 'New Delhi', capital_es: 'Nueva Delhi',
    capitalAliases: { nl: ['nieuw delhi', 'delhi'], en: ['delhi'], es: ['delhi'] },
    population: 1430000000, area: 3287000, gdp: 3730, continent: 'Asia',
  },
  ru: {
    capital_nl: 'Moskou', capital_en: 'Moscow', capital_es: 'Moscú',
    capitalAliases: { nl: [], en: [], es: ['moscu'] },
    population: 144000000, area: 17098000, gdp: 2020, continent: 'Europe',
  },
  mx: {
    capital_nl: 'Mexico-Stad', capital_en: 'Mexico City', capital_es: 'Ciudad de México',
    capitalAliases: { nl: ['mexico stad', 'mexico city'], en: [], es: ['ciudad de mexico', 'mexico df'] },
    population: 129000000, area: 1964000, gdp: 1790, continent: 'North America',
  },
  ar: {
    capital_nl: 'Buenos Aires', capital_en: 'Buenos Aires', capital_es: 'Buenos Aires',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 46000000, area: 2780000, gdp: 640, continent: 'South America',
  },
  pt: {
    capital_nl: 'Lissabon', capital_en: 'Lisbon', capital_es: 'Lisboa',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 10000000, area: 92212, gdp: 290, continent: 'Europe',
  },
  ch: {
    capital_nl: 'Bern', capital_en: 'Bern', capital_es: 'Berna',
    capitalAliases: { nl: [], en: ['berne'], es: [] },
    population: 8800000, area: 41285, gdp: 900, continent: 'Europe',
  },
  se: {
    capital_nl: 'Stockholm', capital_en: 'Stockholm', capital_es: 'Estocolmo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 10500000, area: 450295, gdp: 590, continent: 'Europe',
  },
  no: {
    capital_nl: 'Oslo', capital_en: 'Oslo', capital_es: 'Oslo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5500000, area: 385207, gdp: 500, continent: 'Europe',
  },
  dk: {
    capital_nl: 'Kopenhagen', capital_en: 'Copenhagen', capital_es: 'Copenhague',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5900000, area: 43094, gdp: 410, continent: 'Europe',
  },
  fi: {
    capital_nl: 'Helsinki', capital_en: 'Helsinki', capital_es: 'Helsinki',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5500000, area: 338455, gdp: 300, continent: 'Europe',
  },
  at: {
    capital_nl: 'Wenen', capital_en: 'Vienna', capital_es: 'Viena',
    capitalAliases: { nl: [], en: ['wien'], es: [] },
    population: 9100000, area: 83879, gdp: 520, continent: 'Europe',
  },
  gr: {
    capital_nl: 'Athene', capital_en: 'Athens', capital_es: 'Atenas',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 10400000, area: 131957, gdp: 240, continent: 'Europe',
  },
  tr: {
    capital_nl: 'Ankara', capital_en: 'Ankara', capital_es: 'Ankara',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 85000000, area: 783562, gdp: 1110, continent: 'Asia',
  },
  kr: {
    capital_nl: 'Seoul', capital_en: 'Seoul', capital_es: 'Seúl',
    capitalAliases: { nl: [], en: [], es: ['seul'] },
    population: 52000000, area: 100210, gdp: 1710, continent: 'Asia',
  },
  za: {
    capital_nl: 'Pretoria', capital_en: 'Pretoria', capital_es: 'Pretoria',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 60000000, area: 1221000, gdp: 380, continent: 'Africa',
  },
  eg: {
    capital_nl: 'Caïro', capital_en: 'Cairo', capital_es: 'El Cairo',
    capitalAliases: { nl: ['cairo'], en: [], es: ['cairo'] },
    population: 112000000, area: 1002000, gdp: 400, continent: 'Africa',
  },
  sa: {
    capital_nl: 'Riyad', capital_en: 'Riyadh', capital_es: 'Riad',
    capitalAliases: { nl: ['riyadh'], en: [], es: ['riyadh', 'riad'] },
    population: 37000000, area: 2150000, gdp: 1070, continent: 'Asia',
  },

  // ══════════════════════════════════════════════════════════
  // MEDIUM
  // ══════════════════════════════════════════════════════════
  pl: {
    capital_nl: 'Warschau', capital_en: 'Warsaw', capital_es: 'Varsovia',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 38000000, area: 312696, gdp: 810, continent: 'Europe',
  },
  cz: {
    capital_nl: 'Praag', capital_en: 'Prague', capital_es: 'Praga',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 10700000, area: 78867, gdp: 340, continent: 'Europe',
  },
  hu: {
    capital_nl: 'Boedapest', capital_en: 'Budapest', capital_es: 'Budapest',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 9600000, area: 93028, gdp: 210, continent: 'Europe',
  },
  ro: {
    capital_nl: 'Boekarest', capital_en: 'Bucharest', capital_es: 'Bucarest',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 19000000, area: 238398, gdp: 350, continent: 'Europe',
  },
  ua: {
    capital_nl: 'Kiev', capital_en: 'Kyiv', capital_es: 'Kiev',
    capitalAliases: { nl: ['kyiv'], en: ['kiev'], es: ['kyiv'] },
    population: 38000000, area: 603500, gdp: 180, continent: 'Europe',
  },
  hr: {
    capital_nl: 'Zagreb', capital_en: 'Zagreb', capital_es: 'Zagreb',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 3800000, area: 56594, gdp: 80, continent: 'Europe',
  },
  rs: {
    capital_nl: 'Belgrado', capital_en: 'Belgrade', capital_es: 'Belgrado',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 6600000, area: 88361, gdp: 75, continent: 'Europe',
  },
  ie: {
    capital_nl: 'Dublin', capital_en: 'Dublin', capital_es: 'Dublín',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5200000, area: 70273, gdp: 550, continent: 'Europe',
  },
  is: {
    capital_nl: 'Reykjavik', capital_en: 'Reykjavik', capital_es: 'Reikiavik',
    capitalAliases: { nl: ['reykjavík'], en: ['reykjavík'], es: ['reykjavik'] },
    population: 390000, area: 103000, gdp: 32, continent: 'Europe',
  },
  nz: {
    capital_nl: 'Wellington', capital_en: 'Wellington', capital_es: 'Wellington',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5200000, area: 268021, gdp: 250, continent: 'Oceania',
  },
  id: {
    capital_nl: 'Jakarta', capital_en: 'Jakarta', capital_es: 'Yakarta',
    capitalAliases: { nl: [], en: [], es: ['jakarta'] },
    population: 278000000, area: 1905000, gdp: 1420, continent: 'Asia',
  },
  th: {
    capital_nl: 'Bangkok', capital_en: 'Bangkok', capital_es: 'Bangkok',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 72000000, area: 513120, gdp: 510, continent: 'Asia',
  },
  vn: {
    capital_nl: 'Hanoi', capital_en: 'Hanoi', capital_es: 'Hanói',
    capitalAliases: { nl: [], en: [], es: ['hanoi'] },
    population: 99000000, area: 331212, gdp: 430, continent: 'Asia',
  },
  my: {
    capital_nl: 'Kuala Lumpur', capital_en: 'Kuala Lumpur', capital_es: 'Kuala Lumpur',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 34000000, area: 330803, gdp: 400, continent: 'Asia',
  },
  ph: {
    capital_nl: 'Manila', capital_en: 'Manila', capital_es: 'Manila',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 117000000, area: 300000, gdp: 440, continent: 'Asia',
  },
  ng: {
    capital_nl: 'Abuja', capital_en: 'Abuja', capital_es: 'Abuya',
    capitalAliases: { nl: [], en: [], es: ['abuja'] },
    population: 223000000, area: 923768, gdp: 390, continent: 'Africa',
  },
  ke: {
    capital_nl: 'Nairobi', capital_en: 'Nairobi', capital_es: 'Nairobi',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 55000000, area: 580367, gdp: 110, continent: 'Africa',
  },
  ma: {
    capital_nl: 'Rabat', capital_en: 'Rabat', capital_es: 'Rabat',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 37000000, area: 446550, gdp: 140, continent: 'Africa',
  },
  dz: {
    capital_nl: 'Algiers', capital_en: 'Algiers', capital_es: 'Argel',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 45000000, area: 2382000, gdp: 240, continent: 'Africa',
  },
  tn: {
    capital_nl: 'Tunis', capital_en: 'Tunis', capital_es: 'Túnez',
    capitalAliases: { nl: [], en: [], es: ['tunez'] },
    population: 12000000, area: 163610, gdp: 51, continent: 'Africa',
  },
  co: {
    capital_nl: 'Bogota', capital_en: 'Bogotá', capital_es: 'Bogotá',
    capitalAliases: { nl: ['bogotá'], en: ['bogota'], es: ['bogota'] },
    population: 52000000, area: 1142000, gdp: 360, continent: 'South America',
  },
  cl: {
    capital_nl: 'Santiago', capital_en: 'Santiago', capital_es: 'Santiago',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 20000000, area: 756102, gdp: 340, continent: 'South America',
  },
  pe: {
    capital_nl: 'Lima', capital_en: 'Lima', capital_es: 'Lima',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 34000000, area: 1285000, gdp: 270, continent: 'South America',
  },
  ve: {
    capital_nl: 'Caracas', capital_en: 'Caracas', capital_es: 'Caracas',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 28000000, area: 912050, gdp: 100, continent: 'South America',
  },
  cu: {
    capital_nl: 'Havana', capital_en: 'Havana', capital_es: 'La Habana',
    capitalAliases: { nl: [], en: [], es: ['habana'] },
    population: 11000000, area: 109884, gdp: 107, continent: 'North America',
  },
  il: {
    capital_nl: 'Jeruzalem', capital_en: 'Jerusalem', capital_es: 'Jerusalén',
    capitalAliases: { nl: [], en: [], es: ['jerusalen'] },
    population: 9700000, area: 22072, gdp: 510, continent: 'Asia',
  },
  ae: {
    capital_nl: 'Abu Dhabi', capital_en: 'Abu Dhabi', capital_es: 'Abu Dabi',
    capitalAliases: { nl: [], en: [], es: ['abu dhabi'] },
    population: 9500000, area: 83600, gdp: 500, continent: 'Asia',
  },
  ir: {
    capital_nl: 'Teheran', capital_en: 'Tehran', capital_es: 'Teherán',
    capitalAliases: { nl: [], en: ['teheran'], es: ['teheran'] },
    population: 89000000, area: 1648000, gdp: 400, continent: 'Asia',
  },
  pk: {
    capital_nl: 'Islamabad', capital_en: 'Islamabad', capital_es: 'Islamabad',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 240000000, area: 881913, gdp: 340, continent: 'Asia',
  },
  bd: {
    capital_nl: 'Dhaka', capital_en: 'Dhaka', capital_es: 'Daca',
    capitalAliases: { nl: [], en: [], es: ['dhaka'] },
    population: 173000000, area: 148460, gdp: 460, continent: 'Asia',
  },
  lk: {
    capital_nl: 'Colombo', capital_en: 'Colombo', capital_es: 'Colombo',
    capitalAliases: { nl: ['sri jayawardenepura kotte'], en: ['sri jayawardenepura kotte'], es: [] },
    population: 22000000, area: 65610, gdp: 84, continent: 'Asia',
  },
  kh: {
    capital_nl: 'Phnom Penh', capital_en: 'Phnom Penh', capital_es: 'Nom Pen',
    capitalAliases: { nl: [], en: [], es: ['phnom penh'] },
    population: 17000000, area: 181035, gdp: 32, continent: 'Asia',
  },
  kz: {
    capital_nl: 'Astana', capital_en: 'Astana', capital_es: 'Astaná',
    capitalAliases: { nl: ['nur-sultan', 'nur sultan'], en: ['nur-sultan', 'nur sultan'], es: ['astana'] },
    population: 20000000, area: 2725000, gdp: 260, continent: 'Asia',
  },
  sk: {
    capital_nl: 'Bratislava', capital_en: 'Bratislava', capital_es: 'Bratislava',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5400000, area: 49035, gdp: 130, continent: 'Europe',
  },
  si: {
    capital_nl: 'Ljubljana', capital_en: 'Ljubljana', capital_es: 'Liubliana',
    capitalAliases: { nl: [], en: [], es: ['ljubljana'] },
    population: 2100000, area: 20273, gdp: 68, continent: 'Europe',
  },
  bg: {
    capital_nl: 'Sofia', capital_en: 'Sofia', capital_es: 'Sofía',
    capitalAliases: { nl: [], en: [], es: ['sofia'] },
    population: 6800000, area: 110879, gdp: 100, continent: 'Europe',
  },
  lt: {
    capital_nl: 'Vilnius', capital_en: 'Vilnius', capital_es: 'Vilna',
    capitalAliases: { nl: [], en: [], es: ['vilnius'] },
    population: 2800000, area: 65300, gdp: 78, continent: 'Europe',
  },
  lv: {
    capital_nl: 'Riga', capital_en: 'Riga', capital_es: 'Riga',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1900000, area: 64559, gdp: 45, continent: 'Europe',
  },
  ee: {
    capital_nl: 'Tallinn', capital_en: 'Tallinn', capital_es: 'Tallin',
    capitalAliases: { nl: [], en: [], es: ['tallinn'] },
    population: 1400000, area: 45227, gdp: 40, continent: 'Europe',
  },
  by: {
    capital_nl: 'Minsk', capital_en: 'Minsk', capital_es: 'Minsk',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 9200000, area: 207600, gdp: 72, continent: 'Europe',
  },
  ge: {
    capital_nl: 'Tbilisi', capital_en: 'Tbilisi', capital_es: 'Tiflis',
    capitalAliases: { nl: [], en: [], es: ['tbilisi'] },
    population: 3700000, area: 69700, gdp: 30, continent: 'Asia',
  },
  am: {
    capital_nl: 'Jerevan', capital_en: 'Yerevan', capital_es: 'Ereván',
    capitalAliases: { nl: ['yerevan'], en: [], es: ['yerevan'] },
    population: 3000000, area: 29743, gdp: 24, continent: 'Asia',
  },
  az: {
    capital_nl: 'Bakoe', capital_en: 'Baku', capital_es: 'Bakú',
    capitalAliases: { nl: ['baku'], en: [], es: ['baku'] },
    population: 10200000, area: 86600, gdp: 78, continent: 'Asia',
  },
  iq: {
    capital_nl: 'Bagdad', capital_en: 'Baghdad', capital_es: 'Bagdad',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 44000000, area: 438317, gdp: 250, continent: 'Asia',
  },
  sy: {
    capital_nl: 'Damascus', capital_en: 'Damascus', capital_es: 'Damasco',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 23000000, area: 185180, gdp: 30, continent: 'Asia',
  },
  jo: {
    capital_nl: 'Amman', capital_en: 'Amman', capital_es: 'Amán',
    capitalAliases: { nl: [], en: [], es: ['amman'] },
    population: 11000000, area: 89342, gdp: 51, continent: 'Asia',
  },
  jm: {
    capital_nl: 'Kingston', capital_en: 'Kingston', capital_es: 'Kingston',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2800000, area: 10991, gdp: 19, continent: 'North America',
  },
  mm: {
    capital_nl: 'Naypyidaw', capital_en: 'Naypyidaw', capital_es: 'Naipyidó',
    capitalAliases: { nl: ['nay pyi taw'], en: ['nay pyi taw'], es: ['naypyidaw', 'nay pyi taw'] },
    population: 54000000, area: 676578, gdp: 65, continent: 'Asia',
  },
  sg: {
    capital_nl: 'Singapore', capital_en: 'Singapore', capital_es: 'Singapur',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5900000, area: 728, gdp: 500, continent: 'Asia',
  },
  kw: {
    capital_nl: 'Koeweit-Stad', capital_en: 'Kuwait City', capital_es: 'Ciudad de Kuwait',
    capitalAliases: { nl: ['koeweit stad', 'kuwait city'], en: ['kuwait'], es: ['kuwait'] },
    population: 4300000, area: 17818, gdp: 160, continent: 'Asia',
  },
  qa: {
    capital_nl: 'Doha', capital_en: 'Doha', capital_es: 'Doha',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2700000, area: 11586, gdp: 220, continent: 'Asia',
  },
  bh: {
    capital_nl: 'Manama', capital_en: 'Manama', capital_es: 'Manama',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1500000, area: 765, gdp: 44, continent: 'Asia',
  },
  om: {
    capital_nl: 'Muscat', capital_en: 'Muscat', capital_es: 'Mascate',
    capitalAliases: { nl: ['masqat'], en: ['muskat'], es: ['muscat'] },
    population: 4600000, area: 309500, gdp: 108, continent: 'Asia',
  },
  lb: {
    capital_nl: 'Beiroet', capital_en: 'Beirut', capital_es: 'Beirut',
    capitalAliases: { nl: ['beirut'], en: [], es: [] },
    population: 5500000, area: 10452, gdp: 22, continent: 'Asia',
  },
  mt: {
    capital_nl: 'Valletta', capital_en: 'Valletta', capital_es: 'La Valeta',
    capitalAliases: { nl: [], en: [], es: ['valletta', 'valeta'] },
    population: 540000, area: 316, gdp: 21, continent: 'Europe',
  },
  cy: {
    capital_nl: 'Nicosia', capital_en: 'Nicosia', capital_es: 'Nicosia',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1300000, area: 9251, gdp: 32, continent: 'Europe',
  },
  lu: {
    capital_nl: 'Luxemburg', capital_en: 'Luxembourg', capital_es: 'Luxemburgo',
    capitalAliases: { nl: ['luxemburg-stad'], en: ['luxembourg city'], es: [] },
    population: 660000, area: 2586, gdp: 87, continent: 'Europe',
  },
  uz: {
    capital_nl: 'Tasjkent', capital_en: 'Tashkent', capital_es: 'Taskent',
    capitalAliases: { nl: ['tashkent'], en: [], es: ['tashkent'] },
    population: 36000000, area: 447400, gdp: 90, continent: 'Asia',
  },
  la: {
    capital_nl: 'Vientiane', capital_en: 'Vientiane', capital_es: 'Vientián',
    capitalAliases: { nl: [], en: [], es: ['vientiane'] },
    population: 7600000, area: 236800, gdp: 15, continent: 'Asia',
  },
  tw: {
    capital_nl: 'Taipei', capital_en: 'Taipei', capital_es: 'Taipéi',
    capitalAliases: { nl: [], en: [], es: ['taipei'] },
    population: 23000000, area: 36193, gdp: 790, continent: 'Asia',
  },
  kp: {
    capital_nl: 'Pyongyang', capital_en: 'Pyongyang', capital_es: 'Pionyang',
    capitalAliases: { nl: [], en: [], es: ['pyongyang'] },
    population: 26000000, area: 120540, gdp: 18, continent: 'Asia',
  },
  al: {
    capital_nl: 'Tirana', capital_en: 'Tirana', capital_es: 'Tirana',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2800000, area: 28748, gdp: 23, continent: 'Europe',
  },
  ba: {
    capital_nl: 'Sarajevo', capital_en: 'Sarajevo', capital_es: 'Sarajevo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 3200000, area: 51197, gdp: 27, continent: 'Europe',
  },
  np: {
    capital_nl: 'Kathmandu', capital_en: 'Kathmandu', capital_es: 'Katmandú',
    capitalAliases: { nl: [], en: [], es: ['katmandu', 'kathmandu'] },
    population: 30000000, area: 147181, gdp: 41, continent: 'Asia',
  },
  me: {
    capital_nl: 'Podgorica', capital_en: 'Podgorica', capital_es: 'Podgorica',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 620000, area: 13812, gdp: 7, continent: 'Europe',
  },
  md: {
    capital_nl: 'Chisinau', capital_en: 'Chișinău', capital_es: 'Chisináu',
    capitalAliases: { nl: ['chișinău', 'kisjinjov'], en: ['chisinau'], es: ['chisinau'] },
    population: 2500000, area: 33846, gdp: 16, continent: 'Europe',
  },

  // ══════════════════════════════════════════════════════════
  // HARD
  // ══════════════════════════════════════════════════════════
  et: {
    capital_nl: 'Addis Abeba', capital_en: 'Addis Ababa', capital_es: 'Adís Abeba',
    capitalAliases: { nl: [], en: [], es: ['addis abeba'] },
    population: 126000000, area: 1104000, gdp: 160, continent: 'Africa',
  },
  tz: {
    capital_nl: 'Dodoma', capital_en: 'Dodoma', capital_es: 'Dodoma',
    capitalAliases: { nl: ['dar es salaam'], en: ['dar es salaam'], es: [] },
    population: 67000000, area: 947303, gdp: 79, continent: 'Africa',
  },
  ug: {
    capital_nl: 'Kampala', capital_en: 'Kampala', capital_es: 'Kampala',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 48000000, area: 241550, gdp: 49, continent: 'Africa',
  },
  gh: {
    capital_nl: 'Accra', capital_en: 'Accra', capital_es: 'Acra',
    capitalAliases: { nl: [], en: [], es: ['accra'] },
    population: 34000000, area: 238533, gdp: 76, continent: 'Africa',
  },
  cm: {
    capital_nl: 'Yaoundé', capital_en: 'Yaoundé', capital_es: 'Yaundé',
    capitalAliases: { nl: ['yaounde'], en: ['yaounde'], es: ['yaounde'] },
    population: 28000000, area: 475442, gdp: 48, continent: 'Africa',
  },
  sn: {
    capital_nl: 'Dakar', capital_en: 'Dakar', capital_es: 'Dakar',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 18000000, area: 196722, gdp: 31, continent: 'Africa',
  },
  ci: {
    capital_nl: 'Yamoussoukro', capital_en: 'Yamoussoukro', capital_es: 'Yamusukro',
    capitalAliases: { nl: ['abidjan'], en: ['abidjan'], es: ['yamoussoukro', 'abidjan'] },
    population: 29000000, area: 322463, gdp: 79, continent: 'Africa',
  },
  mz: {
    capital_nl: 'Maputo', capital_en: 'Maputo', capital_es: 'Maputo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 33000000, area: 801590, gdp: 21, continent: 'Africa',
  },
  mg: {
    capital_nl: 'Antananarivo', capital_en: 'Antananarivo', capital_es: 'Antananarivo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 30000000, area: 587041, gdp: 16, continent: 'Africa',
  },
  zm: {
    capital_nl: 'Lusaka', capital_en: 'Lusaka', capital_es: 'Lusaka',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 20000000, area: 752618, gdp: 28, continent: 'Africa',
  },
  zw: {
    capital_nl: 'Harare', capital_en: 'Harare', capital_es: 'Harare',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 16000000, area: 390757, gdp: 26, continent: 'Africa',
  },
  rw: {
    capital_nl: 'Kigali', capital_en: 'Kigali', capital_es: 'Kigali',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 14000000, area: 26338, gdp: 14, continent: 'Africa',
  },
  tg: {
    capital_nl: 'Lomé', capital_en: 'Lomé', capital_es: 'Lomé',
    capitalAliases: { nl: ['lome'], en: ['lome'], es: ['lome'] },
    population: 9000000, area: 56785, gdp: 9, continent: 'Africa',
  },
  bj: {
    capital_nl: 'Porto-Novo', capital_en: 'Porto-Novo', capital_es: 'Porto Novo',
    capitalAliases: { nl: ['porto novo', 'cotonou'], en: ['porto novo', 'cotonou'], es: ['porto novo', 'cotonou'] },
    population: 13000000, area: 112622, gdp: 20, continent: 'Africa',
  },
  bf: {
    capital_nl: 'Ouagadougou', capital_en: 'Ouagadougou', capital_es: 'Uagadugú',
    capitalAliases: { nl: [], en: [], es: ['ouagadougou'] },
    population: 23000000, area: 274200, gdp: 20, continent: 'Africa',
  },
  ml: {
    capital_nl: 'Bamako', capital_en: 'Bamako', capital_es: 'Bamako',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 23000000, area: 1240000, gdp: 21, continent: 'Africa',
  },
  ne: {
    capital_nl: 'Niamey', capital_en: 'Niamey', capital_es: 'Niamey',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 27000000, area: 1267000, gdp: 17, continent: 'Africa',
  },
  td: {
    capital_nl: "N'Djamena", capital_en: "N'Djamena", capital_es: 'Yamena',
    capitalAliases: { nl: ['ndjamena'], en: ['ndjamena'], es: ['ndjamena', 'yamena'] },
    population: 18000000, area: 1284000, gdp: 18, continent: 'Africa',
  },
  cf: {
    capital_nl: 'Bangui', capital_en: 'Bangui', capital_es: 'Bangui',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5700000, area: 622984, gdp: 2, continent: 'Africa',
  },
  so: {
    capital_nl: 'Mogadishu', capital_en: 'Mogadishu', capital_es: 'Mogadiscio',
    capitalAliases: { nl: [], en: [], es: ['mogadishu'] },
    population: 18000000, area: 637657, gdp: 11, continent: 'Africa',
  },
  sd: {
    capital_nl: 'Khartoem', capital_en: 'Khartoum', capital_es: 'Jartum',
    capitalAliases: { nl: ['khartoum'], en: [], es: ['khartoum', 'jartum'] },
    population: 48000000, area: 1886000, gdp: 34, continent: 'Africa',
  },
  ly: {
    capital_nl: 'Tripoli', capital_en: 'Tripoli', capital_es: 'Trípoli',
    capitalAliases: { nl: [], en: [], es: ['tripoli'] },
    population: 7000000, area: 1760000, gdp: 46, continent: 'Africa',
  },
  mr: {
    capital_nl: 'Nouakchott', capital_en: 'Nouakchott', capital_es: 'Nuakchot',
    capitalAliases: { nl: [], en: [], es: ['nouakchott'] },
    population: 4900000, area: 1031000, gdp: 10, continent: 'Africa',
  },
  bo: {
    capital_nl: 'La Paz', capital_en: 'La Paz', capital_es: 'La Paz',
    capitalAliases: { nl: ['sucre'], en: ['sucre'], es: ['sucre'] },
    population: 12000000, area: 1099000, gdp: 46, continent: 'South America',
  },
  py: {
    capital_nl: 'Asunción', capital_en: 'Asunción', capital_es: 'Asunción',
    capitalAliases: { nl: ['asuncion'], en: ['asuncion'], es: ['asuncion'] },
    population: 6900000, area: 406752, gdp: 44, continent: 'South America',
  },
  uy: {
    capital_nl: 'Montevideo', capital_en: 'Montevideo', capital_es: 'Montevideo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 3400000, area: 176215, gdp: 77, continent: 'South America',
  },
  ec: {
    capital_nl: 'Quito', capital_en: 'Quito', capital_es: 'Quito',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 18000000, area: 256369, gdp: 119, continent: 'South America',
  },
  gt: {
    capital_nl: 'Guatemala-Stad', capital_en: 'Guatemala City', capital_es: 'Ciudad de Guatemala',
    capitalAliases: { nl: ['guatemala stad'], en: ['guatemala'], es: ['guatemala'] },
    population: 18000000, area: 108889, gdp: 102, continent: 'North America',
  },
  hn: {
    capital_nl: 'Tegucigalpa', capital_en: 'Tegucigalpa', capital_es: 'Tegucigalpa',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 10000000, area: 112492, gdp: 34, continent: 'North America',
  },
  ni: {
    capital_nl: 'Managua', capital_en: 'Managua', capital_es: 'Managua',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 7000000, area: 130373, gdp: 17, continent: 'North America',
  },
  cr: {
    capital_nl: 'San José', capital_en: 'San José', capital_es: 'San José',
    capitalAliases: { nl: ['san jose'], en: ['san jose'], es: ['san jose'] },
    population: 5200000, area: 51100, gdp: 86, continent: 'North America',
  },
  pa: {
    capital_nl: 'Panama-Stad', capital_en: 'Panama City', capital_es: 'Ciudad de Panamá',
    capitalAliases: { nl: ['panama stad'], en: ['panama'], es: ['panama', 'ciudad de panama'] },
    population: 4400000, area: 75417, gdp: 82, continent: 'North America',
  },
  do: {
    capital_nl: 'Santo Domingo', capital_en: 'Santo Domingo', capital_es: 'Santo Domingo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 11000000, area: 48671, gdp: 121, continent: 'North America',
  },
  ht: {
    capital_nl: 'Port-au-Prince', capital_en: 'Port-au-Prince', capital_es: 'Puerto Príncipe',
    capitalAliases: { nl: ['port au prince'], en: ['port au prince'], es: ['port au prince', 'puerto principe'] },
    population: 11500000, area: 27750, gdp: 20, continent: 'North America',
  },
  mn: {
    capital_nl: 'Ulaanbaatar', capital_en: 'Ulaanbaatar', capital_es: 'Ulán Bator',
    capitalAliases: { nl: ['ulan bator'], en: ['ulan bator'], es: ['ulan bator', 'ulaanbaatar'] },
    population: 3400000, area: 1564000, gdp: 20, continent: 'Asia',
  },
  kg: {
    capital_nl: 'Bisjkek', capital_en: 'Bishkek', capital_es: 'Bishkek',
    capitalAliases: { nl: ['bishkek'], en: [], es: [] },
    population: 7000000, area: 199951, gdp: 14, continent: 'Asia',
  },
  tj: {
    capital_nl: 'Doesjanbe', capital_en: 'Dushanbe', capital_es: 'Dusambé',
    capitalAliases: { nl: ['dushanbe'], en: [], es: ['dushanbe'] },
    population: 10000000, area: 143100, gdp: 12, continent: 'Asia',
  },
  tm: {
    capital_nl: 'Asjchabad', capital_en: 'Ashgabat', capital_es: 'Asjabad',
    capitalAliases: { nl: ['ashgabat'], en: [], es: ['ashgabat'] },
    population: 6400000, area: 488100, gdp: 78, continent: 'Asia',
  },
  af: {
    capital_nl: 'Kaboel', capital_en: 'Kabul', capital_es: 'Kabul',
    capitalAliases: { nl: ['kabul'], en: [], es: [] },
    population: 42000000, area: 652230, gdp: 15, continent: 'Asia',
  },
  mk: {
    capital_nl: 'Skopje', capital_en: 'Skopje', capital_es: 'Skopie',
    capitalAliases: { nl: [], en: [], es: ['skopje'] },
    population: 1800000, area: 25713, gdp: 15, continent: 'Europe',
  },
  xk: {
    capital_nl: 'Pristina', capital_en: 'Pristina', capital_es: 'Pristina',
    capitalAliases: { nl: ['prishtina'], en: ['prishtina'], es: ['prishtina'] },
    population: 1600000, area: 10887, gdp: 10, continent: 'Europe',
  },
  li: {
    capital_nl: 'Vaduz', capital_en: 'Vaduz', capital_es: 'Vaduz',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 39000, area: 160, gdp: 7, continent: 'Europe',
  },
  mc: {
    capital_nl: 'Monaco', capital_en: 'Monaco', capital_es: 'Mónaco',
    capitalAliases: { nl: ['monaco-stad'], en: ['monaco city'], es: ['monaco'] },
    population: 38000, area: 2, gdp: 8, continent: 'Europe',
  },
  ad: {
    capital_nl: 'Andorra la Vella', capital_en: 'Andorra la Vella', capital_es: 'Andorra la Vieja',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 80000, area: 468, gdp: 4, continent: 'Europe',
  },
  sm: {
    capital_nl: 'San Marino', capital_en: 'San Marino', capital_es: 'San Marino',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 34000, area: 61, gdp: 2, continent: 'Europe',
  },
  va: {
    capital_nl: 'Vaticaanstad', capital_en: 'Vatican City', capital_es: 'Ciudad del Vaticano',
    capitalAliases: { nl: ['vaticaan stad'], en: ['vatican'], es: ['vaticano'] },
    population: 800, area: 1, gdp: 1, continent: 'Europe',
  },
  ao: {
    capital_nl: 'Luanda', capital_en: 'Luanda', capital_es: 'Luanda',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 36000000, area: 1247000, gdp: 85, continent: 'Africa',
  },
  na: {
    capital_nl: 'Windhoek', capital_en: 'Windhoek', capital_es: 'Windhoek',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2600000, area: 825615, gdp: 13, continent: 'Africa',
  },
  bw: {
    capital_nl: 'Gaborone', capital_en: 'Gaborone', capital_es: 'Gaborone',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2600000, area: 581730, gdp: 20, continent: 'Africa',
  },
  mw: {
    capital_nl: 'Lilongwe', capital_en: 'Lilongwe', capital_es: 'Lilongüe',
    capitalAliases: { nl: [], en: [], es: ['lilongwe'] },
    population: 21000000, area: 118484, gdp: 13, continent: 'Africa',
  },
  cd: {
    capital_nl: 'Kinshasa', capital_en: 'Kinshasa', capital_es: 'Kinshasa',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 102000000, area: 2345000, gdp: 67, continent: 'Africa',
  },
  cg: {
    capital_nl: 'Brazzaville', capital_en: 'Brazzaville', capital_es: 'Brazzaville',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 6100000, area: 342000, gdp: 15, continent: 'Africa',
  },
  ga: {
    capital_nl: 'Libreville', capital_en: 'Libreville', capital_es: 'Libreville',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2400000, area: 267668, gdp: 21, continent: 'Africa',
  },
  gq: {
    capital_nl: 'Malabo', capital_en: 'Malabo', capital_es: 'Malabo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1700000, area: 28051, gdp: 12, continent: 'Africa',
  },
  gw: {
    capital_nl: 'Bissau', capital_en: 'Bissau', capital_es: 'Bisáu',
    capitalAliases: { nl: [], en: [], es: ['bissau'] },
    population: 2100000, area: 36125, gdp: 2, continent: 'Africa',
  },
  gn: {
    capital_nl: 'Conakry', capital_en: 'Conakry', capital_es: 'Conakri',
    capitalAliases: { nl: [], en: [], es: ['conakry'] },
    population: 14000000, area: 245857, gdp: 24, continent: 'Africa',
  },
  sl: {
    capital_nl: 'Freetown', capital_en: 'Freetown', capital_es: 'Freetown',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 8600000, area: 71740, gdp: 4, continent: 'Africa',
  },
  lr: {
    capital_nl: 'Monrovia', capital_en: 'Monrovia', capital_es: 'Monrovia',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5400000, area: 111369, gdp: 4, continent: 'Africa',
  },
  gm: {
    capital_nl: 'Banjul', capital_en: 'Banjul', capital_es: 'Banjul',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2700000, area: 11295, gdp: 2, continent: 'Africa',
  },
  cv: {
    capital_nl: 'Praia', capital_en: 'Praia', capital_es: 'Praia',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 590000, area: 4033, gdp: 3, continent: 'Africa',
  },
  bi: {
    capital_nl: 'Gitega', capital_en: 'Gitega', capital_es: 'Gitega',
    capitalAliases: { nl: ['bujumbura'], en: ['bujumbura'], es: ['bujumbura'] },
    population: 13000000, area: 27834, gdp: 3, continent: 'Africa',
  },
  ss: {
    capital_nl: 'Juba', capital_en: 'Juba', capital_es: 'Yuba',
    capitalAliases: { nl: [], en: [], es: ['juba'] },
    population: 11000000, area: 619745, gdp: 6, continent: 'Africa',
  },
  ls: {
    capital_nl: 'Maseru', capital_en: 'Maseru', capital_es: 'Maseru',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 2300000, area: 30355, gdp: 2, continent: 'Africa',
  },
  sz: {
    capital_nl: 'Mbabane', capital_en: 'Mbabane', capital_es: 'Mbabane',
    capitalAliases: { nl: ['lobamba'], en: ['lobamba'], es: ['lobamba'] },
    population: 1200000, area: 17364, gdp: 5, continent: 'Africa',
  },
  dj: {
    capital_nl: 'Djibouti-Stad', capital_en: 'Djibouti', capital_es: 'Yibuti',
    capitalAliases: { nl: ['djibouti'], en: ['djibouti city'], es: ['djibouti', 'yibuti'] },
    population: 1100000, area: 23200, gdp: 4, continent: 'Africa',
  },
  er: {
    capital_nl: 'Asmara', capital_en: 'Asmara', capital_es: 'Asmara',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 3700000, area: 117600, gdp: 2, continent: 'Africa',
  },
  km: {
    capital_nl: 'Moroni', capital_en: 'Moroni', capital_es: 'Moroni',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 850000, area: 1862, gdp: 1, continent: 'Africa',
  },
  st: {
    capital_nl: 'São Tomé', capital_en: 'São Tomé', capital_es: 'Santo Tomé',
    capitalAliases: { nl: ['sao tome'], en: ['sao tome'], es: ['sao tome', 'santo tome'] },
    population: 230000, area: 964, gdp: 1, continent: 'Africa',
  },
  sc: {
    capital_nl: 'Victoria', capital_en: 'Victoria', capital_es: 'Victoria',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 100000, area: 452, gdp: 2, continent: 'Africa',
  },
  mu: {
    capital_nl: 'Port Louis', capital_en: 'Port Louis', capital_es: 'Port Louis',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1300000, area: 2040, gdp: 14, continent: 'Africa',
  },
  ye: {
    capital_nl: 'Sanaa', capital_en: 'Sanaa', capital_es: 'Saná',
    capitalAliases: { nl: ["sana'a"], en: ["sana'a"], es: ['sanaa'] },
    population: 34000000, area: 527968, gdp: 21, continent: 'Asia',
  },
  tt: {
    capital_nl: 'Port of Spain', capital_en: 'Port of Spain', capital_es: 'Puerto España',
    capitalAliases: { nl: ['port-of-spain'], en: ['port-of-spain'], es: ['puerto espana', 'port of spain'] },
    population: 1500000, area: 5130, gdp: 28, continent: 'North America',
  },
  bb: {
    capital_nl: 'Bridgetown', capital_en: 'Bridgetown', capital_es: 'Bridgetown',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 280000, area: 430, gdp: 6, continent: 'North America',
  },
  bs: {
    capital_nl: 'Nassau', capital_en: 'Nassau', capital_es: 'Nassau',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 410000, area: 13943, gdp: 14, continent: 'North America',
  },
  gd: {
    capital_nl: "Saint George's", capital_en: "Saint George's", capital_es: 'Saint George',
    capitalAliases: { nl: ['st georges'], en: ['st georges', 'saint georges'], es: ['saint georges'] },
    population: 125000, area: 344, gdp: 1, continent: 'North America',
  },
  lc: {
    capital_nl: 'Castries', capital_en: 'Castries', capital_es: 'Castries',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 180000, area: 617, gdp: 2, continent: 'North America',
  },
  vc: {
    capital_nl: 'Kingstown', capital_en: 'Kingstown', capital_es: 'Kingstown',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 100000, area: 389, gdp: 1, continent: 'North America',
  },
  ag: {
    capital_nl: "Saint John's", capital_en: "Saint John's", capital_es: 'Saint John',
    capitalAliases: { nl: ['st johns'], en: ['st johns', 'saint johns'], es: ['saint johns'] },
    population: 94000, area: 442, gdp: 2, continent: 'North America',
  },
  dm: {
    capital_nl: 'Roseau', capital_en: 'Roseau', capital_es: 'Roseau',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 73000, area: 751, gdp: 1, continent: 'North America',
  },
  kn: {
    capital_nl: 'Basseterre', capital_en: 'Basseterre', capital_es: 'Basseterre',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 47000, area: 261, gdp: 1, continent: 'North America',
  },
  sv: {
    capital_nl: 'San Salvador', capital_en: 'San Salvador', capital_es: 'San Salvador',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 6300000, area: 21041, gdp: 34, continent: 'North America',
  },
  bz: {
    capital_nl: 'Belmopan', capital_en: 'Belmopan', capital_es: 'Belmopán',
    capitalAliases: { nl: [], en: [], es: ['belmopan'] },
    population: 410000, area: 22966, gdp: 3, continent: 'North America',
  },
  gy: {
    capital_nl: 'Georgetown', capital_en: 'Georgetown', capital_es: 'Georgetown',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 810000, area: 214969, gdp: 17, continent: 'South America',
  },
  sr: {
    capital_nl: 'Paramaribo', capital_en: 'Paramaribo', capital_es: 'Paramaribo',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 620000, area: 163820, gdp: 4, continent: 'South America',
  },
  pg: {
    capital_nl: 'Port Moresby', capital_en: 'Port Moresby', capital_es: 'Puerto Moresby',
    capitalAliases: { nl: [], en: [], es: ['port moresby'] },
    population: 10000000, area: 462840, gdp: 31, continent: 'Oceania',
  },
  fj: {
    capital_nl: 'Suva', capital_en: 'Suva', capital_es: 'Suva',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 930000, area: 18274, gdp: 5, continent: 'Oceania',
  },
  ws: {
    capital_nl: 'Apia', capital_en: 'Apia', capital_es: 'Apia',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 220000, area: 2842, gdp: 1, continent: 'Oceania',
  },
  to: {
    capital_nl: "Nuku'alofa", capital_en: "Nuku'alofa", capital_es: 'Nukualofa',
    capitalAliases: { nl: ['nukualofa'], en: ['nukualofa'], es: ["nuku'alofa"] },
    population: 105000, area: 747, gdp: 1, continent: 'Oceania',
  },
  vu: {
    capital_nl: 'Port Vila', capital_en: 'Port Vila', capital_es: 'Port Vila',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 320000, area: 12189, gdp: 1, continent: 'Oceania',
  },
  sb: {
    capital_nl: 'Honiara', capital_en: 'Honiara', capital_es: 'Honiara',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 720000, area: 28896, gdp: 2, continent: 'Oceania',
  },
  ki: {
    capital_nl: 'Tarawa', capital_en: 'Tarawa', capital_es: 'Tarawa',
    capitalAliases: { nl: ['south tarawa'], en: ['south tarawa'], es: [] },
    population: 130000, area: 811, gdp: 1, continent: 'Oceania',
  },
  fm: {
    capital_nl: 'Palikir', capital_en: 'Palikir', capital_es: 'Palikir',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 110000, area: 702, gdp: 1, continent: 'Oceania',
  },
  mh: {
    capital_nl: 'Majuro', capital_en: 'Majuro', capital_es: 'Majuro',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 42000, area: 181, gdp: 1, continent: 'Oceania',
  },
  pw: {
    capital_nl: 'Ngerulmud', capital_en: 'Ngerulmud', capital_es: 'Ngerulmud',
    capitalAliases: { nl: ['melekeok'], en: ['melekeok'], es: [] },
    population: 18000, area: 459, gdp: 1, continent: 'Oceania',
  },
  nr: {
    capital_nl: 'Yaren', capital_en: 'Yaren', capital_es: 'Yaren',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 12000, area: 21, gdp: 1, continent: 'Oceania',
  },
  tv: {
    capital_nl: 'Funafuti', capital_en: 'Funafuti', capital_es: 'Funafuti',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 11000, area: 26, gdp: 1, continent: 'Oceania',
  },
  tl: {
    capital_nl: 'Dili', capital_en: 'Dili', capital_es: 'Dili',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 1400000, area: 14874, gdp: 2, continent: 'Asia',
  },
  bn: {
    capital_nl: 'Bandar Seri Begawan', capital_en: 'Bandar Seri Begawan', capital_es: 'Bandar Seri Begawan',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 450000, area: 5765, gdp: 15, continent: 'Asia',
  },
  mv: {
    capital_nl: 'Malé', capital_en: 'Malé', capital_es: 'Malé',
    capitalAliases: { nl: ['male'], en: ['male'], es: ['male'] },
    population: 520000, area: 300, gdp: 7, continent: 'Asia',
  },
  bt: {
    capital_nl: 'Thimphu', capital_en: 'Thimphu', capital_es: 'Timbu',
    capitalAliases: { nl: [], en: [], es: ['thimphu'] },
    population: 790000, area: 38394, gdp: 3, continent: 'Asia',
  },
  ps: {
    capital_nl: 'Ramallah', capital_en: 'Ramallah', capital_es: 'Ramala',
    capitalAliases: { nl: ['oost-jeruzalem'], en: ['east jerusalem'], es: ['ramallah'] },
    population: 5400000, area: 6020, gdp: 18, continent: 'Asia',
  },
  hk: {
    capital_nl: 'Hongkong', capital_en: 'Hong Kong', capital_es: 'Hong Kong',
    capitalAliases: { nl: ['hong kong'], en: [], es: [] },
    population: 7500000, area: 1104, gdp: 380, continent: 'Asia',
  },
  gl: {
    capital_nl: 'Nuuk', capital_en: 'Nuuk', capital_es: 'Nuuk',
    capitalAliases: { nl: ['godthåb'], en: ['godthab'], es: [] },
    population: 57000, area: 2166000, gdp: 3, continent: 'North America',
  },
  aw: {
    capital_nl: 'Oranjestad', capital_en: 'Oranjestad', capital_es: 'Oranjestad',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 107000, area: 180, gdp: 4, continent: 'North America',
  },

  // ══════════════════════════════════════════════════════════
  // EXTREME
  // ══════════════════════════════════════════════════════════
  fo: {
    capital_nl: 'Tórshavn', capital_en: 'Tórshavn', capital_es: 'Tórshavn',
    capitalAliases: { nl: ['torshavn'], en: ['torshavn'], es: ['torshavn'] },
    population: 54000, area: 1393, gdp: 3, continent: 'Europe',
  },
  gi: {
    capital_nl: 'Gibraltar', capital_en: 'Gibraltar', capital_es: 'Gibraltar',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 33000, area: 7, gdp: 3, continent: 'Europe',
  },
  im: {
    capital_nl: 'Douglas', capital_en: 'Douglas', capital_es: 'Douglas',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 84000, area: 572, gdp: 7, continent: 'Europe',
  },
  je: {
    capital_nl: 'Saint Helier', capital_en: 'Saint Helier', capital_es: 'Saint Helier',
    capitalAliases: { nl: ['st helier'], en: ['st helier'], es: [] },
    population: 103000, area: 119, gdp: 6, continent: 'Europe',
  },
  gg: {
    capital_nl: 'Saint Peter Port', capital_en: 'Saint Peter Port', capital_es: 'Saint Peter Port',
    capitalAliases: { nl: ['st peter port'], en: ['st peter port'], es: [] },
    population: 64000, area: 78, gdp: 4, continent: 'Europe',
  },
  ax: {
    capital_nl: 'Mariehamn', capital_en: 'Mariehamn', capital_es: 'Mariehamn',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 30000, area: 1580, gdp: 2, continent: 'Europe',
  },
  nc: {
    capital_nl: 'Nouméa', capital_en: 'Nouméa', capital_es: 'Numea',
    capitalAliases: { nl: ['noumea'], en: ['noumea'], es: ['noumea'] },
    population: 270000, area: 18575, gdp: 10, continent: 'Oceania',
  },
  pf: {
    capital_nl: 'Papeete', capital_en: 'Papeete', capital_es: 'Papeete',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 280000, area: 4167, gdp: 6, continent: 'Oceania',
  },
  re: {
    capital_nl: 'Saint-Denis', capital_en: 'Saint-Denis', capital_es: 'Saint-Denis',
    capitalAliases: { nl: ['saint denis'], en: ['saint denis'], es: ['saint denis'] },
    population: 870000, area: 2511, gdp: 21, continent: 'Africa',
  },
  yt: {
    capital_nl: 'Mamoudzou', capital_en: 'Mamoudzou', capital_es: 'Mamoudzou',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 320000, area: 374, gdp: 3, continent: 'Africa',
  },
  mq: {
    capital_nl: 'Fort-de-France', capital_en: 'Fort-de-France', capital_es: 'Fort-de-France',
    capitalAliases: { nl: ['fort de france'], en: ['fort de france'], es: ['fort de france'] },
    population: 360000, area: 1128, gdp: 9, continent: 'North America',
  },
  gp: {
    capital_nl: 'Basse-Terre', capital_en: 'Basse-Terre', capital_es: 'Basse-Terre',
    capitalAliases: { nl: ['basse terre', 'pointe-a-pitre'], en: ['basse terre', 'pointe-a-pitre'], es: ['basse terre'] },
    population: 380000, area: 1628, gdp: 9, continent: 'North America',
  },
  gf: {
    capital_nl: 'Cayenne', capital_en: 'Cayenne', capital_es: 'Cayena',
    capitalAliases: { nl: [], en: [], es: ['cayenne'] },
    population: 300000, area: 83534, gdp: 5, continent: 'South America',
  },
  pm: {
    capital_nl: 'Saint-Pierre', capital_en: 'Saint-Pierre', capital_es: 'Saint-Pierre',
    capitalAliases: { nl: ['saint pierre'], en: ['saint pierre'], es: ['saint pierre'] },
    population: 6000, area: 242, gdp: 1, continent: 'North America',
  },
  cw: {
    capital_nl: 'Willemstad', capital_en: 'Willemstad', capital_es: 'Willemstad',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 155000, area: 444, gdp: 3, continent: 'North America',
  },
  sx: {
    capital_nl: 'Philipsburg', capital_en: 'Philipsburg', capital_es: 'Philipsburg',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 44000, area: 34, gdp: 1, continent: 'North America',
  },
  pr: {
    capital_nl: 'San Juan', capital_en: 'San Juan', capital_es: 'San Juan',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 3200000, area: 9104, gdp: 117, continent: 'North America',
  },
  gu: {
    capital_nl: 'Hagåtña', capital_en: 'Hagåtña', capital_es: 'Hagåtña',
    capitalAliases: { nl: ['hagatna', 'agana'], en: ['hagatna', 'agana'], es: ['hagatna'] },
    population: 170000, area: 549, gdp: 6, continent: 'Oceania',
  },
  vi: {
    capital_nl: 'Charlotte Amalie', capital_en: 'Charlotte Amalie', capital_es: 'Charlotte Amalie',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 87000, area: 347, gdp: 4, continent: 'North America',
  },
  as: {
    capital_nl: 'Pago Pago', capital_en: 'Pago Pago', capital_es: 'Pago Pago',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 45000, area: 199, gdp: 1, continent: 'Oceania',
  },
  mp: {
    capital_nl: 'Saipan', capital_en: 'Saipan', capital_es: 'Saipán',
    capitalAliases: { nl: [], en: [], es: ['saipan'] },
    population: 48000, area: 464, gdp: 1, continent: 'Oceania',
  },
  vg: {
    capital_nl: 'Road Town', capital_en: 'Road Town', capital_es: 'Road Town',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 32000, area: 151, gdp: 1, continent: 'North America',
  },
  ky: {
    capital_nl: 'George Town', capital_en: 'George Town', capital_es: 'George Town',
    capitalAliases: { nl: ['georgetown'], en: ['georgetown'], es: ['georgetown'] },
    population: 69000, area: 264, gdp: 5, continent: 'North America',
  },
  tc: {
    capital_nl: 'Cockburn Town', capital_en: 'Cockburn Town', capital_es: 'Cockburn Town',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 46000, area: 948, gdp: 1, continent: 'North America',
  },
  ms: {
    capital_nl: 'Plymouth', capital_en: 'Plymouth', capital_es: 'Plymouth',
    capitalAliases: { nl: ['brades'], en: ['brades'], es: ['brades'] },
    population: 4400, area: 102, gdp: 1, continent: 'North America',
  },
  ai: {
    capital_nl: 'The Valley', capital_en: 'The Valley', capital_es: 'The Valley',
    capitalAliases: { nl: ['valley'], en: ['valley'], es: ['valley'] },
    population: 16000, area: 91, gdp: 1, continent: 'North America',
  },
  fk: {
    capital_nl: 'Stanley', capital_en: 'Stanley', capital_es: 'Puerto Argentino',
    capitalAliases: { nl: ['port stanley'], en: ['port stanley'], es: ['stanley', 'puerto stanley'] },
    population: 3600, area: 12173, gdp: 1, continent: 'South America',
  },
  sh: {
    capital_nl: 'Jamestown', capital_en: 'Jamestown', capital_es: 'Jamestown',
    capitalAliases: { nl: [], en: [], es: [] },
    population: 5300, area: 394, gdp: 1, continent: 'Africa',
  },
  mo: {
    capital_nl: 'Macau', capital_en: 'Macau', capital_es: 'Macao',
    capitalAliases: { nl: ['macao'], en: ['macao'], es: ['macau'] },
    population: 690000, area: 33, gdp: 47, continent: 'Asia',
  },
  eh: {
    capital_nl: 'El Aaiún', capital_en: 'El Aaiún', capital_es: 'El Aaiún',
    capitalAliases: { nl: ['el aaiun', 'laayoune'], en: ['el aaiun', 'laayoune'], es: ['el aaiun'] },
    population: 570000, area: 266000, gdp: 1, continent: 'Africa',
  },
};
