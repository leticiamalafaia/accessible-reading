import React, { useState } from "react";
import { Loader2, Play, RefreshCw, RotateCcw, Square } from "lucide-react";
import {
  AI_VOICE_OPTIONS,
  COLOR_LENS_OPTIONS,
  COLUMN_WIDTH_MAP,
  FONT_OPTIONS,
  isGoogleBrowserVoice,
  normalizeVoiceLang,
  READING_THEMES,
  READING_TONE_OPTIONS,
  resolveThemeColors,
  UNLIMITED_VOICE_PROFILES,
} from "../lib/settingsStorage";
import {
  ColumnWidthOption,
  GeminiVoiceName,
  HighlightStyle,
  ReaderSettings,
  ReaderViewMode,
  ReadingTone,
  TtsEngine,
} from "../types/reader";

interface SettingsViewProps {
  settings: ReaderSettings;
  onUpdateSettings: (partial: Partial<ReaderSettings>) => void;
  onResetSettings: () => void;
  availableBrowserVoices: SpeechSynthesisVoice[];
  onRefreshBrowserVoices?: () => void;
  previewingVoiceId: string | null;
  isPreviewLoading: boolean;
  ttsError: string | null;
  ttsNotice?: string | null;
  onDismissNotice?: () => void;
  onSelectNaturalVoice: (voiceId: GeminiVoiceName) => void;
  onSelectTone: (tone: ReadingTone) => void;
  onPreviewVoice: (
    engine: TtsEngine,
    voiceId: string,
    customText?: string
  ) => void;
  onStopPreview: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  availableBrowserVoices,
  onRefreshBrowserVoices,
  previewingVoiceId,
  isPreviewLoading,
  ttsError,
  ttsNotice,
  onDismissNotice,
  onSelectNaturalVoice,
  onSelectTone,
  onPreviewVoice,
  onStopPreview,
}) => {
  const [aiGenderFilter, setAiGenderFilter] = useState<
    "todas" | "feminina" | "masculina"
  >("todas");
  const [previewSampleText, setPreviewSampleText] = useState(
    "Olá! Esta é uma prévia da minha voz para tornar sua leitura mais calma e confortável."
  );
  const previewTheme = resolveThemeColors(settings);
  const previewFontClass =
    FONT_OPTIONS.find((f) => f.id === settings.fontFamily)?.className ||
    "font-lexend";

  return (
    <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-teal-700">
            Conforto visual e voz
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Personalização da Leitura
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Suas preferências são salvas automaticamente neste dispositivo para
            todas as leituras futuras.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Restaurar padrões</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-8 lg:col-span-7">
          {/* 1. Typography */}
          <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Fonte e Espaçamento
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FONT_OPTIONS.map((font) => {
                const selected = settings.fontFamily === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => onUpdateSettings({ fontFamily: font.id })}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-teal-700 bg-teal-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className={`text-base font-bold text-slate-950 ${font.className}`}>
                      {font.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{font.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-font-size">Tamanho da letra</label>
                  <span className="tabular-nums font-semibold">
                    {settings.fontSize} px
                  </span>
                </div>
                <input
                  id="range-font-size"
                  type="range"
                  min={14}
                  max={32}
                  step={1}
                  value={settings.fontSize}
                  onChange={(e) =>
                    onUpdateSettings({ fontSize: Number(e.target.value) })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-line-height">Espaço entre linhas</label>
                  <span className="tabular-nums font-semibold">
                    {settings.lineHeight.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="range-line-height"
                  type="range"
                  min={1.3}
                  max={2.6}
                  step={0.05}
                  value={settings.lineHeight}
                  onChange={(e) =>
                    onUpdateSettings({ lineHeight: Number(e.target.value) })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-letter-spacing">Espaço entre letras</label>
                  <span className="tabular-nums font-semibold">
                    {settings.letterSpacing.toFixed(2)} em
                  </span>
                </div>
                <input
                  id="range-letter-spacing"
                  type="range"
                  min={0}
                  max={0.18}
                  step={0.01}
                  value={settings.letterSpacing}
                  onChange={(e) =>
                    onUpdateSettings({ letterSpacing: Number(e.target.value) })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-word-spacing">Espaço entre palavras</label>
                  <span className="tabular-nums font-semibold">
                    {settings.wordSpacing.toFixed(2)} em
                  </span>
                </div>
                <input
                  id="range-word-spacing"
                  type="range"
                  min={0}
                  max={0.45}
                  step={0.02}
                  value={settings.wordSpacing}
                  onChange={(e) =>
                    onUpdateSettings({ wordSpacing: Number(e.target.value) })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-slate-800">
                Largura da coluna de leitura
              </p>
              <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                {(
                  [
                    { id: "narrow", label: "Estreita (52ch)" },
                    { id: "ideal", label: "Ideal (65ch)" },
                    { id: "wide", label: "Ampla (80ch)" },
                  ] as Array<{ id: ColumnWidthOption; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ columnWidth: opt.id })}
                    className={`min-h-[38px] rounded-md px-3 text-xs font-semibold transition-colors ${
                      settings.columnWidth === opt.id
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Colors and Contrast */}
          <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Cores Suaves e Contraste
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {READING_THEMES.map((t) => {
                const selected = settings.themePreset === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ themePreset: t.id })}
                    style={{ backgroundColor: t.bg, color: t.text }}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "ring-2 ring-teal-700 border-teal-700"
                        : "border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="mt-1 text-xs opacity-80">{t.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="custom-bg"
                  className="block text-sm font-medium text-slate-800"
                >
                  Cor de fundo própria
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="custom-bg"
                    type="color"
                    value={settings.customBgColor}
                    onChange={(e) =>
                      onUpdateSettings({
                        themePreset: "personalizado",
                        customBgColor: e.target.value,
                      })
                    }
                    className="h-10 w-14 cursor-pointer rounded border border-slate-300"
                  />
                  <span className="text-xs font-mono text-slate-600">
                    {settings.customBgColor}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="custom-text"
                  className="block text-sm font-medium text-slate-800"
                >
                  Cor do texto própria
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="custom-text"
                    type="color"
                    value={settings.customTextColor}
                    onChange={(e) =>
                      onUpdateSettings({
                        themePreset: "personalizado",
                        customTextColor: e.target.value,
                      })
                    }
                    className="h-10 w-14 cursor-pointer rounded border border-slate-300"
                  />
                  <span className="text-xs font-mono text-slate-600">
                    {settings.customTextColor}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-contrast">Contraste</label>
                  <span className="tabular-nums font-semibold">
                    {settings.contrastLevel}%
                  </span>
                </div>
                <input
                  id="range-contrast"
                  type="range"
                  min={85}
                  max={120}
                  step={5}
                  value={settings.contrastLevel}
                  onChange={(e) =>
                    onUpdateSettings({ contrastLevel: Number(e.target.value) })
                  }
                  className="mt-3 w-full accent-teal-700"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-sm font-medium text-slate-800">
                Lente colorida suave sobre a leitura (efeito óculos para dislexia)
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Aplica um filtro translúcido suave sobre a folha para reduzir o reflexo branco e cansaço visual.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {COLOR_LENS_OPTIONS.map((lens) => {
                  const selected = (settings.colorLensOverlay || "none") === lens.id;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => onUpdateSettings({ colorLensOverlay: lens.id })}
                      title={lens.description}
                      aria-pressed={selected}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-teal-700 bg-teal-50/70"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span
                        style={{ backgroundColor: lens.swatchHex }}
                        className="h-5 w-5 rounded-full border border-slate-300"
                        aria-hidden="true"
                      />
                      <span className="mt-2 text-xs font-bold text-slate-900">
                        {lens.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Guided Reading & Highlighting */}
          <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Leitura Guiada e Destaque Visual
            </h2>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800">
                Estilo de destaque da palavra falada
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                    className={`min-h-[42px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
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

            <div className="mt-5">
              <p className="text-sm font-medium text-slate-800">
                Organização padrão das páginas
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      id: "page",
                      title: "Uma página por vez",
                      desc: "Evita se perder no texto longo",
                    },
                    {
                      id: "block",
                      title: "Um bloco por vez",
                      desc: "Foco máximo parágrafo a parágrafo",
                    },
                    {
                      id: "all",
                      title: "Fluxo contínuo",
                      desc: "Todas as páginas seguidas",
                    },
                  ] as Array<{ id: ReaderViewMode; title: string; desc: string }>
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        viewMode: mode.id,
                        guidedBlockMode: mode.id === "block",
                        ...(mode.id === "block"
                          ? { blockDivisionEnabled: true }
                          : {}),
                      })
                    }
                    className={`rounded-xl border p-3.5 text-left transition-colors ${
                      settings.viewMode === mode.id
                        ? "border-teal-700 bg-teal-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-950">{mode.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex min-h-[42px] cursor-pointer items-start gap-2.5 text-sm font-medium text-slate-800">
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
                  className="mt-0.5 h-4 w-4 accent-teal-700"
                />
                <span>
                  <span className="block font-semibold text-slate-900">
                    Dividir texto visualmente em blocos
                  </span>
                  <span className="block text-xs text-slate-600">
                    Separa cada parágrafo em blocos numerados com bordas. Desative para ler em fluxo contínuo estilo livro.
                  </span>
                </span>
              </label>

              <label className="flex min-h-[42px] cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.readingRulerEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ readingRulerEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-teal-700"
                />
                <span>Ativar régua de leitura por padrão</span>
              </label>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-medium text-slate-800">
                  Dividir leituras longas em etapas com pausa recomendada
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ao concluir cada etapa de blocos, o leitor sugere uma pausa rápida para descanso e retomada com clareza.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {[
                    { value: 0, label: "Desativado" },
                    { value: 5, label: "A cada 5 blocos" },
                    { value: 8, label: "A cada 8 blocos" },
                    { value: 12, label: "A cada 12 blocos" },
                  ].map((opt) => {
                    const active = (settings.readingChunkGoal ?? 8) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ readingChunkGoal: opt.value })
                        }
                        aria-pressed={active}
                        className={`min-h-[38px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
                          active
                            ? "border-teal-700 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Voice & Speed */}
          <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Voz e Velocidade da Narração
            </h2>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800">
                Motor de leitura em voz alta
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "browser",
                      title: "Vozes do Google e do aparelho (100% Gratuitas · Sem limite)",
                      desc: "Uso ilimitado e gratuito em páginas e livros inteiros, com estilos de timbre variados e sem enviar texto para fora.",
                    },
                    {
                      id: "gemini",
                      title: "Todas as 30 Vozes Naturais Google Gemini (IA)",
                      desc: "30 vozes humanas gratuitas do Google. A API gratuita tem limite diário (~10 blocos longos/dia); quando acaba, o site muda sozinho para sua voz sem limite.",
                    },
                  ] as Array<{ id: TtsEngine; title: string; desc: string }>
                ).map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ttsEngine: eng.id })}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      settings.ttsEngine === eng.id
                        ? "border-teal-700 bg-teal-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-950">{eng.title}</p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{eng.desc}</p>
                  </button>
                ))}
              </div>
              <p className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                <strong>Tem uma chave paga da API Gemini?</strong> Se você selecionar ou atualizar uma chave com faturamento ativo no painel <strong>Settings &gt; Secrets</strong> do AI Studio, o servidor passa a usá-la automaticamente para ampliar os limites da Voz Natural com IA.
              </p>
            </div>

            <div className="mt-5 space-y-5">
              {/* Custom preview text */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <label
                  htmlFor="settings-preview-phrase"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Texto para ouvir a prévia das vozes
                </label>
                <input
                  id="settings-preview-phrase"
                  type="text"
                  value={previewSampleText}
                  onChange={(e) => setPreviewSampleText(e.target.value)}
                  className="mt-1.5 min-h-[38px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </div>

              {ttsError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                >
                  {ttsError}
                </div>
              )}

              {ttsNotice && (
                <div
                  role="status"
                  className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950"
                >
                  <span>{ttsNotice}</span>
                  {onDismissNotice && (
                    <button
                      type="button"
                      onClick={onDismissNotice}
                      className="shrink-0 font-semibold text-amber-900 hover:underline"
                    >
                      OK
                    </button>
                  )}
                </div>
              )}

              {settings.ttsEngine === "browser" ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="select-browser-voice"
                        className="block text-sm font-medium text-slate-800"
                      >
                        Voz do Google / dispositivo (100% gratuita e sem limite)
                      </label>
                      {onRefreshBrowserVoices && (
                        <button
                          type="button"
                          onClick={onRefreshBrowserVoices}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Atualizar vozes</span>
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        id="select-browser-voice"
                        value={settings.browserVoiceURI}
                        onChange={(e) =>
                          onUpdateSettings({ browserVoiceURI: e.target.value })
                        }
                        className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Padrão automático (Google / Português BR)</option>
                        {availableBrowserVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({normalizeVoiceLang(v.lang).toUpperCase()})
                            {isGoogleBrowserVoice(v) ? " · Google (Sem limite)" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const targetUri =
                            settings.browserVoiceURI ||
                            availableBrowserVoices[0]?.voiceURI ||
                            "";
                          if (previewingVoiceId === `browser:${targetUri}`) {
                            onStopPreview();
                          } else {
                            onPreviewVoice(
                              "browser",
                              targetUri,
                              previewSampleText.trim() || undefined
                            );
                          }
                        }}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {previewingVoiceId?.startsWith("browser:") &&
                        !previewingVoiceId.startsWith("browser:profile:") ? (
                          <>
                            <Square className="h-4 w-4 text-teal-700" aria-hidden="true" />
                            <span>Parar</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
                            <span>Ouvir prévia</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 space-y-1.5">
                    <p className="font-semibold text-slate-900">
                      Sobre o Modo Leitura do Google (vozes 1, 2 e 3 Natural) e alternativas ilimitadas
                    </p>
                    <p>
                      As opções <strong>Google português do Brasil 1, 2 e 3 (Natural)</strong> que aparecem no painel lateral do <em>Modo Leitura</em> do Chrome são exclusivas do leitor nativo do navegador e não ficam acessíveis a sites externos.
                    </p>
                    <p>
                      Aqui no site você pode usar gratuitamente e sem limite a voz <strong>Google português do Brasil</strong> e a <strong>Voz do sistema</strong> com os <strong>8 estilos de timbre e o ajuste fino de tom</strong> abaixo, abrir no <strong>Microsoft Edge</strong> (que libera vozes neurais como <em>Francisca</em>, <em>Antonio</em> e <em>Thalita</em> direto nos sites) ou baixar pacotes de voz do Google no <strong>Android</strong> e clicar em <strong>Atualizar vozes</strong>.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-medium text-slate-800">
                      <label htmlFor="range-browser-pitch">
                        Ajuste fino do tom da voz (Grave / Agudo)
                      </label>
                      <span className="tabular-nums font-semibold">
                        {(typeof settings.browserVoicePitch === "number"
                          ? settings.browserVoicePitch
                          : 1.0
                        ).toFixed(2)}
                        x
                      </span>
                    </div>
                    <input
                      id="range-browser-pitch"
                      type="range"
                      min={0.75}
                      max={1.3}
                      step={0.05}
                      value={
                        typeof settings.browserVoicePitch === "number"
                          ? settings.browserVoicePitch
                          : 1.0
                      }
                      onChange={(e) =>
                        onUpdateSettings({
                          browserVoicePitch: Number(e.target.value),
                        })
                      }
                      className="mt-2 w-full accent-emerald-700"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Variações de timbre gratuitas e sem limite
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Ajustam o timbre e a cadência da voz gratuita sem consumir cota externa.
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {UNLIMITED_VOICE_PROFILES.map((prof) => {
                        const isSelected =
                          (settings.browserVoiceProfile || "padrao") === prof.id;
                        const isPrev =
                          previewingVoiceId === `browser:profile:${prof.id}`;
                        return (
                          <div
                            key={prof.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                              isSelected
                                ? "border-emerald-700 bg-emerald-50/50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({ browserVoiceProfile: prof.id })
                              }
                              className="flex-1 text-left"
                            >
                              <p className="text-sm font-bold text-slate-950">
                                {prof.label}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-600">
                                {prof.description}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                isPrev
                                  ? onStopPreview()
                                  : onPreviewVoice(
                                      "browser",
                                      `profile:${prof.id}`,
                                      previewSampleText.trim() || undefined
                                    )
                              }
                              aria-label={`Ouvir prévia de ${prof.label}`}
                              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                            >
                              {isPrev ? (
                                <>
                                  <Square className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                                  <span>Parar</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                                  <span>Prévia</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      Todas as 30 vozes naturais do Google Gemini (PT-BR)
                    </p>
                    <div
                      role="group"
                      aria-label="Filtrar vozes por gênero"
                      className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold"
                    >
                      {(
                        [
                          { id: "todas", label: `Todas (${AI_VOICE_OPTIONS.length})` },
                          { id: "feminina", label: "Femininas (14)" },
                          { id: "masculina", label: "Masculinas (16)" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAiGenderFilter(tab.id)}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            aiGenderFilter === tab.id
                              ? "bg-white text-slate-950 shadow-xs"
                              : "text-slate-600 hover:text-slate-950"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {AI_VOICE_OPTIONS.filter(
                      (v) =>
                        aiGenderFilter === "todas" || v.gender === aiGenderFilter
                    ).map((v) => {
                      const isSelected = settings.aiVoiceName === v.id;
                      const isPreviewing = previewingVoiceId === `gemini:${v.id}`;
                      const isLoadingThis = isPreviewing && isPreviewLoading;
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-colors ${
                            isSelected
                              ? "border-teal-700 bg-teal-50/50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectNaturalVoice(v.id)}
                            className="flex-1 text-left"
                          >
                            <p className="text-sm font-bold text-slate-950">
                              {v.name}{" "}
                              <span className="font-normal text-xs text-slate-500">
                                ({v.id}) · {v.tag}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {v.description}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              isPreviewing
                                ? onStopPreview()
                                : onPreviewVoice(
                                    "gemini",
                                    v.id,
                                    previewSampleText.trim() || undefined
                                  )
                            }
                            aria-label={`Ouvir prévia de ${v.name}`}
                            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            {isLoadingThis ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" aria-hidden="true" />
                                <span>Gerando</span>
                              </>
                            ) : isPreviewing ? (
                              <>
                                <Square className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                                <span>Parar</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                                <span>Prévia</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <label htmlFor="range-tts-rate">Velocidade padrão</label>
                  <span className="tabular-nums font-semibold">
                    {settings.ttsRate.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="range-tts-rate"
                  type="range"
                  min={0.6}
                  max={2.0}
                  step={0.05}
                  value={settings.ttsRate}
                  onChange={(e) =>
                    onUpdateSettings({ ttsRate: Number(e.target.value) })
                  }
                  className="mt-3 w-full accent-teal-700"
                />
              </div>

              {/* Reading Rhythm / Tone area */}
              <div className="border-t border-slate-200 pt-5">
                <p className="text-sm font-medium text-slate-800">
                  Ritmo e tom da leitura
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Adapta a expressividade e o clima da narração para combinar com o conteúdo.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {READING_TONE_OPTIONS.map((tone) => {
                    const selected = settings.readingTone === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => onSelectTone(tone.id)}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          selected
                            ? "border-teal-700 bg-teal-50/60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-950">
                          {tone.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {tone.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5">
          <div className="studio-card sticky top-24 rounded-2xl border border-slate-200/90 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500">
              Prévia ao vivo da sua leitura
            </p>
            <div
              style={{
                backgroundColor: previewTheme.bg,
                color: previewTheme.text,
                borderColor: previewTheme.border,
                filter: `contrast(${settings.contrastLevel}%)`,
              }}
              className="relative mt-3 overflow-hidden rounded-xl border p-6 transition-colors"
            >
              {settings.colorLensOverlay && settings.colorLensOverlay !== "none" && (
                <div
                  aria-hidden="true"
                  style={{
                    backgroundColor:
                      COLOR_LENS_OPTIONS.find(
                        (l) => l.id === settings.colorLensOverlay
                      )?.overlayRgba || "transparent",
                  }}
                  className="pointer-events-none absolute inset-0 z-10"
                />
              )}
              <div
                style={{
                  maxWidth: COLUMN_WIDTH_MAP[settings.columnWidth],
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight,
                  letterSpacing: `${settings.letterSpacing}em`,
                  wordSpacing: `${settings.wordSpacing}em`,
                }}
                className={previewFontClass}
              >
                <p className="font-bold">
                  Exemplo de título organizado
                </p>
                <p className="mt-3">
                  Quando ajustamos o espaçamento e a{" "}
                  <span
                    style={{
                      backgroundColor:
                        settings.highlightStyle === "soft-block" ||
                        settings.highlightStyle === "focus-outline"
                          ? previewTheme.highlightWordBg
                          : "transparent",
                      color:
                        settings.highlightStyle === "soft-block" ||
                        settings.highlightStyle === "focus-outline"
                          ? previewTheme.highlightWordText
                          : "inherit",
                      textDecoration:
                        settings.highlightStyle === "underline"
                          ? "underline"
                          : "none",
                      fontWeight: 700,
                      borderRadius: "4px",
                      padding: "1px 4px",
                    }}
                  >
                    cor
                  </span>{" "}
                  do papel, a leitura flui com muito mais calma e conforto visual.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
