import React, { useState } from "react";
import { ChevronDown, LogOut, Menu, ShieldCheck, Upload, X } from "lucide-react";
import { AppView, AuthUser } from "../types/reader";

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onTriggerUpload: () => void;
  isFocusMode: boolean;
  currentUser: AuthUser | null;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: "reader", label: "Leitor" },
  { id: "library", label: "Biblioteca" },
  { id: "settings", label: "Configurações" },
  { id: "privacy", label: "Segurança" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  onTriggerUpload,
  isFocusMode,
  currentUser,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  if (isFocusMode) {
    return null;
  }

  const userInitial = (currentUser?.name || currentUser?.email || "L")
    .trim()
    .charAt(0)
    .toUpperCase();

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

        {/* Zone 3: Primary CTA + clean account menu + mobile menu toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex min-h-[40px] sm:min-h-[42px] items-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 transition-all whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Carregar PDF</span>
          </button>

          {currentUser && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-label="Menu da conta"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                  {userInitial}
                </span>
                <span className="max-w-[110px] truncate">{currentUser.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              </button>

              {accountMenuOpen && (
                <>
                  <div
                    aria-hidden="true"
                    onClick={() => setAccountMenuOpen(false)}
                    className="fixed inset-0 z-30"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {currentUser.email}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-teal-800">
                        {currentUser.role === "admin"
                          ? "Conta Administradora"
                          : "Conta de Leitor"}
                      </p>
                    </div>

                    <div className="mt-1 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onSelectView("privacy");
                        }}
                        className="flex min-h-[38px] w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                      >
                        <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        <span>Segurança e senha</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onLogout();
                        }}
                        className="flex min-h-[38px] w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        <span>Sair da conta</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

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
          {currentUser && (
            <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
                {userInitial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
          )}

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

            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg border-t border-slate-100 px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sair da conta</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

