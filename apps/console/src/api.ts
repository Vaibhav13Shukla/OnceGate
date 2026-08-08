/// <reference types="vite/client" />

const gateUrl = import.meta.env.VITE_GATE_URL ?? '';
const adminHeaders = (token: string): Record<string, string> => token ? { authorization: `Bearer ${token}` } : {};

export type Receipt = { id: string; idempotency_key: string; status: 'PENDING'|'COMMITTED'|'FAILED'|'UNKNOWN'; attempt_count: number; created_at: string; resolution_note?: string };
export type Stats = { total: number; replayed: number; conflicts_in_flight: number; mismatches: number; unknown_open: number; duplicates_prevented: number };
export const api = {
  stats: (token: string) => get<Stats>('/v1/stats', token),
  receipts: (token: string) => get<{ items: Receipt[] }>('/v1/receipts?limit=50', token),
  receipt: (id: string, token: string) => get<Receipt & { events: { id: number; kind: string; detail: Record<string, unknown>; created_at: string }[] }>(`/v1/receipts/${id}`, token),
  resolve: (id: string, status: 'COMMITTED'|'FAILED', note: string, token: string) => request(`/v1/receipts/${id}/resolve`, token, { method: 'POST', body: JSON.stringify({ status, note }) }),
  charge: (key: string, chaos?: string) => request('/p/charge', '', { method: 'POST', headers: { 'idempotency-key': key, 'content-type': 'application/json', ...(chaos ? { 'x-chaos': chaos } : {}) }, body: JSON.stringify({ amount: 4200, currency: 'INR', card_last4: '4242' }) }),
  chargeCount: () => get<{ count: number }>('/p/charges/count', ''),
  resetCharges: () => request('/p/charges', '', { method: 'DELETE' })
};
async function get<T>(path: string, token: string): Promise<T> { return request(path, token) as Promise<T>; }
async function request(path: string, token: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { ...adminHeaders(token), ...(init.headers as Record<string, string> ?? {}) };
  const response = await fetch(`${gateUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail ?? `Request failed (${response.status})`);
  return body;
}
