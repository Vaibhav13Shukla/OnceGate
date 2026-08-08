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
  const [copied, setCopied] = useState(false);

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
    showToast(storm ? 'Dispatching 25 concurrent requests...' : chaos === 'slow' ? 'Simulating upstream timeout...' : chaos === 'die' ? 'Simulating upstream process failure...' : 'Dispatching test request...');
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

  const resolve = async (status: 'COMMITTED' | 'FAILED') => {
    if (!detail) return;
    const note = window.prompt('Enter mandatory audit resolution note:');
    if (!note) return;
    try {
      await api.resolve(detail.id, status, note, token);
      showToast(`Receipt ${detail.id.slice(0, 8)} resolved to ${status}`);
      await refresh();
      await inspect(detail);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resolution failed');
    }
  };

  const sampleCurl = `curl -X POST http://localhost:4000/p/charge \\
  -H "Idempotency-Key: ${newKey()}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 4200, "currency": "USD"}'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="#" className="logo">
                <GateLogo />
                <span>OnceGate</span>
              </a>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#191A23', color: '#B9FF66', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                v1.0.0
              </span>
            </div>

            <ul className="nav-links">
              <li><a href="#overview">Overview</a></li>
              <li><a href="#operations">Operations</a></li>
              <li><a href="#receipts">Audit Log</a></li>
              <li><a href="#specification">Specification</a></li>
            </ul>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Admin Token"
                style={{ width: '130px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #191A23', fontFamily: 'JetBrains Mono' }}
              />
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#B9FF66', boxShadow: '0 0 6px #B9FF66' }} title="Gate Connected" />
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* Product Hero */}
        <section className="hero" id="overview">
          <div className="container">
            <h1 style={{ fontSize: 'clamp(2.4rem, 4vw, 3.6rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 16 }}>
              Durable HTTP Idempotency Gateway
            </h1>
            <p style={{ fontSize: '1.15rem', color: '#444', maxWidth: '720px', marginBottom: 28, lineHeight: 1.6 }}>
              Reverse proxy engine that guarantees at-most-once execution for mutating HTTP APIs. Powered by PostgreSQL ACID transactions, sha256 payload locking, and explicit <code>UNKNOWN</code> outcome resolution.
            </p>

            {/* Terminal Integration Box */}
            <div style={{ backgroundColor: '#191A23', color: '#FFF', borderRadius: '16px', padding: '20px', maxWidth: '760px', fontFamily: 'JetBrains Mono', fontSize: '0.85rem', position: 'relative', border: '1px solid #191A23' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 10 }}>
                <span style={{ color: '#888', fontSize: '0.75rem' }}>HTTP Proxy Request Example</span>
                <button
                  onClick={copyCurl}
                  style={{ background: 'transparent', border: '1px solid #444', color: '#B9FF66', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  {copied ? 'Copied ✓' : 'Copy cURL'}
                </button>
              </div>
              <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#E2E8F0', lineHeight: 1.5 }}>
                {sampleCurl}
              </pre>
            </div>
          </div>
        </section>

        {/* Live System Metrics */}
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
                <div className="stat-label">Open UNKNOWN Outcomes</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Operations & Testing Panel */}
        <section className="container" id="operations">
          <div className="console-panel">
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Gateway Operations & Resilience Testing</h3>
              <p style={{ color: '#666', fontSize: '0.95rem', marginTop: 4 }}>
                Simulate client traffic and network failure scenarios through the OnceGate proxy:
              </p>
            </div>

            <div className="controls-flex">
              <button className="btn btn-secondary" onClick={() => void send()} disabled={sending}>
                Execute Request
              </button>
              <button className="btn btn-lime" onClick={() => void send(undefined, true)} disabled={sending}>
                Simulate Concurrent Storm (25x)
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

            <div className="status-bar-box">
              <span>
                Upstream DB Record Count: <span className="count-green">{chargeCount ?? '—'}</span>
              </span>
              {stats && (
                <span>
                  Gateway Intercepted Duplicates: <span className="count-green">{stats.duplicates_prevented}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Receipt Audit Table */}
        <section className="container" id="receipts">
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Durable Receipt Audit Feed</h3>
              <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'JetBrains Mono' }}>
                {receipts.length} total stored receipts
              </span>
            </div>

            {loading && !receipts.length ? (
              <p style={{ padding: 24, color: '#666' }}>Fetching database receipts...</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: 24, color: '#666' }}>No active receipts. Execute an operation above to generate transactions.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Idempotency Key</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Recorded</th>
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

        {/* Technical Architecture Specification */}
        <section className="container" id="specification" style={{ marginBottom: 80 }}>
          <div className="section-header">
            <span className="section-title">Protocol Specification</span>
            <p className="section-desc">
              Implementation principles of the IETF <code>Idempotency-Key</code> specification enforced at the PostgreSQL layer.
            </p>
          </div>

          <div className="matrix-grid">
            <div className="matrix-card card-light">
              <h4>ACID Claim Enforcement</h4>
              <p>PostgreSQL <code>INSERT ... ON CONFLICT DO NOTHING</code> guarantees atomic claims across horizontal proxy replicas.</p>
            </div>

            <div className="matrix-card card-lime">
              <h4>sha256 Payload Locking</h4>
              <p>Reusing a key with altered HTTP method, path, or body parameters triggers a <code>422 Unprocessable Entity</code> response.</p>
            </div>

            <div className="matrix-card card-dark">
              <h4>In-Flight Conflict Protection</h4>
              <p>Simultaneous duplicate requests while a receipt is <code>PENDING</code> receive immediate <code>409 Conflict</code> with <code>Retry-After</code> headers.</p>
            </div>

            <div className="matrix-card card-light">
              <h4>Deterministic UNKNOWN State</h4>
              <p>Ambiguous upstream timeouts transition to <code>UNKNOWN</code>, blocking retries until explicitly audited and resolved.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Drawer Overlay for Receipt Details */}
      {selected && (
        <div className="drawer-overlay" onClick={() => { setSelected(undefined); setDetail(undefined); }} />
      )}

      {selected && (
        <aside className="drawer-panel">
          <div className="drawer-header">
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', fontWeight: 600 }}>Receipt Inspection</div>
              <h2 style={{ marginTop: 6 }}>
                <span className={statusClass(selected.status)}>{selected.status}</span>
              </h2>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                ID: {selected.id}
              </p>
            </div>
            <button className="close-btn" onClick={() => { setSelected(undefined); setDetail(undefined); }}>
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
                    <button className="btn btn-lime" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }} onClick={() => void resolve('COMMITTED')}>
                      Mark COMMITTED
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }} onClick={() => void resolve('FAILED')}>
                      Mark FAILED
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
                <li><a href="#overview">Overview</a></li>
                <li><a href="#operations">Operations</a></li>
                <li><a href="#receipts">Audit Feed</a></li>
                <li><a href="#specification">Specification</a></li>
              </ul>
            </div>

            <div className="footer-bottom">
              <div>© 2026 OnceGate · Durable Idempotency Platform</div>
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
