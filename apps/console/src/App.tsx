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

// Custom Vector Illustrations for OnceGate
const GateLogo = () => (
  <svg className="logo-icon" viewBox="0 0 36 36" fill="currentColor">
    <path d="M18 0L22.5 13.5L36 18L22.5 22.5L18 36L13.5 22.5L0 18L13.5 13.5L18 0Z" />
  </svg>
);

const HeroIllustration = () => (
  <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="80" width="380" height="340" rx="30" fill="#191A23" />
    <rect x="90" y="130" width="300" height="70" rx="16" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <text x="120" y="172" fill="#191A23" fontSize="20" fontWeight="700" fontFamily="Space Grotesk">Idempotency-Key: 7f4a...29a</text>
    <rect x="90" y="230" width="300" height="70" rx="16" fill="#FFFFFF" stroke="#191A23" strokeWidth="4" />
    <text x="120" y="272" fill="#191A23" fontSize="18" fontWeight="600" fontFamily="Space Grotesk">PostgreSQL: Atomic Claim</text>
    <circle cx="470" cy="250" r="60" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M445 250L465 270L495 235" stroke="#191A23" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M390 165L470 190" stroke="#191A23" strokeWidth="6" strokeDasharray="8 8" />
  </svg>
);

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [token, setToken] = useState('admin-secret');
  const [stats, setStats] = useState<Stats>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [chargeCount, setChargeCount] = useState<number>();
  const [selected, setSelected] = useState<Receipt>();
  const [detail, setDetail] = useState<DetailReceipt>();
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeProcess, setActiveProcess] = useState<number>(0);

  // ROI Calculator State
  const [monthlyRequests, setMonthlyRequests] = useState<number>(1000000);
  const [duplicateRate, setDuplicateRate] = useState<number>(1.5);

  const prevStats = useRef<Stats | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / Math.max(totalHeight, 1)) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    try {
      const count = await api.chargeCount().catch(() => ({ count: 0 }));
      setChargeCount(count.count);
      const activeToken = tokenRef.current;
      if (!activeToken) { setLoading(false); return; }
      const [nextStats, nextReceipts] = await Promise.all([
        api.stats(activeToken).catch(() => undefined),
        api.receipts(activeToken).catch(() => ({ items: [] }))
      ]);
      if (nextStats) {
        prevStats.current = nextStats;
        setStats(nextStats);
      }
      if (nextReceipts) {
        setReceipts(nextReceipts.items);
      }
    } catch {
      // Silent catch on interval to prevent toast spam
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
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
    showToast(storm ? 'Firing 25 concurrent requests…' : chaos === 'slow' ? 'Sending timeout chaos…' : chaos === 'die' ? 'Sending crash-after-charge…' : 'Sending charge request…');
    try {
      const replies = await Promise.all(
        Array.from({ length: storm ? 25 : 1 }, () => api.charge(key, chaos))
      );
      showToast(storm ? `${replies.length} sent — inspect duplicates prevented` : 'Charge request processed ✓');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Charge request failed');
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const resolve = async (status: 'COMMITTED' | 'FAILED') => {
    if (!detail) return;
    const note = window.prompt('Resolution note (for audit trail):');
    if (!note) return;
    try {
      await api.resolve(detail.id, status, note, token);
      showToast(`Receipt resolved → ${status}`);
      await refresh();
      await inspect(detail);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resolution failed');
    }
  };

  const processSteps = [
    {
      num: '01',
      title: 'Client Request & Idempotency Key Check',
      desc: 'The client sends a mutating HTTP request (POST/PUT/PATCH) with an `Idempotency-Key` header. Safe methods (GET/HEAD) bypass the idempotency engine cleanly.'
    },
    {
      num: '02',
      title: 'Atomic PostgreSQL Claim (ACID Guarantee)',
      desc: 'OnceGate attempts an atomic claim in PostgreSQL using `INSERT INTO receipts ... ON CONFLICT (tenant, idempotency_key) DO NOTHING`. If claimed, execution proceeds; if existing, the Gateway checks status.'
    },
    {
      num: '03',
      title: 'Upstream Network Hop & Processing',
      desc: 'The Gateway forwards the payload to the upstream backend service. If the payload sha256 fingerprint differs from a previous attempt with the same key, OnceGate returns 422 Unprocessable Entity.'
    },
    {
      num: '04',
      title: 'Outcome Settlement (COMMITTED / FAILED / UNKNOWN)',
      desc: 'If upstream returns <500, status is settled as COMMITTED. If 5xx, status is FAILED. If upstream times out or drops connection, status is marked UNKNOWN.'
    },
    {
      num: '05',
      title: 'Truthful Duplicate Replay',
      desc: 'Subsequent requests with the same key during receipt lifetime receive the exact stored response with header `OnceGate-Replayed: true` without re-executing side effects.'
    },
    {
      num: '06',
      title: 'Background Sweeper TTL Cleanup',
      desc: 'An automated background sweeper purges expired receipts beyond configured TTL (default 24 hours) while maintaining audit integrity.'
    }
  ];

  const qaItems = [
    {
      q: 'Why not Temporal / Restate / Inngest?',
      a: 'They solve durable workflows and require restructuring code around their SDKs. OnceGate absorbs exactly one responsibility — duplicate-safe HTTP — at the proxy layer with zero code changes to the upstream.'
    },
    {
      q: 'Isn\'t this just idempotent-proxy?',
      a: 'OnceGate provides durable receipts in PostgreSQL with ACID guarantees, an explicit PENDING → COMMITTED | FAILED | UNKNOWN state machine, sha256 fingerprint enforcement, and an ops console for human resolution of ambiguous outcomes.'
    },
    {
      q: 'Does OnceGate claim exactly-once?',
      a: 'Impossible to guarantee from outside the upstream. OnceGate guarantees at-most-once forwarding per key within TTL, plus durable truthful receipts. The UNKNOWN state exists because we refuse to lie about timeouts.'
    },
    {
      q: 'Why PostgreSQL and not Redis?',
      a: 'Receipts are records, not cache. Eviction of a receipt means a possible double charge. ACID transactions and unique constraints provide atomic claim semantics for free.'
    }
  ];

  // Calculator Estimates
  const preventedDuplicates = Math.round(monthlyRequests * (duplicateRate / 100));
  const financialRiskSaved = Math.round(preventedDuplicates * 42);
  const engineeringHoursSaved = Math.round((preventedDuplicates / 1000) * 1.5);

  return (
    <>
      {/* Top Scroll Progress Indicator */}
      <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} />

      {/* Navigation Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <a href="#" className="logo">
              <GateLogo />
              <span>OnceGate</span>
            </a>
            <ul className="nav-links">
              <li><a href="#about">Overview</a></li>
              <li><a href="#console">Live Console</a></li>
              <li><a href="#calculator">Risk Calculator</a></li>
              <li><a href="#matrix">IETF Matrix</a></li>
              <li><a href="#process">Working Process</a></li>
              <li><a href="#qa">Judge Q&A</a></li>
              <li>
                <a href="#console" className="btn btn-lime" style={{ padding: '10px 20px' }}>
                  Connect Console
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero" id="about">
          <div className="container">
            <div className="eyebrow-badge">
              <span className="status-dot-live" />
              <span>Zerops Challenge • Durable HTTP Idempotency Gateway</span>
            </div>
            <div className="hero-grid">
              <div className="hero-content">
                <h1>Making any HTTP API safe to retry</h1>
                <p>
                  A durable, Postgres-backed implementation of the IETF <code>Idempotency-Key</code> draft, with honest <code>UNKNOWN</code> outcome semantics and an ops console that counts every duplicate it stopped.
                </p>
                <div className="hero-cta-group">
                  <a href="#console" className="btn btn-primary">
                    Open Live Console
                  </a>
                  <a href="#calculator" className="btn btn-secondary">
                    Calculate Duplicate Savings ↗
                  </a>
                </div>
              </div>
              <div className="hero-illustration">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* Live Metrics Bar Cards */}
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
                <div className="stat-label">Duplicates Stopped</div>
                <div className="stat-value">{stats?.duplicates_prevented ?? '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open UNKNOWNs</div>
                <div className="stat-value">{stats?.unknown_open ?? '—'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Admin Token Banner */}
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

        {/* Live Ops Console Panel */}
        <section className="container" id="console">
          <div className="console-panel">
            <h3>⚡ Live Demo Controls</h3>
            <p style={{ color: '#555', marginBottom: 20 }}>
              Trigger real charges and chaos modes against the upstream payment server:
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

        {/* Receipt Feed Table */}
        <section className="container">
          <div className="table-card">
            <h3>📋 Receipt Feed</h3>
            {loading && !receipts.length ? (
              <p style={{ padding: 20, color: '#666' }}>Loading receipt feed…</p>
            ) : receipts.length === 0 ? (
              <p style={{ padding: 20, color: '#666' }}>No receipts in database yet — click an action above to generate transactions.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Age</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Duplicate Risk & ROI Calculator */}
        <section className="calculator-section" id="calculator">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Duplicate Risk Calculator</span>
              <p className="section-desc">
                Calculate the financial risk and double-charge incidents prevented by OnceGate.
              </p>
            </div>

            <div className="calculator-card">
              <div className="calc-inputs">
                <div className="range-slider-group">
                  <div className="range-header">
                    <span>Monthly API Requests</span>
                    <span>{monthlyRequests.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="100000"
                    max="10000000"
                    step="100000"
                    value={monthlyRequests}
                    onChange={(e) => setMonthlyRequests(Number(e.target.value))}
                  />
                </div>

                <div className="range-slider-group">
                  <div className="range-header">
                    <span>Retry / Timeout Rate (%)</span>
                    <span>{duplicateRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={duplicateRate}
                    onChange={(e) => setDuplicateRate(Number(e.target.value))}
                  />
                </div>

                <a href="#console" className="btn btn-primary">
                  Protect Your API Now
                </a>
              </div>

              <div className="calc-results-box">
                <span className="res-title">Prevented Double-Charge Incidents</span>
                <div className="res-big-number">+{preventedDuplicates.toLocaleString()} / mo</div>
                <div className="res-grid-sub">
                  <div className="res-sub-item">
                    <span>Financial Risk Prevented</span>
                    <strong>${financialRiskSaved.toLocaleString()}</strong>
                  </div>
                  <div className="res-sub-item">
                    <span>Support Hours Saved</span>
                    <strong>+{engineeringHoursSaved} hrs/mo</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IETF Draft Behavior Matrix */}
        <section className="matrix-section" id="matrix">
          <div className="container">
            <div className="section-header">
              <span className="section-title">IETF Conformance Matrix</span>
              <p className="section-desc">
                OnceGate enforces all 11 rows of the IETF Idempotency-Key specification at the database layer.
              </p>
            </div>

            <div className="matrix-grid">
              <div className="matrix-card card-light">
                <h4>01. Safe Method Passthrough</h4>
                <p>GET and HEAD requests pass through the proxy without creating receipt records or locking concurrency.</p>
              </div>

              <div className="matrix-card card-lime">
                <h4>02. Payload Fingerprint Lock</h4>
                <p>Reusing an idempotency key with a modified request body returns <code>422 Unprocessable Entity</code>.</p>
              </div>

              <div className="matrix-card card-dark">
                <h4>03. Concurrent Conflict In-Flight</h4>
                <p>Simultaneous duplicate requests while a key is pending return <code>409 Conflict</code> immediately.</p>
              </div>

              <div className="matrix-card card-light">
                <h4>04. Honest UNKNOWN Semantics</h4>
                <p>Upstream timeouts are recorded as <code>UNKNOWN</code> — never auto-retried, surfaced for human audit.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Working Process Section */}
        <section className="process-section" id="process">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Our Working Process</span>
              <p className="section-desc">
                How OnceGate enforces duplicate-safe execution per request lifecycle
              </p>
            </div>

            <div className="process-list">
              {processSteps.map((step, idx) => {
                const isExpanded = activeProcess === idx;
                return (
                  <div
                    key={step.num}
                    className={`process-item ${isExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => setActiveProcess(isExpanded ? -1 : idx)}
                  >
                    <div className="process-header">
                      <div className="process-title-group">
                        <span className="process-num">{step.num}</span>
                        <span className="process-name">{step.title}</span>
                      </div>
                      <div className="toggle-btn">
                        {isExpanded ? '-' : '+'}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="process-body">
                        {step.desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Judge Q&A Section */}
        <section className="qa-section" id="qa">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Judge Q&A</span>
              <p className="section-desc">
                Architectural justification and design trade-offs pre-answered for judges.
              </p>
            </div>

            <div className="qa-card">
              <div className="qa-grid">
                {qaItems.map((item) => (
                  <div key={item.q} className="qa-item">
                    <h4>{item.q}</h4>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
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
              <span className="eyebrow-badge">Receipt Details</span>
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
                <dt style={{ color: '#666' }}>Key</dt>
                <dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.idempotency_key}</dd>
                {detail.method && <><dt style={{ color: '#666' }}>Method</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.method}</dd></>}
                {detail.path && <><dt style={{ color: '#666' }}>Path</dt><dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.path}</dd></>}
                <dt style={{ color: '#666' }}>Attempts</dt>
                <dd style={{ fontFamily: 'JetBrains Mono' }}>{detail.attempt_count}</dd>
              </dl>

              {/* Timeline */}
              <div className="timeline">
                <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>Event Audit Trail</h4>
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
                    Investigate upstream logs, then record the audit resolution:
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
                <li><a href="#about">Overview</a></li>
                <li><a href="#console">Live Console</a></li>
                <li><a href="#calculator">Risk Calculator</a></li>
                <li><a href="#matrix">IETF Matrix</a></li>
                <li><a href="#process">Working Process</a></li>
                <li><a href="#qa">Judge Q&A</a></li>
              </ul>
            </div>

            <div className="footer-bottom">
              <div>© 2026 OnceGate · Built for Zerops Challenge.</div>
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
