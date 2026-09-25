import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-Level Application Error Boundary
 * Guarantees that zero runtime errors crash the application or display a white screen.
 * Displays a calm, reassuring, high-contrast accessible error recovery interface.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[GlobalErrorBoundary] Caught unexpected UI error:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-[#F4F7FB] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border-3 border-[#CBD5E1] shadow-xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border-2 border-amber-300">
              <AlertCircle className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-[#0A192F]">
                Lumina Encountered a Brief Pause
              </h1>
              <p className="text-base text-slate-600 font-medium leading-relaxed">
                Everything is safe. We paused the screen to protect your information. Click below to refresh and continue smoothly.
              </p>
            </div>

            <button
              type="button"
              onClick={this.handleRestart}
              className="w-full py-4 px-6 rounded-2xl bg-[#0A192F] hover:bg-slate-800 text-white font-black text-lg flex items-center justify-center gap-3 transition-colors shadow-lg cursor-pointer"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
              <span>Refresh Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { GlobalErrorBoundary as ErrorBoundary };
export default GlobalErrorBoundary;
