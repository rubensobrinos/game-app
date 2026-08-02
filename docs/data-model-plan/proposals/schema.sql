-- VOORSTEL, GEEN MIGRATIE. Niet uitvoeren zonder database-engine-ADR (docs/data-model-plan/README.md checkpoint 8).
--
-- Letterlijke transcriptie van de drie CREATE TABLE-statements uit
-- docs/multiplayer/DATA-MODEL.md, sectie "Persistente analytics", ongewijzigd.
-- Zie docs/data-model-plan/proposals/analytics-event-contract.md voor de
-- bijbehorende kolomtraceabiliteitsmatrix en het voorgestelde eventcontract.

game_sessions(
  id uuid primary key,
  room_id_hash text not null,
  match_sequence integer not null,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  language text not null,
  difficulty text not null,
  pacing text not null,
  mode text not null,
  game_types text[] not null,
  total_rounds integer not null,
  max_player_count integer not null,
  late_join_count integer not null,
  joins_via_qr integer not null,
  joins_via_link integer not null,
  joins_via_code integer not null,
  share_qr_open_count integer not null,
  share_link_open_count integer not null,
  finished_normally boolean not null,
  rematch_of uuid null
);

round_stats(
  id uuid primary key,
  game_session_id uuid not null,
  round_number integer not null,
  game_type text not null,
  question_key text not null,
  answer_count integer not null,
  correct_count integer not null,
  average_answer_ms integer,
  no_answer_count integer not null
);

daily_metrics(
  date date primary key,
  rooms_created integer not null,
  games_started integer not null,
  games_finished integer not null,
  players_joined integer not null,
  rematches integer not null,
  median_players_per_game numeric,
  median_join_to_start_seconds numeric
);
