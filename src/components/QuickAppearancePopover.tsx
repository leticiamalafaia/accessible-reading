import React from "react";
import { RotateCcw, X } from "lucide-react";
import {
  COLOR_LENS_OPTIONS,
  FONT_OPTIONS,
  READING_THEMES,
} from "../lib/settingsStorage";
import { HighlightStyle, ReaderSettings } from "../types/reader";

interface QuickAppearancePopoverProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (partial: Partial<ReaderSettings>) => void;
  onResetSettings: () => void;
}

export const QuickAppearancePopover: React.FC<QuickAppearancePopoverProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/20"
      />
      <div
        role="dialog"
        aria-label="Ajustes rápidos de leitura"
        className="fixed inset-x-3 top-16 z-50 mx-auto flex max-h-[calc(100vh-5rem)] w-auto max-w-[410px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:top-[128px] sm:max-h-[calc(100vh-148px)] sm:w-[400px]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm font-bold text-slate-950">
              Ajustes da Leitura
            </h2>
            <p className="text-xs text-slate-500">
              Altere fonte, cores, blocos e espaçamento sem sair da página
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes de leitura"
            className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Optional Block Division */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-xs font-bold text-slate-900">
                  Dividir texto em blocos
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                  Mostra cada parágrafo em caixas separadas e numeradas. Desative para leitura contínua estilo livro.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.blockDivisionEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (!enabled && settings.viewMode === "block") {
                    onUpdateSettings({
                      blockDivisionEnabled: false,
                      viewMode: "page",
                      guidedBlockMode: false,
                    });
                  } else {
                    onUpdateSettings({ blockDivisionEnabled: enabled });
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
              />
            </label>
          </div>

          {/* Font family */}
          <div>
            <label
              htmlFor="quick-font-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Tipo de fonte
            </label>
            <select
              id="quick-font-select"
              value={settings.fontFamily}
              onChange={(e) =>
                onUpdateSettings({
                  fontFamily: e.target.value as ReaderSettings["fontFamily"],
                })
              }
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Font size & Line height */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="quick-font-size">Tamanho</label>
                <span className="tabular-nums">{settings.fontSize}px</span>
              </div>
              <input
                id="quick-font-size"
                type="range"
                min={14}
                max={32}
                step={1}
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdateSettings({ fontSize: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            <div className="min-w-0">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="quick-line-height">Entrelinha</label>
                <span className="tabular-nums">
                  {settings.lineHeight.toFixed(2)}x
                </span>
              </div>
              <input
                id="quick-line-height"
                type="range"
                min={1.3}
                max={2.6}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) =>
                  onUpdateSettings({ lineHeight: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>
          </div>

          {/* Letter & Contrast */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="quick-letter-spacing">Letras</label>
                <span className="tabular-nums">
                  {settings.letterSpacing.toFixed(2)}em
                </span>
              </div>
              <input
                id="quick-letter-spacing"
                type="range"
                min={0}
                max={0.18}
                step={0.01}
                value={settings.letterSpacing}
                onChange={(e) =>
                  onUpdateSettings({ letterSpacing: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            <div className="min-w-0">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="quick-contrast">Contraste</label>
                <span className="tabular-nums">{settings.contrastLevel}%</span>
              </div>
              <input
                id="quick-contrast"
                type="range"
                min={85}
                max={120}
                step={5}
                value={settings.contrastLevel}
                onChange={(e) =>
                  onUpdateSettings({ contrastLevel: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>
          </div>

          {/* Soft themes */}
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Fundo e cor do texto
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {READING_THEMES.map((t) => {
                const active = settings.themePreset === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ themePreset: t.id })}
                    style={{ backgroundColor: t.bg, color: t.text }}
                    className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 text-left text-xs font-bold transition-all ${
                      active
                        ? "ring-2 ring-teal-700 border-teal-700"
                        : "border-slate-300"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colored Reading Lens Overlay (PDF p. 4 - óculos coloridos) */}
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Lente colorida suave (efeito óculos)
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {COLOR_LENS_OPTIONS.map((lens) => {
                const active = (settings.colorLensOverlay || "none") === lens.id;
                return (
                  <button
                    key={lens.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ colorLensOverlay: lens.id })
                    }
                    title={lens.description}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                      active
                        ? "border-teal-700 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: lens.swatchHex }}
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300"
                    />
                    <span className="truncate">{lens.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chunk goal & break reminder (PDF p. 3 - dividir tarefas + pausas) */}
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Dividir leitura com pausas (blocos por etapa)
            </p>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {[0, 5, 8, 12].map((goal) => {
                const active = (settings.readingChunkGoal ?? 8) === goal;
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => onUpdateSettings({ readingChunkGoal: goal })}
                    className={`min-h-[34px] rounded-lg border px-2 text-xs font-semibold tabular-nums ${
                      active
                        ? "border-teal-700 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {goal === 0 ? "Sem" : `${goal} bl.`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Highlight style */}
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Destaque da palavra falada
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: "soft-block", label: "Bloco suave" },
                  { id: "underline", label: "Sublinhado" },
                  { id: "focus-outline", label: "Contorno" },
                  { id: "bold-only", label: "Apenas negrito" },
                ] as Array<{ id: HighlightStyle; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ highlightStyle: opt.id })}
                  className={`min-h-[36px] rounded-lg border px-2 text-xs font-semibold ${
                    settings.highlightStyle === opt.id
                      ? "border-teal-700 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2.5 flex justify-end">
            <button
              type="button"
              onClick={onResetSettings}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restaurar padrões</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
