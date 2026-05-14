const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const getAgent = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}`, { cache: 'no-store' }).then(r => r.json());
export const getDemoState = () =>
  fetch(`${BASE}/api/demo-state`, { cache: 'no-store' }).then(r => r.json());
export const getSnapshots = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/snapshots`, { cache: 'no-store' }).then(r => r.json());
export const getLineage = (id: number | string) =>
  fetch(`${BASE}/api/agent/${id}/lineage`, { cache: 'no-store' }).then(r => r.json());
