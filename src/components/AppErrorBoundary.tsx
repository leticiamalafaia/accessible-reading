import React from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Prevent unhandled crash output from breaking the screen
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="font-display mt-4 text-xl font-bold text-slate-950">
              Algo interrompeu a exibição
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Seus documentos e marcações continuam protegidos no seu navegador.
              Recarregue a página para retomar normalmente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Recarregar aplicativo</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
