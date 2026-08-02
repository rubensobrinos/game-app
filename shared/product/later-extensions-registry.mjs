// later-extensions-registry.mjs
//
// "Latere uitbreidingen — niet launch-blocking" uit PRODUCT.md, letterlijk
// overgenomen. `qualifies` is optioneel en verwijst naar een EXCLUDED_FROM_MVP-id
// (mvp-scope-guard.mjs, PD1) wanneer dit item een MVP-uitsluiting bewust
// kwalificeert/versoepelt in plaats van ermee te botsen — bijvoorbeeld een
// optionele spectatorroute tegenover de MVP-uitsluiting "spectator-scherm als
// vereiste". Geen disjointness-check: inhoudelijke samenhang is hier het punt,
// geen tegenspraak.
export const LATER_EXTENSIONS = Object.freeze([
  { id: 'generated_group_flag_or_badge', text: 'gegenereerde groepsvlag of groepsbadge', qualifies: null },
  { id: 'vote_on_generated_designs', text: 'stemmen op meerdere gegenereerde ontwerpen', qualifies: null },
  { id: 'save_and_reuse_flag_or_badge', text: 'vlag/badge bewaren en opnieuw gebruiken', qualifies: null },
  { id: 'branded_end_card', text: 'branded eindkaart', qualifies: null },
  { id: 'seasonal_or_event_formats', text: 'seizoens- of eventformats', qualifies: null },
  { id: 'multi_night_team_competitions', text: 'teamcompetities over meerdere avonden', qualifies: null },
  { id: 'optional_spectator_route', text: 'optionele spectator-route', qualifies: 'spectator_screen_required' },
  { id: 'paid_white_label_or_event_versions', text: 'betaalde white-label- of eventversies', qualifies: 'payments_or_premium' },
]);
