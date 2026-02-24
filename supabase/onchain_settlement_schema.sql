-- Onchain settlement tracking schema

alter table casino_channels add column if not exists settlement_mode text default 'offchain-ledger';
alter table casino_channels add column if not exists chain_id integer;
alter table casino_channels add column if not exists open_tx_hash text;
alter table casino_channels add column if not exists fund_tx_hash text;
alter table casino_channels add column if not exists close_tx_hash text;
alter table casino_channels add column if not exists open_block bigint;
alter table casino_channels add column if not exists fund_block bigint;
alter table casino_channels add column if not exists close_block bigint;
alter table casino_channels add column if not exists settled_onchain boolean default false;

create table if not exists casino_settlement_txs (
  id bigserial primary key,
  agent text not null,
  action text not null, -- open|fund|close
  tx_hash text not null unique,
  chain_id integer not null,
  status text not null default 'submitted', -- submitted|mined|failed
  block_number bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settlement_agent_action on casino_settlement_txs(agent, action, created_at desc);
create index if not exists idx_channels_settlement_mode on casino_channels(settlement_mode);
