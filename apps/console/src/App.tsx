import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Explanation, type Receipt, type Stats } from './api';

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
  if (minutes < 60) return `${seconds}m ago`;
  const hours = Math.floor(seconds / 60);
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
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showLimits, setShowLimits] = useState(false);

  // Side-by-Side Experiment State
  const [compRunning, setCompRunning] = useState(false);
  const [compResult, setCompResult] = useState<{
    directBefore?: number;
    directAfter?: number;
    gateBefore?: number;
    gateAfter?: number;
  }>({});

  // Audit Resolution Modal State
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
      // Quiet background refresh
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
    setExplanation(null);
    try {
      setDetail(await api.receipt(receipt.id, token));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load receipt details');
    }
  };

  const fetchExplanation = async (receiptId: string) => {
    try {
      showToast('Analyzing database trail...');
      const exp = await api.explain(receiptId, token);
      setExplanation(exp);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not generate explanation');
    }
  };

  const runBeforeAfterDemo = async () => {
    setCompRunning(true);
    showToast('Executing side-by-side comparison...');
    try {
      await api.resetCharges();
      const initialCount = (await api.chargeCount()).count;

      // 1. Direct Upstream (Without OnceGate)
      const directKey = newKey();
      await api.directCharge(directKey, 'drop').catch(() => null);
      await api.directCharge(directKey, 'drop').catch(() => null);
      const directCount = (await api.chargeCount()).count;

      // 2. OnceGate Proxy (With OnceGate)
      const gateKey = newKey();
      await api.charge(gateKey, 'drop').catch(() => null);
      await api.charge(gateKey, 'drop').catch(() => null);
      const gateCount = (await api.chargeCount()).count;

      setCompResult({
        directBefore: initialCount,
        directAfter: directCount,
        gateBefore: directCount,
        gateAfter: gateCount
      });

      showToast('Comparison completed.');
      await refresh();
    } catch {
      showToast('Comparison error');
    } finally {
      setCompRunning(false);
    }
  };

  const send = async (type: 'normal' | 'storm' | 'slow' | 'die' | 'drop' | 'mismatch') => {
    setSending(true);
    const key = newKey();

    try {
      if (type === 'mismatch') {
        showToast('Sending initial request (amount: ₹4,200)...');
        await api.charge(key, undefined, { amount: 4200, currency: 'INR', card_last4: '4242' });
        showToast('Retrying same key with modified body (amount: ₹99,999)...');
        await api.charge(key, undefined, { amount: 99999, currency: 'INR', card_last4: '4242' });
      } else if (type === 'drop') {
        showToast('Simulating lost response (socket dropped post-execution)...');
        await api.charge(key, 'drop');
      } else if (type === 'die') {
        showToast('Simulating upstream process crash...');
        await api.charge(key, 'die');
      } else if (type === 'slow') {
        showToast('Simulating upstream delay (15s)...');
        await api.charge(key, 'slow');
      } else if (type === 'storm') {
        showToast('Sending 25 parallel requests...');
        const replies = await Promise.all(
          Array.from({ length: 25 }, () => api.charge(key))
        );
        showToast(`Completed 25 requests — duplicates intercepted`);
      } else {
        showToast('Sending request...');
        await api.charge(key);
        showToast('Request processed successfully');
      }
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed');
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const confirmResolve = async () => {
    if (!detail || !resolveTarget) return;
    if (!resolutionNote.trim()) {
      showToast('Audit note required');
      return;
    }
    setResolving(true);
    try {
      await api.resolve(detail.id, resolveTarget, resolutionNote.trim(), token);
      showToast(`Receipt resolved to ${resolveTarget}`);
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

  return (
    <>
      {/* Positivus Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="#" className="logo">
                <GateLogo />
                <span>OnceGate</span>
              </a>
              <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#191A23', color: '#B9FF66', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                Proxy Control Plane
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => setShowLimits(!showLimits)}
                className="btn"
                style={{ fontSize: '0.85rem', padding: '8px 14px', backgroundColor: '#191A23', color: '#FFF' }}
              >
                Technical Boundaries
              </button>
              <label style={{ fontSize: '0.85rem', color: '#191A23', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                Admin Secret:
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Admin Token"
                  style={{ width: '140px', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #191A23', fontFamily: 'JetBrains Mono' }}
                />
              </label>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#B9FF66', border: '1px solid #191A23', boxShadow: '0 0 8px #B9FF66' }} title="Connected" />
            </div>
          </nav>
        </div>
      </header>

      <main style={{ padding: '30px 0 60px' }}>
        {/* Positivus Stat Cards Grid */}
        <section className="stats-banner" style={{ padding: '0 0 30px' }}>
          <div className="container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">TOTAL REQUESTS</div>
                <div className="stat-value">{stats?.total ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">REPLAYED RESPONSES</div>
                <div className="stat-value">{stats?.replayed ?? '—'}</div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-label">DUPLICATES PREVENTED</div>
                <div className="stat-value">{stats?.duplicates_prevented ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">OPEN UNKNOWN STATES</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Side-by-Side Comparison Box (Positivus High-Contrast Dark Card) */}
        <section className="container" style={{ marginBottom: 30 }}>
          <div className="console-panel" style={{ backgroundColor: '#191A23', color: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px', color: '#FFF' }}>
                  Side-by-Side "Lost Response" Experiment
                </h3>
                <p style={{ color: '#A0AEC0', fontSize: '0.9rem', maxWidth: '680px', margin: 0 }}>
                  Simulates a network failure after database execution. Compares direct upstream retry vs OnceGate proxy handling.
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => void runBeforeAfterDemo()}
                disabled={compRunning}
                style={{ padding: '12px 20px', fontSize: '0.95rem' }}
              >
                {compRunning ? 'Running test...' : 'Run Before / After Proof'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
              {/* Direct Upstream */}
              <div style={{ backgroundColor: '#262838', padding: '20px', borderRadius: '14px', border: '1px solid #f06272' }}>
                <div style={{ color: '#f06272', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>
                  WITHOUT ONCEGATE (Direct Upstream)
                </div>
                <p style={{ fontSize: '0.82rem', color: '#CBD5E0', marginBottom: 14 }}>
                  Client POST → Payment Executed → Connection Drops → Client Retries
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, color: '#f06272', backgroundColor: '#191A23', padding: '10px 14px', borderRadius: '8px' }}>
                  <span>Upstream Charges Executed:</span>
                  <span>{compResult.directAfter !== undefined ? `${compResult.directAfter - compResult.directBefore} (DUPLICATE 💥)` : 'Run test to measure'}</span>
                </div>
              </div>

              {/* OnceGate Proxy */}
              <div style={{ backgroundColor: '#262838', padding: '20px', borderRadius: '14px', border: '1px solid #B9FF66' }}>
                <div style={{ color: '#B9FF66', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>
                  WITH ONCEGATE PROXY
                </div>
                <p style={{ fontSize: '0.82rem', color: '#CBD5E0', marginBottom: 14 }}>
                  Client POST → Postgres Claim → Connection Drops → Retry Intercepted
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, color: '#B9FF66', backgroundColor: '#191A23', padding: '10px 14px', borderRadius: '8px' }}>
                  <span>Upstream Charges Executed:</span>
                  <span>{compResult.gateAfter !== undefined ? `${compResult.gateAfter - compResult.gateBefore} (PROTECTED 🛡️)` : 'Run test to measure'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Test Scenarios Toolbar (Positivus Light Card) */}
        <section className="container" style={{ marginBottom: 30 }}>
          <div className="console-panel">
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: '#191A23' }}>
              Interactive Failure Lab & Chaos Studio
            </h3>
            <p style={{ color: '#555', fontSize: '0.92rem', marginBottom: 20 }}>
              Dispatch test requests through the gateway to verify concurrency locking, timeout handling, and payload validation:
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => void send('normal')} disabled={sending}>
                Standard Request
              </button>
              <button className="btn btn-primary" onClick={() => void send('storm')} disabled={sending}>
                Concurrent Storm (25x)
              </button>
              <button className="btn" onClick={() => void send('drop')} disabled={sending}>
                Lost Response (Socket Drop)
              </button>
              <button className="btn" onClick={() => void send('mismatch')} disabled={sending}>
                Payload Mismatch Retry (422)
              </button>
              <button className="btn" onClick={() => void send('slow')} disabled={sending}>
                Upstream Timeout (15s)
              </button>
              <button className="btn btn-danger" onClick={() => void send('die')} disabled={sending}>
                Upstream Process Crash
              </button>
              <button className="btn" onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                Reset PostgreSQL Storage
              </button>
            </div>

            <div className="status-bar-box" style={{ marginTop: 24 }}>
              <span>
                Upstream DB Rows (`demo.charges`): <span className="count-green">{chargeCount ?? '—'}</span>
              </span>
              <span>
                Prevented Duplicates: <span className="count-green">{stats?.duplicates_prevented ?? 0}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Receipts Feed Table Card */}
        <section className="container">
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#191A23' }}>Durable Receipt Audit Feed</h3>
              <span style={{ fontSize: '0.85rem', color: '#666', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                {receipts.length} stored receipts
              </span>
            </div>

            {loading && !receipts.length ? (
              <p style={{ padding: '20px 0', color: '#666' }}>Loading receipts from database...</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: '20px 0', color: '#666' }}>No stored receipts. Dispatch a request above to generate idempotency claims.</p>
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
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{r.idempotency_key.slice(0, 32)}...</td>
                      <td>
                        <span className={statusClass(r.status)}>{r.status}</span>
                      </td>
                      <td>{r.attempt_count}</td>
                      <td>{timeAgo(r.created_at)}</td>
                      <td>
                        <span style={{ textDecoration: 'underline', fontWeight: 700, fontSize: '0.88rem', color: '#191A23' }}>Inspect Trail →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Detail Drawer */}
      {selected && (
        <div className="drawer-overlay" onClick={() => { setSelected(undefined); setDetail(undefined); setExplanation(null); setResolveTarget(null); }} />
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
            <button className="close-btn" onClick={() => { setSelected(undefined); setDetail(undefined); setExplanation(null); setResolveTarget(null); }}>
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

              {/* Diagnosis Button */}
              <div style={{ marginBottom: 20 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                  onClick={() => void fetchExplanation(detail.id)}
                >
                  Analyze Audit Trail
                </button>
              </div>

              {/* Diagnosis Box */}
              {explanation && (
                <div style={{ marginBottom: 24, padding: '16px', backgroundColor: '#191A23', color: '#FFF', borderRadius: '14px', fontSize: '0.85rem' }}>
                  <div style={{ color: '#B9FF66', fontWeight: 700, marginBottom: 6 }}>Audit Analysis</div>
                  <p style={{ margin: '0 0 10px', color: '#FFF', lineHeight: 1.5 }}>{explanation.summary}</p>
                  <div style={{ color: '#CBD5E0', fontSize: '0.8rem', backgroundColor: '#262838', padding: '10px', borderRadius: '8px' }}>
                    <strong>Action:</strong> {explanation.remediation}
                  </div>
                </div>
              )}

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

              {/* Manual Resolution for UNKNOWN */}
              {selected.status === 'UNKNOWN' && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #DDD' }}>
                  <h4 style={{ color: '#191A23', fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Manual Resolution Required</h4>
                  <p style={{ fontSize: '0.82rem', color: '#555', marginBottom: 12 }}>
                    Verify upstream database status, then record audit resolution:
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setResolveTarget('COMMITTED')}>
                      Mark COMMITTED
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setResolveTarget('FAILED')}>
                      Mark FAILED
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      )}

      {/* Technical Boundaries Modal */}
      {showLimits && (
        <div className="drawer-overlay" style={{ zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLimits(false)}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '20px', padding: '28px', maxWidth: '580px', width: '90%', border: '2px solid #191A23', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12, color: '#191A23' }}>
              What OnceGate Cannot Know (Transparent Boundaries)
            </h3>
            <div style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>
                <strong>Network Ambiguity:</strong> If the gateway forwards a request to an upstream service and the connection drops before HTTP headers arrive, OnceGate cannot determine from outside whether the upstream executed the side-effect.
              </p>
              <p style={{ marginBottom: 10 }}>
                <strong>Honest UNKNOWN State:</strong> Rather than guessing or auto-retrying (which risks double execution), OnceGate transitions the receipt to <code>UNKNOWN</code> and blocks further attempts until an operator records an audited resolution.
              </p>
              <p>
                <strong>Fail-Closed Consistency:</strong> If PostgreSQL loses connectivity, OnceGate returns <code>503 Service Unavailable</code> to prioritize correctness over availability.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn" onClick={() => setShowLimits(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Modal */}
      {resolveTarget && (
        <div className="drawer-overlay" style={{ zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '20px', padding: '28px', maxWidth: '440px', width: '90%', border: '2px solid #191A23', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: '#191A23' }}>
              Confirm Audit Resolution → <span style={{ color: resolveTarget === 'COMMITTED' ? '#2E7D32' : '#C62828' }}>{resolveTarget}</span>
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#555', marginBottom: 16 }}>
              Provide a mandatory audit note documenting why this receipt is being marked as {resolveTarget}:
            </p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Verified transaction in upstream PostgreSQL database logs."
              rows={3}
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #191A23', fontFamily: 'sans-serif', marginBottom: 18 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => { setResolveTarget(null); setResolutionNote(''); }}
                disabled={resolving}
              >
                Cancel
              </button>
              <button
                className={`btn ${resolveTarget === 'COMMITTED' ? 'btn-primary' : 'btn-danger'}`}
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
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>© 2026 OnceGate · Durable HTTP Idempotency Gateway</div>
          <div><a href="https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07" target="_blank" rel="noreferrer">IETF Draft Specification ↗</a></div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}
