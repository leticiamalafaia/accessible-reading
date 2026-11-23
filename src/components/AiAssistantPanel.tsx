import React, { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Copy,
  HelpCircle,
  Loader2,
  Network,
  NotebookPen,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { ComprehensionAction, ComprehensionEntry } from "../types/reader";

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ComprehensionEntry[];
  isLoading: boolean;
  error: string | null;
  onDismissError?: () => void;
  suggestedQuestions: string[];
  aiConsentGiven: boolean;
  onRequestConsent: () => void;
  onRunAction: (
    action: ComprehensionAction,
    options?: { selectedText?: string; question?: string }
  ) => void;
  onClearEntries: () => void;
  onSaveStudyNote?: (entry: ComprehensionEntry) => void;
  savedNoteSignatures?: Set<string>;
  activeParagraphText: string;
  currentPage?: number;
}

const renderInlineBold = (line: string): React.ReactNode => {
  const cleanLine = line.replace(/^#{1,6}\s+/, "");
  const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

const FormattedAiContent: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split(/\r?\n/);
  return (
    <div className="mt-2.5 space-y-2 text-sm leading-relaxed text-slate-800 break-words [overflow-wrap:anywhere]">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" aria-hidden="true" />;
        }
        const bulletMatch = trimmed.match(/^(?:•|\*|-)\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span
                aria-hidden="true"
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600"
              />
              <span className="flex-1">{renderInlineBold(bulletMatch[1])}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineBold(trimmed)}</p>;
      })}
    </div>
  );
};

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  isOpen,
  onClose,
  entries,
  isLoading,
  error,
  onDismissError,
  suggestedQuestions,
  aiConsentGiven,
  onRequestConsent,
  onRunAction,
  onClearEntries,
  onSaveStudyNote,
  savedNoteSignatures,
  activeParagraphText,
  currentPage = 1,
}) => {
  const [activeTab, setActiveTab] = useState<"tools" | "history">(
    entries.length > 0 ? "history" : "tools"
  );
  const [questionInput, setQuestionInput] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null);
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);

  const prevCountRef = useRef(entries.length);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Switch automatically to Respostas tab and scroll to top when new results load or arrive
  useEffect(() => {
    if (isLoading || entries.length > prevCountRef.current) {
      setActiveTab("history");
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevCountRef.current = entries.length;
  }, [entries.length, isLoading]);

  useEffect(() => {
    if (error) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error]);

  // Stop local speech reading if panel closes or unmounts
  useEffect(() => {
    if (!isOpen && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingEntryId(null);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (!q) return;
    setQuestionInput("");
    setActiveTab("history");
    onRunAction("qa", { question: q });
  };

  const handleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = wordInput.trim();
    if (!w) return;
    setWordInput("");
    setActiveTab("history");
    onRunAction("explain_word", { selectedText: w });
  };

  const handleSpeakEntry = (entry: ComprehensionEntry) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    if (speakingEntryId === entry.id) {
      setSpeakingEntryId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(entry.content);
    utterance.lang = "pt-BR";
    utterance.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.toLowerCase().startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => setSpeakingEntryId(null);
    utterance.onerror = () => setSpeakingEntryId(null);

    setSpeakingEntryId(entry.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyEntry = async (entry: ComprehensionEntry) => {
    try {
      await navigator.clipboard.writeText(entry.content);
      setCopiedEntryId(entry.id);
      window.setTimeout(() => {
        setCopiedEntryId((curr) => (curr === entry.id ? null : curr));
      }, 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <aside
      aria-label="Painel de leitura assistida"
      className="flex h-full w-full flex-col border-l border-slate-200 bg-white lg:w-[350px] xl:w-[390px] lg:shrink-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 via-white to-teal-50/70 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-700/20">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-950">
              Leitura Assistida
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Apoio à compreensão sem alterar o PDF original
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel de leitura assistida"
          className="inline-flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Organized 2-tab Navigation */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-2.5">
        <div
          role="tablist"
          aria-label="Seções da leitura assistida"
          className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tools"}
            onClick={() => setActiveTab("tools")}
            className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "tools"
                ? "bg-white text-indigo-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Ferramentas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap tabular-nums ${
              activeTab === "history"
                ? "bg-white text-indigo-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Respostas ({entries.length})
          </button>
        </div>
      </div>

      {/* Optional consent banner */}
      {!aiConsentGiven && (
        <div className="border-b border-amber-200 bg-amber-50/80 px-5 py-3 text-xs leading-relaxed text-amber-950">
          <p className="font-semibold">Processamento externo opcional</p>
          <p className="mt-0.5 text-amber-900">
            Apenas o trecho solicitado é enviado à IA para gerar explicações. Seu
            PDF permanece local.
          </p>
          <button
            type="button"
            onClick={onRequestConsent}
            className="mt-2 min-h-[34px] rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-950 transition-colors"
          >
            Autorizar assistente
          </button>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
      >
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
          >
            <span className="min-w-0 flex-1 break-words">{error}</span>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Fechar aviso de erro"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-700 hover:bg-red-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {activeTab === "tools" ? (
          <div className="space-y-6">
            {/* Section 1: Whole document summary first for immediate discovery */}
            <section aria-labelledby="assisted-doc-heading">
              <h3
                id="assisted-doc-heading"
                className="text-xs font-semibold text-slate-500"
              >
                Resumo do documento (IA)
              </h3>

              <div className="mt-2.5 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setActiveTab("history");
                    onRunAction("summary");
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-teal-300 bg-gradient-to-r from-teal-50 via-white to-emerald-50/70 px-3.5 py-2.5 text-left text-sm font-semibold text-teal-950 shadow-xs hover:border-teal-500 hover:from-teal-50 hover:to-emerald-50 transition-all disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                    <BookMarked className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">Criar resumo simples do documento</span>
                    <span className="block text-[11px] font-normal text-slate-600">
                      Ideia principal, pontos-chave e conclusão
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setActiveTab("history");
                    onRunAction("visual_diagram");
                  }}
                  className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/50 px-3.5 py-2.5 text-left text-sm font-semibold text-sky-950 hover:border-sky-400 hover:bg-sky-50 transition-all disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                    <Network className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">Esquema visual / Mapa de ideias</span>
                    <span className="block text-[11px] font-normal text-slate-600">
                      Organiza o texto em conexões visuais e passos lógicos
                    </span>
                  </span>
                </button>
              </div>
            </section>

            {/* Section 2: Active paragraph context */}
            <section
              aria-labelledby="assisted-focus-heading"
              className="border-t border-slate-200 pt-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="assisted-focus-heading"
                  className="text-xs font-semibold text-slate-500 tabular-nums"
                >
                  Trecho em foco · Página {currentPage}
                </h3>
              </div>

              {activeParagraphText ? (
                <p className="mt-1.5 line-clamp-2 text-xs italic leading-relaxed text-slate-600 break-words [overflow-wrap:anywhere]">
                  “{activeParagraphText}”
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">
                  Selecione um parágrafo no texto ou clique em uma ação abaixo.
                </p>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  disabled={isLoading || !activeParagraphText}
                  onClick={() => {
                    setActiveTab("history");
                    onRunAction("study_notes", {
                      selectedText: activeParagraphText,
                    });
                  }}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3.5 py-2.5 text-left text-sm font-semibold text-indigo-950 hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <NotebookPen className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>Resumo e dados para anotação</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading || !activeParagraphText}
                  onClick={() => {
                    setActiveTab("history");
                    onRunAction("simplify", { selectedText: activeParagraphText });
                  }}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>Simplificar trecho em linguagem fácil</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading || !activeParagraphText}
                  onClick={() => {
                    setActiveTab("history");
                    onRunAction("difficult_words", {
                      selectedText: activeParagraphText,
                    });
                  }}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 hover:border-amber-400 hover:bg-amber-50/50 transition-colors disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>Explicar palavras difíceis do trecho</span>
                </button>
              </div>
            </section>

            {/* Section 3: Easy Dictionary */}
            <section
              aria-labelledby="assisted-dict-heading"
              className="border-t border-slate-200 pt-5"
            >
              <h3
                id="assisted-dict-heading"
                className="text-xs font-semibold text-slate-500"
              >
                Dicionário acessível
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Digite uma palavra ou selecione diretamente no texto do PDF.
              </p>
              <form onSubmit={handleWordSubmit} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  placeholder="Ex.: jurisprudência, fotossíntese..."
                  aria-label="Consultar palavra difícil"
                  className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={isLoading || !wordInput.trim()}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Explicar
                </button>
              </form>
            </section>

            {suggestedQuestions.length > 0 && (
              <section
                aria-labelledby="assisted-questions-heading"
                className="border-t border-slate-200 pt-5"
              >
                <p
                  id="assisted-questions-heading"
                  className="text-xs font-semibold text-slate-500"
                >
                  Perguntas sugeridas para revisão
                </p>
                <div className="mt-2.5 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/60">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveTab("history");
                        onRunAction("qa", { question: q });
                      }}
                      className="block w-full px-3.5 py-2.5 text-left text-xs font-medium leading-relaxed text-slate-800 hover:bg-white transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {isLoading && (
              <div className="flex items-center gap-2.5 rounded-lg border border-teal-200 bg-teal-50/60 p-3.5 text-sm text-teal-950">
                <Loader2
                  className="h-4 w-4 animate-spin text-teal-700 shrink-0"
                  aria-hidden="true"
                />
                <span>Preparando explicação em linguagem acessível...</span>
              </div>
            )}

            {entries.length === 0 && !isLoading ? (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  Nenhuma resposta gerada ainda
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Use a aba Ferramentas para resumir ou simplificar, selecione uma
                  palavra no texto ou faça uma pergunta abaixo.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("tools")}
                  className="mt-4 inline-flex min-h-[38px] items-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Abrir ferramentas de apoio
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {entries.map((entry) => {
                  const isSpeaking = speakingEntryId === entry.id;
                  const isCopied = copiedEntryId === entry.id;
                  const isSavedNote = Boolean(
                    savedNoteSignatures?.has(`${entry.title}::${entry.content}`)
                  );

                  return (
                    <article
                      key={entry.id}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                          <span className="font-semibold text-teal-800">
                            {entry.title}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {new Date(entry.createdAt).toLocaleTimeString(
                              "pt-BR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onSaveStudyNote && (
                            <button
                              type="button"
                              onClick={() => onSaveStudyNote(entry)}
                              disabled={isSavedNote}
                              aria-label={
                                isSavedNote
                                  ? "Anotação já salva em Marcas"
                                  : "Salvar nas anotações do documento"
                              }
                              title={
                                isSavedNote
                                  ? "Salva em Marcas"
                                  : "Salvar anotação"
                              }
                              className={`inline-flex min-h-[30px] items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                                isSavedNote
                                  ? "bg-indigo-50 text-indigo-800"
                                  : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                              }`}
                            >
                              {isSavedNote ? (
                                <>
                                  <BookmarkCheck
                                    className="h-3.5 w-3.5 text-indigo-700"
                                    aria-hidden="true"
                                  />
                                  <span>Salvo</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Salvar</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSpeakEntry(entry)}
                            aria-label={
                              isSpeaking
                                ? "Parar leitura da explicação"
                                : "Ouvir explicação"
                            }
                            title={
                              isSpeaking ? "Parar leitura" : "Ouvir explicação"
                            }
                            className={`inline-flex min-h-[30px] items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                              isSpeaking
                                ? "bg-teal-700 text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                            }`}
                          >
                            {isSpeaking ? (
                              <>
                                <Square className="h-3 w-3" aria-hidden="true" />
                                <span>Parar</span>
                              </>
                            ) : (
                              <>
                                <Volume2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Ouvir</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyEntry(entry)}
                            aria-label="Copiar explicação"
                            title="Copiar explicação"
                            className="inline-flex min-h-[30px] items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                          >
                            {isCopied ? (
                              <>
                                <Check
                                  className="h-3.5 w-3.5 text-teal-700"
                                  aria-hidden="true"
                                />
                                <span className="text-teal-800">Copiado</span>
                              </>
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      {entry.sourceSnippet && (
                        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs italic text-slate-600 line-clamp-3 break-words [overflow-wrap:anywhere]">
                          “{entry.sourceSnippet}”
                        </p>
                      )}

                      <FormattedAiContent text={entry.content} />
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pinned Q&A Bar */}
      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
        {entries.length > 0 && activeTab === "history" && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClearEntries}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar respostas</span>
            </button>
          </div>
        )}
        <form onSubmit={handleAskSubmit} className="flex gap-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Pergunte algo sobre este PDF..."
            aria-label="Pergunte algo sobre este PDF"
            className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isLoading || !questionInput.trim()}
            aria-label="Enviar pergunta"
            className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-teal-600 px-3.5 text-white shadow-sm hover:from-indigo-700 hover:to-teal-700 transition-all disabled:opacity-50 shrink-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
};
