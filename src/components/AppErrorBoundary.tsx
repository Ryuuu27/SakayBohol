import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'Unexpected application error';
    return {hasError: true, errorMessage: message};
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-lg font-bold text-slate-900">
              Sakay Bohol could not finish loading this view
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
            >
              Reload Sakay Bohol
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
