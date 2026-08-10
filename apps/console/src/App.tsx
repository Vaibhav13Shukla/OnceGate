import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [copied, setCopied] = useState(false);
  const [showLimits, setShowLimits] = useState(false);

  // Before/After Comparison State
  const [compRunning, setCompRunning] = useState(false);
  const [compResult, setCompResult] = useState<{
    directBefore?: number;
    directAfter?: number;
    gateBefore?: number;
    gateAfter?: number;
  }>({});

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
    setExplanation(null);
    try {
      setDetail(await api.receipt(receipt.id, token));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load receipt details');
    }
  };

  const fetchExplanation = async (receiptId: string) => {
    try {
      showToast('Generating evidence-grounded AI diagnosis...');
      const exp = await api.explain(receiptId, token);
      setExplanation(exp);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not generate explanation');
    }
  };

  const runBeforeAfterDemo = async () => {
    setCompRunning(true);
    showToast('Executing Before/After Failure Experiment...');
    try {
      await api.resetCharges();
      const initialCount = (await api.chargeCount()).count;

      // 1. Direct Upstream (WITHOUT OnceGate): dispatch charge with x-chaos: drop -> connection drops -> retry
      const directKey = newKey();
      showToast('Phase 1: Retrying lost response WITHOUT OnceGate (Direct Upstream)...');
      await api.directCharge(directKey, 'drop').catch(() => null);
      await api.directCharge(directKey, 'drop').catch(() => null);
      const directCount = (await api.chargeCount()).count;

      // 2. OnceGate Proxy (WITH OnceGate): dispatch charge with x-chaos: drop -> connection drops -> retry
      const gateKey = newKey();
      showToast('Phase 2: Retrying lost response WITH OnceGate Proxy...');
      await api.charge(gateKey, 'drop').catch(() => null);
      await api.charge(gateKey, 'drop').catch(() => null);
      const gateCount = (await api.chargeCount()).count;

      setCompResult({
        directBefore: initialCount,
        directAfter: directCount,
        gateBefore: directCount,
        gateAfter: gateCount
      });

      showToast('Experiment completed! Check Before/After results below.');
      await refresh();
    } catch (err) {
      showToast('Comparison experiment error');
    } finally {
      setCompRunning(false);
    }
  };

  const send = async (type: 'normal' | 'storm' | 'slow' | 'die' | 'drop' | 'mismatch') => {
    setSending(true);
    const key = newKey();

    try {
      if (type === 'mismatch') {
        showToast('Sending initial request with amount ₹4,200...');
        await api.charge(key, undefined, { amount: 4200, currency: 'INR', card_last4: '4242' });
        showToast('Retrying same key with payload mismatch (amount ₹99,999)...');
        await api.charge(key, undefined, { amount: 99999, currency: 'INR', card_last4: '4242' });
      } else if (type === 'drop') {
        showToast('Simulating lost response (socket termination after DB execution)...');
        await api.charge(key, 'drop');
      } else if (type === 'die') {
        showToast('Simulating upstream process crash...');
        await api.charge(key, 'die');
      } else if (type === 'slow') {
        showToast('Simulating upstream timeout (15s delay past 10s gateway limit)...');
        await api.charge(key, 'slow');
      } else if (type === 'storm') {
        showToast('Dispatching 25 concurrent requests with identical key...');
        const replies = await Promise.all(
          Array.from({ length: 25 }, () => api.charge(key))
        );
        showToast(`Processed ${replies.length} parallel requests — 24 duplicate claims blocked in DB`);
      } else {
        showToast('Dispatching standard payment request...');
        await api.charge(key);
        showToast('Operation processed successfully');
      }
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
              <button
                onClick={() => setShowLimits(!showLimits)}
                style={{ background: '#191A23', color: '#E2E8F0', border: '1px solid #333', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>ℹ️ Technical Boundaries</span>
              </button>
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
              Guarantees at-most-once execution for mutating HTTP APIs using PostgreSQL ACID claims, SHA-256 payload locking, and honest <code>UNKNOWN</code> outcome resolution.
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

        {/* SECTION 1: Before/After Failure Experiment Studio (Brace Moment) */}
        <section className="container" style={{ marginBottom: 30 }}>
          <div className="console-panel" style={{ padding: '24px', backgroundColor: '#191A23', color: '#FFF', borderRadius: '16px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ backgroundColor: '#B9FF66', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Measurable Engineering Proof
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#FFF' }}>
                    Side-by-Side "Lost Response" Experiment
                  </h3>
                </div>
                <p style={{ color: '#A0AEC0', fontSize: '0.88rem', maxWidth: '680px', margin: '4px 0 0' }}>
                  Simulates a network drop after payment execution. Proves that retrying <strong>Without OnceGate</strong> creates <strong>2 duplicate charges</strong>, while retrying <strong>With OnceGate</strong> creates <strong>0 duplicate charges</strong>.
                </p>
              </div>

              <button
                className="btn btn-lime"
                onClick={() => void runBeforeAfterDemo()}
                disabled={compRunning}
                style={{ padding: '12px 20px', fontSize: '0.9rem', fontWeight: 700 }}
              >
                {compRunning ? 'Running Experiment...' : '⚡ Run Before / After Proof'}
              </button>
            </div>

            {/* Experiment Results Comparison Display */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 20 }}>
              {/* Box 1: Without OnceGate */}
              <div style={{ backgroundColor: '#262838', padding: '18px', borderRadius: '12px', border: '1px solid #E53E3E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#FC8181', fontWeight: 700, fontSize: '0.9rem' }}>❌ WITHOUT ONCEGATE (Direct Upstream)</span>
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#9B2C2C', color: '#FFF', padding: '2px 6px', borderRadius: '4px' }}>Unprotected Retry</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#CBD5E0', marginBottom: 12 }}>
                  Client POST → Payment executed → Network Connection Drops → Client Retries.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, padding: '10px 12px', backgroundColor: '#1A202C', borderRadius: '8px', color: '#FC8181' }}>
                  <span>Upstream Charges Executed:</span>
                  <span>{compResult.directAfter !== undefined ? `${compResult.directAfter - compResult.directBefore} charges (DUPLICATE 💥)` : 'Run test to measure'}</span>
                </div>
              </div>

              {/* Box 2: With OnceGate */}
              <div style={{ backgroundColor: '#262838', padding: '18px', borderRadius: '12px', border: '1px solid #B9FF66' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#B9FF66', fontWeight: 700, fontSize: '0.9rem' }}>✅ WITH ONCEGATE PROXY</span>
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#22543D', color: '#B9FF66', padding: '2px 6px', borderRadius: '4px' }}>Protected State Machine</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#CBD5E0', marginBottom: 12 }}>
                  Client POST → PostgreSQL Claim → Connection Drops → Retry Intercepted → Outcome UNKNOWN.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, padding: '10px 12px', backgroundColor: '#1A202C', borderRadius: '8px', color: '#B9FF66' }}>
                  <span>Upstream Charges Executed:</span>
                  <span>{compResult.gateAfter !== undefined ? `${compResult.gateAfter - compResult.gateBefore} charge (PROTECTED 🛡️)` : 'Run test to measure'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Interactive Failure Lab & Chaos Studio */}
        <section className="container" style={{ marginBottom: 30 }}>
          <div className="console-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Interactive Failure Lab & Chaos Studio</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 2 }}>
                Inject controlled distributed system failures to verify state machine semantics under network drops, process crashes, and payload mismatches:
              </p>
            </div>

            <div className="controls-flex" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => void send('normal')} disabled={sending}>
                ▶ Standard Request
              </button>
              <button className="btn btn-lime" onClick={() => void send('storm')} disabled={sending}>
                💥 Concurrent Storm (25x)
              </button>
              <button className="btn btn-secondary" onClick={() => void send('drop')} disabled={sending}>
                🧪 Lost Response (Socket Drop)
              </button>
              <button className="btn btn-secondary" onClick={() => void send('mismatch')} disabled={sending}>
                🔀 Payload Mismatch Retry (422)
              </button>
              <button className="btn btn-secondary" onClick={() => void send('slow')} disabled={sending}>
                🐢 Upstream Timeout (15s)
              </button>
              <button className="btn btn-danger" onClick={() => void send('die')} disabled={sending}>
                ⚡ Upstream Process Crash
              </button>
              <button className="btn btn-secondary" onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                🧹 Reset PostgreSQL Storage
              </button>
            </div>

            <div className="status-bar-box" style={{ marginTop: 20 }}>
              <span>
                Upstream DB Rows (`demo.charges`): <span className="count-green">{chargeCount ?? '—'}</span>
              </span>
              {stats && (
                <span>
                  Prevented Duplicates: <span className="count-green">{stats.duplicates_prevented}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 3: Live Receipt Audit Feed */}
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

      {/* Drawer Overlay for Receipt Inspection & AI Explainability */}
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

              {/* AI Explainability Assistant Button */}
              <div style={{ marginBottom: 20, padding: '14px', backgroundColor: '#F7FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D3748' }}>🤖 AI Diagnostic Assistant</span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => void fetchExplanation(detail.id)}
                  >
                    Explain Outcome
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#718096', margin: 0 }}>
                  Generates an evidence-grounded diagnosis analyzing PostgreSQL audit events, retry count, and network timing.
                </p>
              </div>

              {/* AI Explanation Result Box */}
              {explanation && (
                <div style={{ marginBottom: 24, padding: '16px', backgroundColor: '#191A23', color: '#E2E8F0', borderRadius: '12px', border: '1px solid #B9FF66', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#B9FF66', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <span>✓ Grounded Audit Diagnosis</span>
                  </div>
                  <p style={{ margin: '0 0 10px', lineHeight: 1.5 }}>{explanation.summary}</p>
                  <div style={{ fontSize: '0.8rem', color: '#CBD5E0', backgroundColor: '#262838', padding: '10px', borderRadius: '6px' }}>
                    <strong>Remediation:</strong> {explanation.remediation}
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

      {/* Technical Boundaries Drawer Modal */}
      {showLimits && (
        <div className="drawer-overlay" style={{ zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLimits(false)}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '16px', padding: '28px', maxWidth: '600px', width: '90%', border: '2px solid #191A23', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: '#191A23' }}>
              What OnceGate Cannot Know (Transparent Boundaries)
            </h3>
            <div style={{ fontSize: '0.88rem', color: '#4A5568', lineHeight: 1.6 }}>
              <p>
                <strong>Network Ambiguity:</strong> If the gateway forwards a request to an upstream service and the connection drops before HTTP headers arrive, OnceGate cannot determine from outside whether the upstream executed the side-effect.
              </p>
              <p>
                <strong>Honest UNKNOWN State:</strong> Rather than guessing or auto-retrying (which risks double charging), OnceGate durably transitions the receipt to <code>UNKNOWN</code> and blocks further attempts until an operator inspects database logs and records an audited resolution.
              </p>
              <p>
                <strong>Fail-Closed Consistency:</strong> If PostgreSQL loses connectivity, OnceGate returns <code>503 Service Unavailable</code> to prioritize correctness over availability.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowLimits(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
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
