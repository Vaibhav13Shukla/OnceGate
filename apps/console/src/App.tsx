import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Receipt, type Stats } from './api';

const newKey = () => crypto.randomUUID();
const statusClass = (status: Receipt['status']) => `chip-status ${status.toLowerCase()}`;

type DetailReceipt = Receipt & {
  events: { id: number; kind: string; detail: Record<string, unknown>; created_at: string }[];
  method?: string;
  path?: string;
  upstream_status?: number | null;
  fingerprint?: string;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const GateLogo = () => (
  <svg className="logo-icon" viewBox="0 0 36 36" fill="currentColor">
    <path d="M18 0L22.5 13.5L36 18L22.5 22.5L18 36L13.5 22.5L0 18L13.5 13.5L18 0Z" />
  </svg>
);

export default function App() {
  const [token, setToken] = useState('admin-secret');
  const [stats, setStats] = useState<Stats>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [chargeCount, setChargeCount] = useState<number>();
  const [selected, setSelected] = useState<Receipt>();
  const [detail, setDetail] = useState<DetailReceipt>();
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // In-App Resolution Modal State
  const [resolveTarget, setResolveTarget] = useState<'COMMITTED' | 'FAILED' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const countRes = await api.chargeCount().catch(() => null);
      if (countRes) setChargeCount(countRes.count);

      const activeToken = tokenRef.current;
      if (!activeToken) { setLoading(false); return; }

      const [nextStats, nextReceipts] = await Promise.all([
        api.stats(activeToken).catch(() => null),
        api.receipts(activeToken).catch(() => null)
      ]);

      if (nextStats) setStats(nextStats);
      if (nextReceipts) setReceipts(nextReceipts.items);
    } catch {
      // Quiet background polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const inspect = async (receipt: Receipt) => {
    setSelected(receipt);
    try {
      setDetail(await api.receipt(receipt.id, token));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load receipt details');
    }
  };

  const send = async (chaos?: string, storm = false) => {
    const key = newKey();
    setSending(true);
    showToast(storm ? 'Dispatching 25 concurrent requests...' : chaos === 'slow' ? 'Simulating upstream timeout...' : chaos === 'die' ? 'Simulating upstream process crash...' : 'Dispatching test request...');
    try {
      const replies = await Promise.all(
        Array.from({ length: storm ? 25 : 1 }, () => api.charge(key, chaos))
      );
      showToast(storm ? `Processed ${replies.length} requests — duplicates intercepted` : 'Operation processed successfully');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operation failed');
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const confirmResolve = async () => {
    if (!detail || !resolveTarget) return;
    if (!resolutionNote.trim()) {
      showToast('Resolution audit note is required');
      return;
    }
    setResolving(true);
    try {
      await api.resolve(detail.id, resolveTarget, resolutionNote.trim(), token);
      showToast(`Receipt ${detail.id.slice(0, 8)} resolved to ${resolveTarget}`);
      setResolveTarget(null);
      setResolutionNote('');
      await refresh();
      await inspect(detail);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  const stableKey = useRef(newKey());
  const sampleCurl = useMemo(() => `curl -X POST http://localhost:4000/p/charge \\
  -H "Idempotency-Key: ${stableKey.current}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 4200, "currency": "INR", "card_last4": "4242"}'`, []);

  const copyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Top Navbar */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="#" className="logo">
                <GateLogo />
                <span>OnceGate</span>
              </a>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#191A23', color: '#B9FF66', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                Proxy Control Plane
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: '0.8rem', color: '#666', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                Admin Secret:
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Admin Token"
                  style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #191A23', fontFamily: 'JetBrains Mono' }}
                />
              </label>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#B9FF66', boxShadow: '0 0 6px #B9FF66' }} title="Connected" />
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Banner & Integration Quick-Copy */}
        <section className="hero" style={{ padding: '40px 0 30px' }}>
          <div className="container">
            <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }}>
              Durable HTTP Idempotency Gateway
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#444', maxWidth: '720px', marginBottom: 24, lineHeight: 1.5 }}>
              Guarantees at-most-once execution for mutating HTTP APIs using PostgreSQL ACID claims, sha256 payload locking, and honest <code>UNKNOWN</code> outcome resolution.
            </p>

            <div style={{ backgroundColor: '#191A23', color: '#FFF', borderRadius: '12px', padding: '16px 20px', maxWidth: '740px', fontFamily: 'JetBrains Mono', fontSize: '0.82rem', border: '1px solid #191A23' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 8 }}>
                <span style={{ color: '#888', fontSize: '0.75rem' }}>Proxy Endpoint Example</span>
                <button
                  onClick={copyCurl}
                  style={{ background: 'transparent', border: '1px solid #444', color: '#B9FF66', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                >
                  {copied ? 'Copied ✓' : 'Copy cURL'}
                </button>
              </div>
              <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#E2E8F0', lineHeight: 1.45 }}>
                {sampleCurl}
              </pre>
            </div>
          </div>
        </section>

        {/* Live Metrics Grid */}
        <section className="stats-banner">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Requests</div>
                <div className="stat-value">{stats?.total ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Replayed Responses</div>
                <div className="stat-value">{stats?.replayed ?? '—'}</div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-label">Duplicates Prevented</div>
                <div className="stat-value">{stats?.duplicates_prevented ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open UNKNOWN Outcomes</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Control Toolbar & Action Trigger */}
        <section className="container">
          <div className="console-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gateway Operations & Traffic Simulator</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 2 }}>
                Dispatch mutating client requests to verify idempotency interception, retry handling, and fault behavior:
              </p>
            </div>

            <div className="controls-flex" style={{ gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => void send()} disabled={sending}>
                Execute Request
              </button>
              <button className="btn btn-lime" onClick={() => void send(undefined, true)} disabled={sending}>
                Fire Concurrent Storm (25x)
              </button>
              <button className="btn btn-secondary" onClick={() => void send('slow')} disabled={sending}>
                Simulate Upstream Timeout
              </button>
              <button className="btn btn-danger" onClick={() => void send('die')} disabled={sending}>
                Simulate Upstream Crash
              </button>
              <button className="btn btn-secondary" onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                Reset Storage State
              </button>
            </div>

            <div className="status-bar-box" style={{ marginTop: 20 }}>
              <span>
                Upstream DB Rows: <span className="count-green">{chargeCount ?? '—'}</span>
              </span>
              {stats && (
                <span>
                  Intercepted Duplicates: <span className="count-green">{stats.duplicates_prevented}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Live Receipt Audit Feed */}
        <section className="container" style={{ marginBottom: 60 }}>
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Durable Receipt Audit Feed</h3>
              <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'JetBrains Mono' }}>
                {receipts.length} stored receipts
              </span>
            </div>

            {loading && !receipts.length ? (
              <p style={{ padding: 20, color: '#666' }}>Loading receipts from database...</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: 20, color: '#666' }}>No stored receipts. Dispatch a request above to generate idempotency claims.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Idempotency Key</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Age</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} onClick={() => void inspect(r)}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 500 }}>{r.idempotency_key.slice(0, 28)}...</td>
                      <td>
                        <span className={statusClass(r.status)}>{r.status}</span>
                      </td>
                      <td>{r.attempt_count}</td>
                      <td>{timeAgo(r.created_at)}</td>
                      <td>
                        <span style={{ textDecoration: 'underline', fontWeight: 600, fontSize: '0.85rem' }}>Inspect Trail →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Drawer Overlay for Receipt Inspection */}
      {selected && (
        <div className="drawer-overlay" onClick={() => { setSelected(undefined); setDetail(undefined); setResolveTarget(null); }} />
      )}

      {selected && (
        <aside className="drawer-panel">
          <div className="drawer-header">
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', fontWeight: 600 }}>Receipt Details</div>
              <h2 style={{ marginTop: 6 }}>
                <span className={statusClass(selected.status)}>{selected.status}</span>
              </h2>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                ID: {selected.id}
              </p>
            </div>
            <button className="close-btn" onClick={() => { setSelected(undefined); setDetail(undefined); setResolveTarget(null); }}>
              ×
            </button>
          </div>

          {detail && (
            <>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.88rem', marginBottom: 24 }}>
                <dt style={{ color: '#666' }}>Idempotency Key</dt>
                <dd style={{ fontFamily: 'JetBrains Mono', wordBreak: 'break-all' }}>{detail.idempotency_key}</dd>
                {detail.method && <><dt style={{ color: '#666' }}>HTTP Method</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.method}</dd></>}
                {detail.path && <><dt style={{ color: '#666' }}>Target Path</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.path}</dd></>}
                <dt style={{ color: '#666' }}>Total Attempts</dt>
                <dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.attempt_count}</dd>
              </dl>

              {/* Event Timeline */}
              <div className="timeline">
                <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#666', marginBottom: 12, letterSpacing: '0.05em' }}>Event Audit Timeline</h4>
                {detail.events.map((ev) => (
                  <div key={ev.id} className="timeline-event">
                    <div className="timeline-dot" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.kind.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>{new Date(ev.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resolution for UNKNOWN State */}
              {selected.status === 'UNKNOWN' && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #DDD' }}>
                  <h4 style={{ color: '#191A23', fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Manual Resolution Required</h4>
                  <p style={{ fontSize: '0.82rem', color: '#555', marginBottom: 12 }}>
                    Verify upstream database status, then record audit resolution:
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-lime" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }} onClick={() => setResolveTarget('COMMITTED')}>
                      Mark COMMITTED
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }} onClick={() => setResolveTarget('FAILED')}>
                      Mark FAILED
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      )}

      {/* Custom In-App Modal for UNKNOWN Resolution */}
      {resolveTarget && (
        <div className="drawer-overlay" style={{ zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '90%', border: '2px solid #191A23', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: '#191A23' }}>
              Confirm Audit Resolution → <span style={{ color: resolveTarget === 'COMMITTED' ? '#2E7D32' : '#C62828' }}>{resolveTarget}</span>
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#555', marginBottom: 16 }}>
              Provide a mandatory audit note documenting why this receipt is being marked as {resolveTarget}:
            </p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Verified transaction #8821 in upstream PostgreSQL database logs."
              rows={3}
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #191A23', fontFamily: 'sans-serif', marginBottom: 18 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setResolveTarget(null); setResolutionNote(''); }}
                disabled={resolving}
              >
                Cancel
              </button>
              <button
                className={`btn ${resolveTarget === 'COMMITTED' ? 'btn-lime' : 'btn-danger'}`}
                onClick={() => void confirmResolve()}
                disabled={resolving}
              >
                {resolving ? 'Recording...' : 'Submit Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-card" style={{ padding: '24px 32px' }}>
            <div className="footer-bottom" style={{ paddingTop: 0, borderTop: 'none' }}>
              <div>© 2026 OnceGate · Durable HTTP Idempotency Gateway</div>
              <div><a href="https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07" target="_blank" rel="noreferrer">IETF Draft Specification ↗</a></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}
