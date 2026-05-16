const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const getAgent = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}`, { cache: 'no-store' }).then(r => r.json());
export const getDemoState = () =>
  fetch(`${BASE}/api/demo-state`, { cache: 'no-store' }).then(r => r.json());
export const getSnapshots = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/snapshots`, { cache: 'no-store' }).then(r => r.json());
export const getLineage = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/lineage`, { cache: 'no-store' }).then(r => r.json());
export const getTicks = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/ticks`, { cache: 'no-store' }).then(r => r.json());
export const getEquity = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/equity`, { cache: 'no-store' }).then(r => r.json());
export const getContracts = () =>
  fetch(`${BASE}/api/contracts`, { cache: 'no-store' }).then(r => r.json());
export const getAttestation = (tickId: number | string) =>
  fetch(`${BASE}/api/attestation/${tickId}`, { cache: 'no-store' }).then(r => r.json());
export const createTree = (owner: string, pubkey: string) =>
  fetch(`${BASE}/api/create-tree`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner, pubkey }),
  }).then(r => r.json());
