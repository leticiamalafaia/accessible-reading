import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import {
  AI_VOICE_OPTIONS,
  isGoogleBrowserVoice,
  isNaturalOnlineBrowserVoice,
  isPortugueseBrowserVoice,
  normalizeVoiceLang,
  READING_TONE_OPTIONS,
  UNLIMITED_VOICE_PROFILES,
} from "../lib/settingsStorage";
import {
  GeminiVoiceName,
  ReaderSettings,
  ReadingTone,
  TtsEngine,
  UnlimitedVoiceProfileId,
} from "../types/reader";

import { VoiceSwitchInfo } from "../hooks/useSpeechReader";

interface VoicePickerPopoverProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  availableBrowserVoices: SpeechSynthesisVoice[];
  onRefreshBrowserVoices?: () => void;
  previewingVoiceId: string | null;
  isPreviewLoading: boolean;
  ttsError: string | null;
  ttsNotice?: string | null;
  voiceSwitchInfo?: VoiceSwitchInfo | null;
  onDismissNotice?: () => void;
  onRetryAiVoice?: () => void;
  activeParagraphSnippet?: string;
  onSelectNaturalVoice: (voiceId: GeminiVoiceName) => void;
  onSelectBrowserVoice: (voiceURI: string) => void;
  onSelectBrowserVoiceProfile?: (profileId: UnlimitedVoiceProfileId) => void;
  onChangeBrowserVoicePitch?: (pitch: number) => void;
  onSelectTone: (tone: ReadingTone) => void;
  onPreviewVoice: (
    engine: TtsEngine,
    voiceId: string,
    customText?: string
  ) => void;
  onStopPreview: () => void;
}

const DEFAULT_PREVIEW_PHRASE =
  "Olá! Esta é uma prévia da minha voz para tornar sua leitura mais confortável.";

