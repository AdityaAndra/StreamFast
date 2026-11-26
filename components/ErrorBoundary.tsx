import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Last line of defence: if any screen throws while rendering, show a reload screen instead of a blank page. */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('StreamFast hit an error while rendering', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center bg-netflix-bg px-6 text-center text-netflix-text">
        <h1 className="mb-3 text-[clamp(1.8rem,3.5vw,3rem)] font-bold tracking-[-0.02em] text-white">Something went wrong</h1>
        <p className="mb-8 max-w-md text-lg text-netflix-muted">Sorry, StreamFast ran into a problem. Reloading the page usually fixes it.</p>
        <button type="button" onClick={() => window.location.reload()} className="nf-btn nf-btn-white">
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
