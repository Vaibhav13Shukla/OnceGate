import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OnceGate Console Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'Space Grotesk, sans-serif' }}>
          <div style={{ background: '#191A23', color: '#B9FF66', display: 'inline-block', padding: '4px 16px', borderRadius: '7px', fontWeight: 600, fontSize: '1.2rem', marginBottom: 20 }}>
            OnceGate Console Recovery
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: 16 }}>An unexpected interface error occurred.</h2>
          <p style={{ color: '#666', marginBottom: 30, fontFamily: 'monospace' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '14px 28px', backgroundColor: '#191A23', color: '#FFF', border: '1px solid #191A23', borderRadius: '14px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
          >
            Reload Console ↺
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
