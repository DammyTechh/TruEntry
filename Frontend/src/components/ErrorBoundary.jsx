import { Component } from 'react';

/**
 * Catches render-time crashes anywhere below it. Without this, a single
 * undefined field in a dashboard component unmounts the whole tree and the
 * user is left staring at a blank white page with no explanation.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for debugging; never show it to the user.
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary-surface px-4 text-center">
        <div className="card max-w-md p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-danger">
            !
          </div>
          <h1 className="mt-4 font-display text-lg font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            This page failed to load. Reloading usually fixes it — if it keeps happening, please contact support.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Reload page
            </button>
            <a
              href="/"
              className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-surface"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
