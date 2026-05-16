-- iNFT² initial schema
-- Generates the full set of tables consumed by the backend indexer and API.
-- Apply manually via Supabase Studio (SQL editor) or `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- agents: one row per iNFT² token (manager / trader / etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.agents (
  token_id        text primary key,
  owner           text,
  role            text,                 -- 'manager' | 'trader' | null
  brain_root      text,                 -- bytes32 hex (latest known)
  brain_uri       text,
  policy_uri      text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists agents_owner_idx on public.agents(owner);
create index if not exists agents_role_idx  on public.agents(role);

-- ---------------------------------------------------------------------------
-- snapshots: SnapshotPublished events + fetched 0G storage blob
-- ---------------------------------------------------------------------------
create table if not exists public.snapshots (
  id              bigserial primary key,
  token_id        text not null,
  ts              bigint not null,                -- unix seconds (from event)
  storage_root    text not null,                  -- bytes32 hex
  realized_pnl    text not null default '0',
  sharpe_e6       bigint,
  da_epoch        text,
  da_verified     boolean not null default false,
  prev_brain_root text,
  curr_brain_root text,
  blob_json       jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists snapshots_token_ts_idx on public.snapshots(token_id, ts desc);
create unique index if not exists snapshots_root_uq on public.snapshots(token_id, storage_root);

-- ---------------------------------------------------------------------------
-- intents: IntentExecuted events from AgentController
-- ---------------------------------------------------------------------------
create table if not exists public.intents (
  id              bigserial primary key,
  token_id        text not null,                  -- childId
  nonce           text not null default '0',
  target          text,
  value           text not null default '0',
  call_data       text,                           -- hex (callHash or raw)
  expiry          text not null default '0',
  tx_hash         text,
  ts              bigint not null,
  created_at      timestamptz not null default now()
);

create index if not exists intents_token_ts_idx on public.intents(token_id, ts desc);

-- ---------------------------------------------------------------------------
-- transfers: Transfer + BrainReKeyed events
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  id              bigserial primary key,
  token_id        text not null,
  from_addr       text not null,
  to_addr         text not null,
  new_brain_root  text not null default '',
  tx_hash         text,
  ts              bigint not null,
  created_at      timestamptz not null default now()
);

create index if not exists transfers_token_ts_idx on public.transfers(token_id, ts desc);

-- ---------------------------------------------------------------------------
-- equity: time series of agent equity (written by runtime)
-- ---------------------------------------------------------------------------
create table if not exists public.equity (
  id              bigserial primary key,
  token_id        text not null,
  ts              bigint not null,
  value           text not null
);

create index if not exists equity_token_ts_idx on public.equity(token_id, ts);

-- ---------------------------------------------------------------------------
-- ticks: time series of strategy actions (written by runtime)
-- ---------------------------------------------------------------------------
create table if not exists public.ticks (
  id              bigserial primary key,
  token_id        text not null,
  ts              bigint not null,
  action          text not null,
  size_bps        int,
  tx_hash         text,
  tee_verified    boolean,
  chat_id         text
);

create index if not exists ticks_token_ts_idx on public.ticks(token_id, ts);

-- ---------------------------------------------------------------------------
-- indexer_meta: simple key/value (e.g. last_indexed_block)
-- ---------------------------------------------------------------------------
create table if not exists public.indexer_meta (
  key             text primary key,
  value           text not null,
  updated_at      timestamptz not null default now()
);
