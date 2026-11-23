import React from "react";
import { AppView } from "../types/reader";

interface AppFooterProps {
  onSelectView: (view: AppView) => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onSelectView }) => {
  return (
    <footer className="mt-auto border-t border-slate-200/90 bg-white/80">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:px-6">
        <div className="space-y-1">
          <p className="font-display text-sm font-bold text-slate-900">
            Leitura <span className="text-teal-700">Acessível</span>
          </p>
          <p className="text-slate-500">
            © 2026 Leitura Acessível · Leitura confortável, inclusiva e privada
          </p>
        </div>

        <nav
          aria-label="Links do rodapé"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onSelectView("reader")}
            className="hover:text-teal-800 hover:underline whitespace-nowrap"
          >
            Leitor
          </button>
          <button
            type="button"
            onClick={() => onSelectView("library")}
            className="hover:text-teal-800 hover:underline whitespace-nowrap"
          >
            Biblioteca
          </button>
          <button
            type="button"
            onClick={() => onSelectView("settings")}
            className="hover:text-teal-800 hover:underline whitespace-nowrap"
          >
            Configurações
          </button>
          <button
            type="button"
            onClick={() => onSelectView("privacy")}
            className="hover:text-teal-800 hover:underline whitespace-nowrap"
          >
            Segurança e Privacidade
          </button>
        </nav>
      </div>
    </footer>
  );
};
