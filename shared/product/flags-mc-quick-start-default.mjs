// flags-mc-quick-start-default.mjs
//
// Quick-start default per DECISIONS.md #35 ("Kernflow quick-start blijft
// bestaan"). Dit vervangt niet de stopgezette Groepsbattle-preset (#31,
// quick-start-preset.mjs) — het is de nieuwe, actuele default voor de
// kern-quickstartflow. Zelfde patroon als quick-start-preset.mjs (PD2):
// shared/product/ levert alleen de canonieke waarden; consumenten
// (host-setup-state.mjs / GF, de walking skeleton / INT-A) importeren in
// plaats van over te typen.
export const FLAGS_MC_QUICK_START_DEFAULT = Object.freeze({
  gameTypes: Object.freeze(['flags_mc']),
  totalRounds: 10,
  difficulty: 'normal',
  mode: 'individual',
  pacing: 'auto',
  speedBonus: true,
  allowLateJoin: true,
});
