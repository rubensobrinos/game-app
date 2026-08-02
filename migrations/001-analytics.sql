-- migrations/001-analytics.sql — persistente analytics, letterlijk het schema
-- uit docs/multiplayer/DATA-MODEL.md ("Persistente analytics").
-- Privacy-minimaal: alleen aggregaten; geen namen, tokens of IP's
-- (DATA-MODEL.md, "Wat niet persistent wordt opgeslagen").
-- Wordt automatisch uitgevoerd door de postgres-container bij een lege
-- datadirectory (docker-entrypoint-initdb.d).

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY,
  room_id_hash text NOT NULL,
  match_sequence integer NOT NULL,
  created_at timestamptz NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  language text NOT NULL,
  difficulty text NOT NULL,
  pacing text NOT NULL,
  mode text NOT NULL,
  game_types text[] NOT NULL,
  total_rounds integer NOT NULL,
  max_player_count integer NOT NULL,
  late_join_count integer NOT NULL,
  joins_via_qr integer NOT NULL,
  joins_via_link integer NOT NULL,
  joins_via_code integer NOT NULL,
  share_qr_open_count integer NOT NULL,
  share_link_open_count integer NOT NULL,
  finished_normally boolean NOT NULL,
  rematch_of uuid NULL
);

CREATE TABLE IF NOT EXISTS round_stats (
  id uuid PRIMARY KEY,
  game_session_id uuid NOT NULL,
  round_number integer NOT NULL,
  game_type text NOT NULL,
  question_key text NOT NULL,
  answer_count integer NOT NULL,
  correct_count integer NOT NULL,
  average_answer_ms integer,
  no_answer_count integer NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  date date PRIMARY KEY,
  rooms_created integer NOT NULL,
  games_started integer NOT NULL,
  games_finished integer NOT NULL,
  players_joined integer NOT NULL,
  rematches integer NOT NULL,
  median_players_per_game numeric,
  median_join_to_start_seconds numeric
);
