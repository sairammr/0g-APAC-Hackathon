-- Track which 0G Compute provider produced each TEE-verified decision so the
-- UI can deep-link from a tick to the provider's on-chain entity and fetch
-- the per-chat attestation signature from the broker SDK.
alter table public.ticks
  add column if not exists provider_addr text;
