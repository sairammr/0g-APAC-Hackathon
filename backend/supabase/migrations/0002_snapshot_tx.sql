-- Capture the SnapshotAttestor.submit() tx hash on each indexed snapshot row
-- so the frontend can deep-link to the on-chain receipt on chainscan-galileo.
alter table public.snapshots
  add column if not exists submit_tx_hash text;
