import { useCallback, useEffect, useRef, useState } from 'react';
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
      showToast(err instanceof Error ? err.message : 'Could not load receipt');
    }
  };

  const send = async (chaos?: string, storm = false) => {
    const key = newKey();
    setSending(true);
    showToast(storm ? 'Firing 25 concurrent requests…' : chaos === 'slow' ? 'Sending timeout chaos request…' : chaos === 'die' ? 'Sending crash-after-charge request…' : 'Sending test charge request…');
    try {
      const replies = await Promise.all(
        Array.from({ length: storm ? 25 : 1 }, () => api.charge(key, chaos))
      );
      showToast(storm ? `${replies.length} requests processed — duplicates prevented` : 'Request completed successfully ✓');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed');
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const resolve = async (status: 'COMMITTED' | 'FAILED') => {
    if (!detail) return;
    const note = window.prompt('Audit resolution note:');
    if (!note) return;
    try {
      await api.resolve(detail.id, status, note, token);
      showToast(`Receipt ${detail.id.slice(0, 8)} resolved → ${status}`);
      await refresh();
      await inspect(detail);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resolution failed');
    }
  };

  return (
    <>
      {/* Navigation Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <a href="#" className="logo">
              <GateLogo />
              <span>OnceGate</span>
            </a>
            <ul className="nav-links">
              <li><a href="#stats">Metrics</a></li>
              <li><a href="#demo">Live Demo</a></li>
              <li><a href="#receipts">Receipt Feed</a></li>
              <li><a href="#spec">IETF Spec</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Header */}
        <section className="hero" id="about">
          <div className="container">
            <div className="eyebrow-badge">
              <span className="status-dot-live" />
              <span>Enterprise Gateway · Durable Idempotency Engine</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)', fontWeight: 600, lineHeight: 1.15, marginBottom: 16 }}>
              Durable HTTP Idempotency Gateway
            </h1>
            <p style={{ fontSize: '1.2rem', color: '#444', maxWidth: '680px', marginBottom: 30 }}>
              Makes any HTTP API safe to retry. PostgreSQL-backed implementation of the IETF <code>Idempotency-Key</code> draft with atomic claims, sha256 payload locking, and honest <code>UNKNOWN</code> outcome tracking.
            </p>
          </div>
        </section>

        {/* Live Metrics Bar Cards */}
        <section className="stats-banner" id="stats">
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
                <div className="stat-label">Open UNKNOWNs</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Admin Token Control Bar */}
        <section className="container">
          <div className="token-section">
            <label>
              Admin Bearer Token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer token (default: admin-secret)"
              />
            </label>
            <button className="btn btn-primary" onClick={() => void refresh()}>
              Connect Gate
            </button>
          </div>
        </section>

        {/* Live Demo Trigger Controls */}
        <section className="container" id="demo">
          <div className="console-panel">
            <h3>⚡ Interactive Gateway Demo Controls</h3>
            <p style={{ color: '#555', marginBottom: 24 }}>
              Dispatch mutating payment requests through OnceGate to the upstream demo checkout service:
            </p>
            <div className="controls-flex">
              <button className="btn btn-secondary" onClick={() => void send()} disabled={sending}>
                Send 1 charge
              </button>
              <button className="btn btn-lime" onClick={() => void send(undefined, true)} disabled={sending}>
                🔥 Retry storm (25)
              </button>
              <button className="btn btn-secondary" onClick={() => void send('slow')} disabled={sending}>
                ⏱ Timeout chaos
              </button>
              <button className="btn btn-danger" onClick={() => void send('die')} disabled={sending}>
                💥 Crash-after-charge
              </button>
              <button className="btn btn-secondary" onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                ↺ Reset demo
              </button>
            </div>

            <div className="status-bar-box">
              <span>
                Actual Charges in Upstream DB: <span className="count-green">{chargeCount ?? '—'}</span>
              </span>
              {stats && (
                <span>
                  Duplicates Prevented by Gate: <span className="count-green">{stats.duplicates_prevented}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Live Receipt Audit Table */}
        <section className="container" id="receipts">
          <div className="table-card">
            <h3>📋 Receipt Audit Log</h3>
            {loading && !receipts.length ? (
              <p style={{ padding: 20, color: '#666' }}>Loading receipts from PostgreSQL database…</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: 20, color: '#666' }}>No receipts stored yet. Trigger an action above to generate idempotency claims.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Age</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} onClick={() => void inspect(r)}>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>{r.idempotency_key.slice(0, 24)}…</td>
                      <td>
                        <span className={statusClass(r.status)}>{r.status}</span>
                      </td>
                      <td>{r.attempt_count}</td>
                      <td>{timeAgo(r.created_at)}</td>
                      <td>
                        <span style={{ textDecoration: 'underline', fontWeight: 600, fontSize: '0.85rem' }}>View Trail →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* IETF Spec Reference Section */}
        <section className="container" id="spec" style={{ marginBottom: 80 }}>
          <div className="section-header">
            <span className="section-title">IETF Conformance</span>
            <p className="section-desc">
              OnceGate enforces the IETF <code>Idempotency-Key</code> specification at the database layer.
            </p>
          </div>

          <div className="matrix-grid">
            <div className="matrix-card card-light">
              <h4>01. Atomic Claims</h4>
              <p>PostgreSQL <code>INSERT ... ON CONFLICT DO NOTHING</code> prevents concurrent double-execution under high concurrency.</p>
            </div>

            <div className="matrix-card card-lime">
              <h4>02. Payload Fingerprinting</h4>
              <p>Reusing an <code>Idempotency-Key</code> with a modified payload returns <code>422 Unprocessable Entity</code>.</p>
            </div>

            <div className="matrix-card card-dark">
              <h4>03. In-Flight Conflicts</h4>
              <p>Simultaneous duplicate requests while a receipt is PENDING receive <code>409 Conflict</code> immediately.</p>
            </div>

            <div className="matrix-card card-light">
              <h4>04. Honest UNKNOWN State</h4>
              <p>Upstream timeouts transition to <code>UNKNOWN</code> — blocking retries until an operator resolves the outcome.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Drawer Overlay for Receipt Inspection */}
      {selected && (
        <div className="drawer-overlay" onClick={() => { setSelected(undefined); setDetail(undefined); }} />
      )}

      {selected && (
        <aside className="drawer-panel">
          <div className="drawer-header">
            <div>
              <div className="eyebrow-badge">Receipt Audit</div>
              <h2 style={{ marginTop: 8 }}>
                <span className={statusClass(selected.status)}>{selected.status}</span>
              </h2>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                {selected.id}
              </p>
            </div>
            <button className="close-btn" onClick={() => { setSelected(undefined); setDetail(undefined); }}>
              ×
            </button>
          </div>

          {detail && (
            <>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.9rem', marginBottom: 24 }}>
                <dt style={{ color: '#666' }}>Idempotency Key</dt>
                <dd style={{ fontFamily: 'JetBrains Mono', wordBreak: 'break-all' }}>{detail.idempotency_key}</dd>
                {detail.method && <><dt style={{ color: '#666' }}>Method</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.method}</dd></>}
                {detail.path && <><dt style={{ color: '#666' }}>Path</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.path}</dd></>}
                <dt style={{ color: '#666' }}>Attempts</dt>
                <dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.attempt_count}</dd>
              </dl>

              {/* Event Timeline */}
              <div className="timeline">
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>Event Timeline</h4>
                {detail.events.map((ev) => (
                  <div key={ev.id} className="timeline-event">
                    <div className="timeline-dot" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ev.kind.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>{new Date(ev.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Human Resolution for UNKNOWN */}
              {selected.status === 'UNKNOWN' && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px solid var(--clr-dark)' }}>
                  <h4 style={{ color: '#b88cff', fontSize: '1rem', marginBottom: 8 }}>Resolve Ambiguous Outcome</h4>
                  <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: 12 }}>
                    Audit upstream logs, then record resolution status:
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-lime" style={{ flex: 1, padding: '10px' }} onClick={() => void resolve('COMMITTED')}>
                      ✓ Committed
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1, padding: '10px' }} onClick={() => void resolve('FAILED')}>
                      ✗ Failed
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-card">
            <div className="footer-top">
              <a href="#" className="logo footer-logo">
                <GateLogo />
                <span>OnceGate</span>
              </a>
              <ul className="footer-nav">
                <li><a href="#stats">Metrics</a></li>
                <li><a href="#demo">Live Demo</a></li>
                <li><a href="#receipts">Receipt Log</a></li>
                <li><a href="#spec">IETF Spec</a></li>
              </ul>
            </div>

            <div className="footer-bottom">
              <div>© 2026 OnceGate · Durable Idempotency Platform</div>
              <div><a href="https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07" target="_blank" rel="noreferrer">IETF Draft Spec ↗</a></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}
