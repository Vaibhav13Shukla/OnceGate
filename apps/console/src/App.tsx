import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Receipt, type Stats } from './api';

const newKey = () => crypto.randomUUID();
const statusClass = (status: Receipt['status']) => `chip ${status.toLowerCase()}`;

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

function dotClass(kind: string): string {
  return `timeline-dot ${kind.toLowerCase()}`;
}

export default function App() {
  const [token, setToken] = useState('');
  const [stats, setStats] = useState<Stats>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [chargeCount, setChargeCount] = useState<number>();
  const [selected, setSelected] = useState<Receipt>();
  const [detail, setDetail] = useState<DetailReceipt>();
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const prevStats = useRef<Stats | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const count = await api.chargeCount();
      setChargeCount(count.count);
      if (!token) { setLoading(false); return; }
      const [nextStats, nextReceipts] = await Promise.all([api.stats(token), api.receipts(token)]);
      prevStats.current = stats;
      setStats(nextStats);
      setReceipts(nextReceipts.items);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setLoading(false);
    }
  }, [token, stats, showToast]);

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
    showToast(storm ? 'Firing 25 concurrent requests…' : chaos === 'slow' ? 'Sending with timeout chaos…' : chaos === 'die' ? 'Sending crash-after-charge…' : 'Sending charge…');
    try {
      const replies = await Promise.all(
        Array.from({ length: storm ? 25 : 1 }, () => api.charge(key, chaos))
      );
      showToast(storm ? `${replies.length} sent — inspect duplicates prevented` : 'Charge sent ✓');
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

  const isUpdated = (key: keyof Stats) =>
    prevStats.current && stats && prevStats.current[key] !== stats[key] ? ' updated' : '';

  return (
    <>
      <main>
        {/* Header */}
        <header>
          <p className="eyebrow">Durable Idempotency Gateway</p>
          <h1>OnceGate</h1>
          <p>At-most-once forwarding per key · Durable receipts · Honest ambiguity</p>
        </header>

        {/* Token */}
        <section className="token-section glass-panel">
          <label>
            Admin token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token (never persisted)"
            />
          </label>
          <button className="connect-btn" onClick={() => void refresh()}>
            Connect
          </button>
        </section>

        {/* Metrics */}
        <section className="metrics">
          {([
            ['Requests', 'total', false],
            ['Replayed', 'replayed', false],
            ['Duplicates Prevented', 'duplicates_prevented', true],
            ['Open UNKNOWNs', 'unknown_open', false],
          ] as [string, keyof Stats, boolean][]).map(([label, key, highlight]) => (
            <article key={String(key)} className={`metric-card glass-panel${highlight ? ' highlight' : ''}`}>
              <span className="metric-label">{label}</span>
              {loading && !stats ? (
                <div className="skeleton skeleton-metric" />
              ) : (
                <strong className={`metric-value${isUpdated(key)}`}>
                  {stats?.[key] ?? '—'}
                </strong>
              )}
            </article>
          ))}
        </section>

        {/* Demo Controls */}
        <section className="panel glass-panel">
          <h2>⚡ Live Demo</h2>
          <div className="controls">
            <div className="controls-row">
              <button onClick={() => void send()} disabled={sending}>
                Send 1 charge
              </button>
              <button className="primary" onClick={() => void send(undefined, true)} disabled={sending}>
                🔥 Retry storm (25)
              </button>
              <button onClick={() => void send('slow')} disabled={sending}>
                ⏱ Timeout chaos
              </button>
              <button className="danger" onClick={() => void send('die')} disabled={sending}>
                💥 Crash-after-charge
              </button>
              <button onClick={() => void api.resetCharges().then(refresh)} disabled={sending}>
                ↺ Reset demo
              </button>
            </div>
            <div className="status-bar">
              <span>
                Actual charges in DB: <span className="charge-count">{chargeCount ?? '—'}</span>
              </span>
              {stats && (
                <span>
                  Duplicates stopped: <span className="charge-count">{stats.duplicates_prevented}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Receipt Feed */}
        <section className="panel glass-panel">
          <h2>📋 Receipt Feed</h2>
          {loading && !receipts.length ? (
            <div>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>No receipts yet — send a charge to get started.</p>
            </div>
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
                    <td className="key-cell">{r.idempotency_key.slice(0, 20)}…</td>
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
        </section>

        {/* Footer */}
        <footer>
          <p>
            <a href="https://github.com/vaibhav/oncegate" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            {' · '}
            <a
              href="https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07"
              target="_blank"
              rel="noopener noreferrer"
            >
              IETF Draft
            </a>
          </p>
          <p className="footer-claim">
            OnceGate never claims exactly-once. It claims the truth.
          </p>
        </footer>
      </main>

      {/* Drawer overlay */}
      {selected && (
        <div className="drawer-overlay" onClick={() => { setSelected(undefined); setDetail(undefined); }} />
      )}

      {/* Receipt Drawer */}
      {selected && (
        <aside>
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Receipt</p>
              <h2 style={{ marginTop: 8 }}>
                <span className={statusClass(selected.status)}>{selected.status}</span>
              </h2>
              <p className="receipt-id">{selected.id}</p>
            </div>
            <button
              className="close-btn"
              onClick={() => { setSelected(undefined); setDetail(undefined); }}
            >
              ×
            </button>
          </div>

          {detail && (
            <>
              <dl className="receipt-meta">
                <dt>Key</dt>
                <dd>{detail.idempotency_key}</dd>
                {detail.method && <><dt>Method</dt><dd>{detail.method}</dd></>}
                {detail.path && <><dt>Path</dt><dd>{detail.path}</dd></>}
                {detail.upstream_status != null && <><dt>Upstream</dt><dd>{detail.upstream_status}</dd></>}
                <dt>Attempts</dt>
                <dd>{detail.attempt_count}</dd>
                <dt>Created</dt>
                <dd>{new Date(detail.created_at).toLocaleString()}</dd>
                {detail.resolution_note && <><dt>Note</dt><dd>{detail.resolution_note}</dd></>}
              </dl>

              {/* Event Timeline */}
              <div className="timeline">
                <h3>Event Timeline</h3>
                {detail.events.map((event) => (
                  <div key={event.id} className="timeline-event">
                    <div className={dotClass(event.kind)} />
                    <div className="timeline-content">
                      <div className="timeline-kind">{event.kind.replace(/_/g, ' ')}</div>
                      <div className="timeline-time">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resolution */}
              {selected.status === 'UNKNOWN' && (
                <div className="resolve-section">
                  <h3>Resolve Ambiguity</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Investigate the upstream (e.g., check the provider dashboard), then record the truth.
                  </p>
                  <div className="resolve-buttons">
                    <button className="resolve-committed" onClick={() => void resolve('COMMITTED')}>
                      ✓ Committed
                    </button>
                    <button className="resolve-failed" onClick={() => void resolve('FAILED')}>
                      ✗ Failed
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
