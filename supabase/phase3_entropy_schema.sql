-- Phase 3: Pyth Entropy support (coinflip v1)
-- Safe to run multiple times.

create table if not exists casino_entropy_rounds (
  id bigserial primary key,
  round_id text unique not null,
  agent text not null,
  game text not null default 'coinflip',
  bet_amount numeric not null,
  choice text,
  request_id text,
  request_tx_hash text,
  fulfill_tx_hash text,
  entropy_value text,
  state text not null default 'entropy_requested',
  won boolean,
  payout numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_casino_entropy_rounds_agent_created
  on casino_entropy_rounds(agent, created_at desc);

create index if not exists idx_casino_entropy_rounds_state
  on casino_entropy_rounds(state);