export const VoicePickerPopover: React.FC<VoicePickerPopoverProps> = ({
  open,
  onClose,
  settings,
  availableBrowserVoices,
  onRefreshBrowserVoices,
  previewingVoiceId,
  isPreviewLoading,
  ttsError,
  ttsNotice,
  voiceSwitchInfo,
  onDismissNotice,
  onRetryAiVoice,
  activeParagraphSnippet,
  onSelectNaturalVoice,
  onSelectBrowserVoice,
  onSelectBrowserVoiceProfile,
  onChangeBrowserVoicePitch,
  onSelectTone,
  onPreviewVoice,
  onStopPreview,
}) => {
  const [browserFilter, setBrowserFilter] = useState<"pt" | "google" | "todas">(
    "pt"
  );
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const [aiGenderFilter, setAiGenderFilter] = useState<
    "todas" | "feminina" | "masculina"
  >("todas");
  const [previewPhrase, setPreviewPhrase] = useState(DEFAULT_PREVIEW_PHRASE);

  const ptVoices = useMemo(
    () => availableBrowserVoices.filter((v) => isPortugueseBrowserVoice(v)),
    [availableBrowserVoices]
  );

  const googleVoices = useMemo(
    () => availableBrowserVoices.filter((v) => isGoogleBrowserVoice(v)),
    [availableBrowserVoices]
  );

  const displayedBrowserVoices = useMemo(() => {
    if (browserFilter === "google") return googleVoices;
    if (browserFilter === "todas") return availableBrowserVoices;
    return ptVoices.length > 0 ? ptVoices : availableBrowserVoices;
  }, [availableBrowserVoices, browserFilter, googleVoices, ptVoices]);

  const filteredAiVoices = useMemo(() => {
    if (aiGenderFilter === "todas") return AI_VOICE_OPTIONS;
    return AI_VOICE_OPTIONS.filter((v) => v.gender === aiGenderFilter);
  }, [aiGenderFilter]);

  if (!open) return null;

  const activeProfile = settings.browserVoiceProfile || "padrao";
  const currentPitch =
    typeof settings.browserVoicePitch === "number"
      ? settings.browserVoicePitch
      : 1.0;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/20"
      />
      <div
        role="dialog"
        aria-label="Escolher voz, ritmo e ouvir prévia"
        className="fixed inset-x-3 top-16 z-50 mx-auto flex max-h-[calc(100vh-5rem)] w-auto max-w-[480px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:top-[128px] sm:max-h-[calc(100vh-148px)] sm:w-[480px]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Voz, Ritmo e Prévia
            </h2>
            <p className="text-xs text-slate-500">
              Vozes ilimitadas do Google/navegador e todas as 30 vozes do Google Gemini
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar opções de voz"
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Reading Rhythm / Tone selector */}
        <div className="mt-3 shrink-0">
          <p className="text-xs font-semibold text-slate-700">
            Ritmo da leitura
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {READING_TONE_OPTIONS.map((tone) => {
              const active = settings.readingTone === tone.id;
              return (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => onSelectTone(tone.id)}
                  title={tone.description}
                  aria-pressed={active}
                  className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tone.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview text box */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="voice-preview-phrase"
              className="text-xs font-semibold text-slate-700"
            >
              Frase para prévia da voz
            </label>
            {activeParagraphSnippet && (
              <button
                type="button"
                onClick={() =>
                  setPreviewPhrase(activeParagraphSnippet.slice(0, 160))
                }
                className="text-xs font-medium text-teal-800 hover:underline whitespace-nowrap shrink-0"
              >
                Usar trecho do texto
              </button>
            )}
          </div>
          <input
            id="voice-preview-phrase"
            type="text"
            value={previewPhrase}
            onChange={(e) => setPreviewPhrase(e.target.value)}
            placeholder="Digite uma frase para testar as vozes..."
            className="mt-1.5 min-h-[36px] w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
          />
        </div>

        {ttsError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 shrink-0"
          >
            {ttsError}
          </div>
        )}

        {(voiceSwitchInfo || ttsNotice) && (
          <div
            role="status"
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shrink-0"
          >
            {voiceSwitchInfo ? (
              <div className="space-y-1">
                <p className="font-bold">Voz trocada automaticamente</p>
                <p>
                  De <strong>{voiceSwitchInfo.fromLabel}</strong> para{" "}
                  <strong>{voiceSwitchInfo.toLabel}</strong>.
                </p>
                <p className="text-amber-900">{voiceSwitchInfo.reason}</p>
              </div>
            ) : (
              <span>{ttsNotice}</span>
            )}
            {onDismissNotice && (
              <button
                type="button"
                onClick={onDismissNotice}
                className="mt-1.5 font-semibold text-amber-900 underline"
              >
                Entendi
              </button>
            )}
          </div>
        )}

        <div className="mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {/* 1. Unlimited Free Google & Browser Voices FIRST */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-emerald-900">
                  Vozes do Google e do Aparelho (100% Gratuitas · Sem Limite)
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                  Leitura contínua ilimitada sem cota diária nem bloqueio de páginas.
                </p>
              </div>
              {onRefreshBrowserVoices && (
                <button
                  type="button"
                  onClick={onRefreshBrowserVoices}
                  title="Recarregar vozes do Google e do navegador"
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>Atualizar</span>
                </button>
              )}
            </div>

            {/* Segmented filter bar for unlimited voices */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Filtrar vozes ilimitadas"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-semibold"
              >
                <button
                  type="button"
                  onClick={() => setBrowserFilter("pt")}
                  className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                    browserFilter === "pt"
                      ? "bg-white text-slate-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  Português ({ptVoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserFilter("google")}
                  className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                    browserFilter === "google"
                      ? "bg-white text-slate-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  Google ({googleVoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserFilter("todas")}
                  className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                    browserFilter === "todas"
                      ? "bg-white text-slate-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  Todas ({availableBrowserVoices.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowGoogleGuide((prev) => !prev)}
                aria-expanded={showGoogleGuide}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Mais vozes Google?</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showGoogleGuide ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {showGoogleGuide && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700 space-y-1.5">
                <p className="font-semibold text-slate-900">
                  Por que o Modo Leitura do Google mostra &ldquo;Google português do Brasil 1, 2 e 3 (Natural)&rdquo;?
                </p>
                <p>
                  No Chrome, as vozes <strong>Google português do Brasil 1, 2 e 3 (Natural)</strong> ficam restritas ao painel interno do <em>Modo Leitura</em> do navegador e o Google ainda não libera essas 3 faixas para sites externos pela API padrão da Web.
                </p>
                <p>
                  <strong>O que funciona gratuitamente e sem limite aqui no site:</strong> no Chrome você usa <em>Google português do Brasil</em> + a <em>Voz do sistema</em>, podendo variar nos <strong>8 estilos de timbre e no ajuste fino de tom</strong> logo abaixo. No <strong>Microsoft Edge</strong>, vozes neurais naturais (<em>Francisca</em>, <em>Antonio</em>, <em>Thalita</em>) são liberadas diretamente sem limite. No <strong>Android</strong>, baixe pacotes extras em <em>Acessibilidade &gt; Saída de texto para voz &gt; Google</em> e clique em <strong>Atualizar</strong>.
                </p>
                <p className="text-slate-600">
                  Já as 30 vozes do <strong>Google Gemini</strong> (abaixo) têm cota diária da API externa do Google e não são ilimitadas na camada gratuita.
                </p>
              </div>
            )}

            {displayedBrowserVoices.length === 0 ? (
              <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Nenhuma voz encontrada neste filtro. Clique em <strong>Atualizar</strong> ou selecione <strong>Todas</strong> para ver todas as vozes disponíveis no seu navegador.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {displayedBrowserVoices.map((voice) => {
                  const isGoogle = isGoogleBrowserVoice(voice);
                  const isOnline = isNaturalOnlineBrowserVoice(voice);
                  const isSelected =
                    settings.ttsEngine === "browser" &&
                    (settings.browserVoiceURI === voice.voiceURI ||
                      (!settings.browserVoiceURI &&
                        displayedBrowserVoices[0]?.voiceURI === voice.voiceURI));
                  const isThisPreview =
                    previewingVoiceId === `browser:${voice.voiceURI}`;

                  return (
                    <div
                      key={voice.voiceURI}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
                        isSelected
                          ? "border-emerald-700 bg-emerald-50/60"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBrowserVoice(voice.voiceURI)}
                        className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {voice.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {normalizeVoiceLang(voice.lang).toUpperCase()} ·{" "}
                            {isGoogle
                              ? "Google (Sem limite)"
                              : isOnline
                              ? "Neural online (Sem limite)"
                              : "Local offline (Sem limite)"}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isThisPreview) {
                            onStopPreview();
                          } else {
                            onPreviewVoice(
                              "browser",
                              voice.voiceURI,
                              previewPhrase.trim() || DEFAULT_PREVIEW_PHRASE
                            );
                          }
                        }}
                        aria-label={`Ouvir prévia de ${voice.name}`}
                        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                      >
                        {isThisPreview ? (
                          <>
                            <Square
                              className="h-3 w-3 text-teal-700"
                              aria-hidden="true"
                            />
                            <span>Parar</span>
                          </>
                        ) : (
                          <>
                            <Play
                              className="h-3 w-3 text-teal-700"
                              aria-hidden="true"
                            />
                            <span>Prévia</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unlimited vocal timbre profiles + pitch slider */}
            {onSelectBrowserVoiceProfile && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">
                    Variações de timbre gratuitas (sem limite na voz selecionada acima)
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {UNLIMITED_VOICE_PROFILES.map((prof) => {
                      const selectedProf =
                        settings.ttsEngine === "browser" &&
                        activeProfile === prof.id;
                      const isPrevProf =
                        previewingVoiceId === `browser:profile:${prof.id}`;
                      return (
                        <div
                          key={prof.id}
                          className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                            selectedProf
                              ? "border-emerald-700 bg-white"
                              : "border-slate-200 bg-white/80"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectBrowserVoiceProfile(prof.id)}
                            className="min-w-0 flex-1 text-left"
                            title={prof.description}
                          >
                            <p
                              className={`truncate text-xs font-semibold ${
                                selectedProf
                                  ? "text-emerald-900"
                                  : "text-slate-800"
                              }`}
                            >
                              {prof.label}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              isPrevProf
                                ? onStopPreview()
                                : onPreviewVoice(
                                    "browser",
                                    `profile:${prof.id}`,
                                    previewPhrase.trim() || DEFAULT_PREVIEW_PHRASE
                                  )
                            }
                            aria-label={`Ouvir prévia do estilo ${prof.label}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-teal-700 hover:bg-slate-100"
                          >
                            {isPrevProf ? (
                              <Square className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Play className="h-3 w-3" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {onChangeBrowserVoicePitch && (
                  <div className="border-t border-slate-200 pt-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <label htmlFor="popover-browser-pitch">
                        Ajuste fino do tom (Grave / Agudo)
                      </label>
                      <span className="tabular-nums text-slate-900">
                        {currentPitch.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      id="popover-browser-pitch"
                      type="range"
                      min={0.75}
                      max={1.3}
                      step={0.05}
                      value={currentPitch}
                      onChange={(e) =>
                        onChangeBrowserVoicePitch(Number(e.target.value))
                      }
                      className="mt-1.5 w-full accent-emerald-700"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. All 30 Google Gemini Natural Voices */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-teal-800">
                Todas as 30 Vozes Naturais Google Gemini (IA · Gratuitas)
              </h3>
              <div
                role="group"
                aria-label="Filtrar vozes Gemini por gênero"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-semibold"
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
                    className={`rounded-md px-2 py-1 transition-colors ${
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

            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
              Todas as 30 vozes oficiais do Google Gemini disponíveis sem custo. A
              API externa gratuita limita a ~10 blocos longos por dia; quando a
              cota diária acaba, a leitura continua automaticamente e sem limite
              com a voz do Google/navegador acima.
            </p>

            {voiceSwitchInfo && onRetryAiVoice && (
              <button
                type="button"
                onClick={onRetryAiVoice}
                className="mt-2 min-h-[34px] rounded-lg border border-teal-700 bg-teal-50 px-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-100"
              >
                Tentar Voz IA novamente
              </button>
            )}

            <div className="mt-2 space-y-1.5">
              {filteredAiVoices.map((voice) => {
                const isSelected =
                  settings.ttsEngine === "gemini" &&
                  settings.aiVoiceName === voice.id;
                const isThisPreview =
                  previewingVoiceId === `gemini:${voice.id}`;
                const isThisLoading = isThisPreview && isPreviewLoading;

                return (
                  <div
                    key={voice.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
                      isSelected
                        ? "border-teal-700 bg-teal-50/60"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectNaturalVoice(voice.id)}
                      className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">
                          {voice.name}{" "}
                          <span className="font-normal text-xs text-slate-500">
                            ({voice.id}) · {voice.tag}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          {voice.description}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isThisPreview) {
                          onStopPreview();
                        } else {
                          onPreviewVoice(
                            "gemini",
                            voice.id,
                            previewPhrase.trim() || DEFAULT_PREVIEW_PHRASE
                          );
                        }
                      }}
                      aria-label={
                        isThisPreview
                          ? `Parar prévia de ${voice.name}`
                          : `Ouvir prévia de ${voice.name}`
                      }
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      {isThisLoading ? (
                        <>
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin text-teal-700"
                            aria-hidden="true"
                          />
                          <span>Gerando</span>
                        </>
                      ) : isThisPreview ? (
                        <>
                          <Square
                            className="h-3 w-3 text-teal-700"
                            aria-hidden="true"
                          />
                          <span>Parar</span>
                        </>
                      ) : (
                        <>
                          <Play
                            className="h-3 w-3 text-teal-700"
                            aria-hidden="true"
                          />
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
      </div>
    </>
  );
};
