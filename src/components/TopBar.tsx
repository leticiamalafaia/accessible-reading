import React, { useState } from "react";
import { Menu, Upload, X } from "lucide-react";
import { AppView } from "../types/reader";

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onTriggerUpload: () => void;
  isFocusMode: boolean;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: "reader", label: "Leitor" },
  { id: "library", label: "Biblioteca" },
  { id: "settings", label: "Configurações" },
  { id: "privacy", label: "Privacidade" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  onTriggerUpload,
  isFocusMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isFocusMode) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 border-t-2 border-t-teal-600 border-b border-slate-200 bg-white shadow-[0_1px_12px_-4px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex min-h-[56px] max-w-[1440px] items-center justify-between gap-2 px-3 py-2 sm:h-[62px] sm:gap-8 sm:px-6">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectView("reader")}
          className="font-display text-left text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity sm:text-[1.35rem]"
        >
          Leitura <span className="text-teal-700">Acessível</span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`py-2 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  isActive
                    ? "border-teal-600 text-teal-900 font-semibold"
                    : "border-transparent hover:text-slate-950 hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA + mobile menu toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex min-h-[40px] sm:min-h-[42px] items-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 transition-all whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Carregar PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Menu móvel"
          className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-base font-medium transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};

