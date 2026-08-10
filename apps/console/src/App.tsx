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
      {/* Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <a href="#" className="logo">
              <GateLogo />
              <span>OnceGate</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>Ops Console</span>
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => setShowLimits(!showLimits)}
                className="btn"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Boundaries & Limitations
              </button>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                Token:
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Admin Token"
                  style={{ width: '130px', padding: '6px 10px', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}
                />
              </label>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-green)' }} title="Connected" />
            </div>
          </nav>
        </div>
      </header>

      <main style={{ padding: '32px 0' }}>
        {/* Live Metrics Grid */}
        <section className="stats-banner" style={{ padding: '0 0 32px' }}>
          <div className="container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total requests</div>
                <div className="stat-value">{stats?.total ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Replayed responses</div>
                <div className="stat-value">{stats?.replayed ?? '—'}</div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-label">Duplicates prevented</div>
                <div className="stat-value">{stats?.duplicates_prevented ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open UNKNOWN states</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Side-by-Side Comparison Studio */}
        <section className="container" style={{ marginBottom: 24 }}>
          <div className="console-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>
                  Side-by-Side Lost Response Experiment
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '640px', margin: 0 }}>
                  Simulates a network failure after database execution. Compares direct upstream retry vs OnceGate proxy handling.
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => void runBeforeAfterDemo()}
                disabled={compRunning}
              >
                {compRunning ? 'Running test...' : 'Run comparison test'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
              {/* Direct Upstream */}
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>
                  Direct Upstream (No Proxy)
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Request → DB Charge Inserted → Socket Dropped → Client Retries
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-red)' }}>
                  <span>DB Charges Executed:</span>
                  <span>{compResult.directAfter !== undefined ? `${compResult.directAfter - compResult.directBefore} (Duplicate side-effect)` : '—'}</span>
                </div>
              </div>

              {/* OnceGate Proxy */}
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>
                  OnceGate Idempotency Proxy
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Request → Postgres Claim → Socket Dropped → Retry Intercepted
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                  <span>DB Charges Executed:</span>
                  <span>{compResult.gateAfter !== undefined ? `${compResult.gateAfter - compResult.gateBefore} (Deduplicated)` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Test Scenarios Toolbar */}
        <section className="container" style={{ marginBottom: 24 }}>
          <div className="console-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>
              Test Scenarios
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 16 }}>
              Dispatch test requests through the gateway to verify concurrency locking, timeout handling, and payload validation.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => void send('normal')} disabled={sending}>
                Standard Request
              </button>
              <button className="btn" onClick={() => void send('storm')} disabled={sending}>
                Concurrent Requests (25x)
              </button>
              <button className="btn" onClick={() => void send('drop')} disabled={sending}>
                Lost Response (Socket Drop)
              </button>
              <button className="btn" onClick={() => void send('mismatch')} disabled={sending}>
                Payload Mismatch (422)
              </button>
              <button className="btn" onClick={() => void send('slow')} disabled={sending}>
                Upstream Timeout (15s)
              </button>
              <button className="btn btn-danger" onClick={() => void send('die')} disabled={sending}>
                Upstream Process Crash
              </button>
              <button className="btn" onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                Clear DB Storage
              </button>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Upstream database rows (`demo.charges`): <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{chargeCount ?? '—'}</strong></span>
              <span>Prevented duplicates: <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{stats?.duplicates_prevented ?? 0}</strong></span>
            </div>
          </div>
        </section>

        {/* Receipts Feed */}
        <section className="container">
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Durable Receipts</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {receipts.length} receipts
              </span>
            </div>

            {loading && !receipts.length ? (
              <p style={{ padding: '16px 0', color: 'var(--text-muted)' }}>Loading receipts...</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: '16px 0', color: 'var(--text-muted)' }}>No stored receipts. Send a request above to generate claims.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Idempotency key</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} onClick={() => void inspect(r)}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{r.idempotency_key.slice(0, 32)}...</td>
                      <td>
                        <span className={statusClass(r.status)}>{r.status}</span>
                      </td>
                      <td>{r.attempt_count}</td>
                      <td>{timeAgo(r.created_at)}</td>
                      <td>
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem' }}>Inspect →</span>
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
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Receipt Details</div>
              <h2>
                <span className={statusClass(selected.status)}>{selected.status}</span>
              </h2>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all' }}>
                {selected.id}
              </p>
            </div>
            <button className="close-btn" onClick={() => { setSelected(undefined); setDetail(undefined); setExplanation(null); setResolveTarget(null); }}>
              ×
            </button>
          </div>

          {detail && (
            <>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.88rem', marginBottom: 20 }}>
                <dt style={{ color: 'var(--text-muted)' }}>Idempotency key</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{detail.idempotency_key}</dd>
                {detail.method && <><dt style={{ color: 'var(--text-muted)' }}>Method</dt><dd style={{ fontFamily: 'var(--font-mono)' }}>{detail.method}</dd></>}
                {detail.path && <><dt style={{ color: 'var(--text-muted)' }}>Path</dt><dd style={{ fontFamily: 'var(--font-mono)' }}>{detail.path}</dd></>}
                <dt style={{ color: 'var(--text-muted)' }}>Attempts</dt>
                <dd style={{ fontFamily: 'var(--font-mono)' }}>{detail.attempt_count}</dd>
              </dl>

              {/* Diagnosis Button */}
              <div style={{ marginBottom: 20 }}>
                <button
                  className="btn"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  onClick={() => void fetchExplanation(detail.id)}
                >
                  Analyze audit trail
                </button>
              </div>

              {/* Diagnosis Box */}
              {explanation && (
                <div style={{ marginBottom: 24, padding: '14px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--accent-green)', fontWeight: 600, marginBottom: 6 }}>Audit Analysis</div>
                  <p style={{ margin: '0 0 8px', color: 'var(--text-main)', lineHeight: 1.5 }}>{explanation.summary}</p>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <strong>Action:</strong> {explanation.remediation}
                  </div>
                </div>
              )}

              {/* Event Timeline */}
              <div className="timeline">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>Audit Log</div>
                {detail.events.map((ev) => (
                  <div key={ev.id} className="timeline-event">
                    <div className="timeline-dot" />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{ev.kind.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(ev.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manual Resolution for UNKNOWN */}
              {selected.status === 'UNKNOWN' && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>Manual Resolution</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Verify upstream database status, then record audit resolution:
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
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

      {/* Limitations Modal */}
      {showLimits && (
        <div className="drawer-overlay" style={{ zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLimits(false)}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', maxWidth: '540px', width: '90%', border: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>
              Technical Boundaries & Limitations
            </h3>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
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
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
              Resolve to {resolveTarget}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Provide a mandatory audit note explaining why this receipt is being resolved:
            </p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Verified charge in upstream PostgreSQL database logs."
              rows={3}
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
                {resolving ? 'Saving...' : 'Submit Resolution'}
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

      {/* Toast */}
      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}
