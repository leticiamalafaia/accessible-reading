/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppView,
  ComprehensionAction,
  ComprehensionEntry,
  DocumentStudyNote,
  GeminiVoiceName,
  HighlightColor,
  OcrProgressState,
  PdfDocumentRecord,
  ReaderSettings,
  ReadingBookmark,
  ReadingTone,
  TextHighlight,
  TtsEngine,
} from "./types/reader";
import {
  loadReaderSettings,
  resetReaderSettings,
  saveReaderSettings,
} from "./lib/settingsStorage";
import {
  clearAllDocumentsFromDb,
  deleteDocumentFromDb,
  getAllDocumentsFromDb,
  saveDocumentToDb,
  updateDocumentProgressInDb,
} from "./lib/documentDb";
import {
  createSampleAccessiblePdfFile,
  processPdfFile,
  resolveParagraphChapter,
  runAiOcrOnDocument,
  runLocalOcrOnDocument,
} from "./lib/pdfProcessor";
import { requestComprehension } from "./lib/aiClient";
import { useSpeechReader } from "./hooks/useSpeechReader";
import { TopBar } from "./components/TopBar";
import { UploadWelcome } from "./components/UploadWelcome";
import { ReaderWorkspace } from "./components/ReaderWorkspace";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import { AiConsentDialog } from "./components/AiConsentDialog";
import { LibraryView } from "./components/LibraryView";
import { SettingsView } from "./components/SettingsView";
import { PrivacyView } from "./components/PrivacyView";

const ACTION_TITLES: Record<ComprehensionAction, string> = {
  summary: "Resumo simples do documento",
  visual_diagram: "Esquema visual e conexões",
  simplify: "Explicação simplificada",
  explain_word: "Significado da palavra",
  explain_excerpt: "Explicação do trecho",
  study_notes: "Resumo e dados para anotação",
  difficult_words: "Palavras difíceis explicadas",
  qa: "Pergunta e resposta",
};

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("reader");
  const [settings, setSettings] = useState<ReaderSettings>(() =>
    loadReaderSettings()
  );
  const [documents, setDocuments] = useState<PdfDocumentRecord[]>([]);
  const [activeDoc, setActiveDoc] = useState<PdfDocumentRecord | null>(null);

  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgressState | null>(null);

  // AI Assistant state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [comprehensionEntries, setComprehensionEntries] = useState<
    ComprehensionEntry[]
  >([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Privacy consent dialog state
  const [consentDialog, setConsentDialog] = useState<{
    open: boolean;
    purpose: string;
    onApprove: () => void;
    onDecline?: () => void;
  }>({
    open: false,
    purpose: "",
    onApprove: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchedQuestionsDocIdRef = useRef<string | null>(null);
  const activeDocIdRef = useRef<string | null>(null);
  activeDocIdRef.current = activeDoc?.id || null;
  const progressTimerRef = useRef<number | null>(null);
  const playAfterConsentRef = useRef<((overrideEngine?: TtsEngine) => void) | null>(null);
  const pendingAiActionRef = useRef<{
    action: ComprehensionAction;
    options?: { selectedText?: string; question?: string };
  } | null>(null);

  const updateSettings = useCallback((partial: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveReaderSettings(next);
      return next;
    });
  }, []);

  const handleResetSettings = useCallback(() => {
    const defaults = resetReaderSettings();
    setSettings(defaults);
  }, []);

  // Load saved local documents on mount
  useEffect(() => {
    getAllDocumentsFromDb()
      .then((docs) => {
        setDocuments(docs);
      })
      .catch(() => {
        // IndexedDB unavailable fallback
      });
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current !== null) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const handleParagraphProgress = useCallback((index: number) => {
    const docId = activeDocIdRef.current;
    if (!docId) return;
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current);
    }
    progressTimerRef.current = window.setTimeout(() => {
      progressTimerRef.current = null;
      updateDocumentProgressInDb(docId, index).catch(() => {});
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, lastParagraphIndex: index, lastOpenedAt: Date.now() }
            : d
        )
      );
    }, 650);
  }, []);

  const speech = useSpeechReader({
    paragraphs: activeDoc?.paragraphs || [],
    ttsEngine: settings.ttsEngine,
    rate: settings.ttsRate,
    readingTone: settings.readingTone,
    browserVoiceURI: settings.browserVoiceURI,
    browserVoiceProfile: settings.browserVoiceProfile,
    browserVoicePitch: settings.browserVoicePitch,
    aiVoiceName: settings.aiVoiceName,
    onParagraphChange: handleParagraphProgress,
    aiConsentGiven: settings.aiConsentGiven,
    onAiConsentNeeded: (pendingIdx) => {
      setConsentDialog({
        open: true,
        purpose:
          "Para gerar a leitura com Voz Natural com IA, o bloco atual é enviado ao serviço de síntese de voz. Se preferir ficar 100% local, clique em Manter apenas local para ouvir com a voz do seu aparelho.",
        onApprove: () => {
          updateSettings({ aiConsentGiven: true });
          playAfterConsentRef.current = () =>
            speech.playFrom(pendingIdx, 0, "gemini");
          window.setTimeout(() => {
            playAfterConsentRef.current?.();
            playAfterConsentRef.current = null;
          }, 0);
        },
        onDecline: () => {
          updateSettings({ ttsEngine: "browser" });
          playAfterConsentRef.current = () =>
            speech.playFrom(pendingIdx, 0, "browser");
          window.setTimeout(() => {
            playAfterConsentRef.current?.();
            playAfterConsentRef.current = null;
          }, 0);
        },
      });
    },
  });

  const fullDocumentText = useMemo(() => {
    if (!activeDoc) return "";
    return activeDoc.paragraphs.map((p) => p.text).join("\n\n");
  }, [activeDoc]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      speech.stopAll();
      setUploadError(null);
      setIsProcessingPdf(true);
      setProcessingStatus("Lendo páginas e organizando blocos de texto...");

      try {
        const parsedDoc = await processPdfFile(file, (page, total) => {
          setProcessingStatus(`Lendo página ${page} de ${total}...`);
        });
        await saveDocumentToDb(parsedDoc);
        const { pdfData: _inMemoryPdf, ...lightDoc } = parsedDoc;
        setDocuments((prev) => [lightDoc, ...prev]);
        setActiveDoc(lightDoc);
        lastFetchedQuestionsDocIdRef.current = null;
        setComprehensionEntries([]);
        setSuggestedQuestions([]);
        setAiError(null);
        setActiveView("reader");
        speech.syncInitialPosition(0);
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "Não foi possível abrir este arquivo PDF. Verifique se ele não está corromido ou protegido por senha."
        );
      } finally {
        setIsProcessingPdf(false);
        setProcessingStatus("");
      }
    },
    [speech]
  );

  const handleLoadSamplePdf = useCallback(() => {
    const sampleFile = createSampleAccessiblePdfFile();
    handleFileSelected(sampleFile);
  }, [handleFileSelected]);

  const handleOpenDocument = useCallback(
    (doc: PdfDocumentRecord) => {
      speech.stopAll();
      setActiveDoc(doc);
      lastFetchedQuestionsDocIdRef.current = null;
      setComprehensionEntries([]);
      setSuggestedQuestions([]);
      setAiError(null);
      setActiveView("reader");
      const resumeIndex = Math.min(
        Math.max(0, doc.lastParagraphIndex || 0),
        Math.max(0, doc.paragraphs.length - 1)
      );
      speech.syncInitialPosition(resumeIndex);
    },
    [speech]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocumentFromDb(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDoc?.id === id) {
        speech.stopAll();
        lastFetchedQuestionsDocIdRef.current = null;
        setActiveDoc(null);
      }
    },
    [activeDoc, speech]
  );

  const handleClearAllData = useCallback(async () => {
    speech.stopAll();
    await clearAllDocumentsFromDb();
    lastFetchedQuestionsDocIdRef.current = null;
    setDocuments([]);
    setActiveDoc(null);
    setComprehensionEntries([]);
  }, [speech]);

  const handleRunLocalOcr = useCallback(async () => {
    if (!activeDoc) return;
    setUploadError(null);
    try {
      const updated = await runLocalOcrOnDocument(activeDoc, setOcrProgress);
      await saveDocumentToDb(updated);
      setActiveDoc(updated);
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Falha durante o reconhecimento óptico local."
      );
      setAssistantOpen(true);
    } finally {
      setOcrProgress(null);
    }
  }, [activeDoc]);

  const executeAiOcr = useCallback(async () => {
    if (!activeDoc) return;
    try {
      const updated = await runAiOcrOnDocument(activeDoc, setOcrProgress);
      await saveDocumentToDb(updated);
      setActiveDoc(updated);
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Falha durante o OCR assistido por IA."
      );
      setAssistantOpen(true);
    } finally {
      setOcrProgress(null);
    }
  }, [activeDoc]);

  const handleRunAiOcr = useCallback(() => {
    if (!settings.aiConsentGiven) {
      setConsentDialog({
        open: true,
        purpose:
          "Para realizar o OCR avançado com IA, as páginas digitalizadas deste documento serão convertidas em imagem e analisadas externamente.",
        onApprove: () => {
          updateSettings({ aiConsentGiven: true });
          executeAiOcr();
        },
      });
      return;
    }
    executeAiOcr();
  }, [executeAiOcr, settings.aiConsentGiven, updateSettings]);

  const executeComprehensionAction = useCallback(
    async (
      action: ComprehensionAction,
      options?: { selectedText?: string; question?: string }
    ) => {
      if (!activeDoc) return;
      if (settings.focusMode) {
        updateSettings({ focusMode: false });
      }
      setAssistantOpen(true);
      setIsAiLoading(true);
      setAiError(null);

      try {
        const qaHistory =
          action === "qa"
            ? comprehensionEntries
                .filter((e) => e.action === "qa")
                .slice()
                .reverse()
                .flatMap((e) => [
                  { role: "user" as const, content: e.sourceSnippet || "" },
                  { role: "assistant" as const, content: e.content },
                ])
            : undefined;

        const res = await requestComprehension({
          action,
          documentText: fullDocumentText,
          selectedText: options?.selectedText,
          question: options?.question,
          history: qaHistory,
        });

        const cleanText = (res.text || "").trim();
        if (!cleanText) {
          throw new Error(
            "O assistente não retornou conteúdo para este documento. Tente novamente."
          );
        }

        const entry: ComprehensionEntry = {
          id: `ai-${Date.now()}`,
          action,
          title: ACTION_TITLES[action],
          sourceSnippet:
            action === "qa" ? options?.question : options?.selectedText,
          content: cleanText,
          createdAt: Date.now(),
        };

        setComprehensionEntries((prev) => [entry, ...prev]);
      } catch (err) {
        setAiError(
          err instanceof Error
            ? err.message
            : "Erro ao consultar o assistente de leitura."
        );
      } finally {
        setIsAiLoading(false);
      }
    },
    [
      activeDoc,
      comprehensionEntries,
      fullDocumentText,
      settings.focusMode,
      updateSettings,
    ]
  );

  const handleRunAiAction = useCallback(
    (
      action: ComprehensionAction,
      options?: { selectedText?: string; question?: string }
    ) => {
      if (settings.focusMode) {
        updateSettings({ focusMode: false });
      }
      if (!settings.aiConsentGiven) {
        pendingAiActionRef.current = { action, options };
        setAssistantOpen(true);
        setConsentDialog({
          open: true,
          purpose:
            "Para gerar resumos, explicar palavras difíceis ou responder perguntas, o conteúdo relevante do texto atual será enviado ao assistente de IA.",
          onApprove: () => {
            pendingAiActionRef.current = null;
            updateSettings({ aiConsentGiven: true });
            executeComprehensionAction(action, options);
          },
          onDecline: () => {
            setAiError(
              "Autorize o assistente no aviso acima para gerar resumos e explicações com IA."
            );
          },
        });
        return;
      }
      pendingAiActionRef.current = null;
      executeComprehensionAction(action, options);
    },
    [
      executeComprehensionAction,
      settings.aiConsentGiven,
      settings.focusMode,
      updateSettings,
    ]
  );

  // Fetch suggested questions automatically once assistant opens & consent is given (debounced so it never races user actions)
  useEffect(() => {
    if (
      !assistantOpen ||
      !settings.aiConsentGiven ||
      !activeDoc ||
      isAiLoading ||
      fullDocumentText.trim().length < 40 ||
      lastFetchedQuestionsDocIdRef.current === activeDoc.id
    ) {
      return;
    }

    const docId = activeDoc.id;
    const textSnapshot = fullDocumentText;
    const timer = window.setTimeout(() => {
      lastFetchedQuestionsDocIdRef.current = docId;
      requestComprehension({
        action: "suggested_questions",
        documentText: textSnapshot,
      })
        .then((res) => {
          if (
            activeDocIdRef.current === docId &&
            res.questions &&
            res.questions.length > 0
          ) {
            setSuggestedQuestions(res.questions);
          }
        })
        .catch(() => {
          // Non-blocking suggestion failure
        });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [
    activeDoc,
    assistantOpen,
    fullDocumentText,
    isAiLoading,
    settings.aiConsentGiven,
  ]);

  const handleSelectNaturalVoice = useCallback(
    (voiceId: GeminiVoiceName) => {
      if (!settings.aiConsentGiven) {
        setConsentDialog({
          open: true,
          purpose:
            "Para ler com Voz Natural (IA) sem tom robótico, blocos do texto atual são enviados ao serviço de síntese de voz (até ~10 blocos longos gratuitos por dia na API externa).",
          onApprove: () => {
            speech.resetGeminiQuotaFlag();
            updateSettings({
              aiConsentGiven: true,
              ttsEngine: "gemini",
              aiVoiceName: voiceId,
            });
          },
        });
        return;
      }
      speech.stopAll();
      speech.resetGeminiQuotaFlag();
      updateSettings({ ttsEngine: "gemini", aiVoiceName: voiceId });
    },
    [settings.aiConsentGiven, speech, updateSettings]
  );

  const handleSelectBrowserVoice = useCallback(
    (voiceURI: string) => {
      speech.stopAll();
      updateSettings({ ttsEngine: "browser", browserVoiceURI: voiceURI });
    },
    [speech, updateSettings]
  );

  const handleSelectTone = useCallback(
    (tone: ReadingTone) => {
      if (speech.isPlaying && speech.actualEngine === "gemini") {
        speech.stopAll();
      }
      updateSettings({ readingTone: tone });
    },
    [speech, updateSettings]
  );

  const handlePreviewVoice = useCallback(
    (engine: TtsEngine, voiceId: string, customText?: string) => {
      if (engine === "gemini" && !settings.aiConsentGiven) {
        setConsentDialog({
          open: true,
          purpose:
            "Para ouvir uma prévia da Voz Natural (IA), uma frase curta de demonstração será sintetizada.",
          onApprove: () => {
            updateSettings({ aiConsentGiven: true });
            speech.previewVoice(engine, voiceId, customText);
          },
        });
        return;
      }
      speech.previewVoice(engine, voiceId, customText);
    },
    [settings.aiConsentGiven, speech, updateSettings]
  );

  const persistActiveDocMutation = useCallback(
    (updater: (doc: PdfDocumentRecord) => PdfDocumentRecord) => {
      setActiveDoc((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        saveDocumentToDb(updated).catch(() => {});
        setDocuments((docs) =>
          docs.map((d) => (d.id === updated.id ? updated : d))
        );
        return updated;
      });
    },
    []
  );

  const handleToggleBookmark = useCallback(
    (paragraphIndex: number) => {
      persistActiveDocMutation((doc) => {
        const clamped = Math.max(
          0,
          Math.min(Math.max(0, doc.paragraphs.length - 1), paragraphIndex)
        );
        if (doc.bookmark?.paragraphIndex === clamped) {
          return { ...doc, bookmark: null };
        }
        const target = doc.paragraphs[clamped];
        if (!target) return doc;
        const bookmark: ReadingBookmark = {
          paragraphIndex: clamped,
          pageNumber: target.pageNumber,
          chapter: resolveParagraphChapter(doc.paragraphs, clamped, doc.title),
          snippet: target.text.slice(0, 140),
          updatedAt: Date.now(),
        };
        return { ...doc, bookmark };
      });
    },
    [persistActiveDocMutation]
  );

  const handleSetBookmark = useCallback(
    (paragraphIndex: number) => {
      persistActiveDocMutation((doc) => {
        const clamped = Math.max(
          0,
          Math.min(Math.max(0, doc.paragraphs.length - 1), paragraphIndex)
        );
        const target = doc.paragraphs[clamped];
        if (!target) return doc;
        const bookmark: ReadingBookmark = {
          paragraphIndex: clamped,
          pageNumber: target.pageNumber,
          chapter: resolveParagraphChapter(doc.paragraphs, clamped, doc.title),
          snippet: target.text.slice(0, 140),
          updatedAt: Date.now(),
        };
        return { ...doc, bookmark };
      });
    },
    [persistActiveDocMutation]
  );

  const handleClearBookmark = useCallback(() => {
    persistActiveDocMutation((doc) => ({ ...doc, bookmark: null }));
  }, [persistActiveDocMutation]);

  const handleAddHighlight = useCallback(
    (input: Omit<TextHighlight, "id" | "createdAt">) => {
      persistActiveDocMutation((doc) => {
        const existing = doc.highlights || [];
        // Replace an exact duplicate span if the user re-marks the identical selection
        const filtered = existing.filter(
          (h) =>
            !(
              h.paragraphIndex === input.paragraphIndex &&
              h.startOffset === input.startOffset &&
              h.endOffset === input.endOffset
            )
        );
        const created: TextHighlight = {
          ...input,
          id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
        };
        return { ...doc, highlights: [...filtered, created] };
      });
    },
    [persistActiveDocMutation]
  );

  const handleUpdateHighlightColor = useCallback(
    (highlightId: string, color: HighlightColor) => {
      persistActiveDocMutation((doc) => ({
        ...doc,
        highlights: (doc.highlights || []).map((h) =>
          h.id === highlightId ? { ...h, color } : h
        ),
      }));
    },
    [persistActiveDocMutation]
  );

  const handleRemoveHighlight = useCallback(
    (highlightId: string) => {
      persistActiveDocMutation((doc) => ({
        ...doc,
        highlights: (doc.highlights || []).filter((h) => h.id !== highlightId),
      }));
    },
    [persistActiveDocMutation]
  );

  const handleSaveStudyNote = useCallback(
    (entry: ComprehensionEntry) => {
      const currentPage =
        activeDoc?.paragraphs[speech.position.paragraphIndex]?.pageNumber || 1;
      persistActiveDocMutation((doc) => {
        const existing = doc.studyNotes || [];
        const alreadyExists = existing.some(
          (n) => n.title === entry.title && n.content === entry.content
        );
        if (alreadyExists) return doc;
        const note: DocumentStudyNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: entry.title,
          sourceSnippet: entry.sourceSnippet,
          content: entry.content,
          pageNumber: currentPage,
          createdAt: Date.now(),
        };
        return { ...doc, studyNotes: [note, ...existing] };
      });
    },
    [activeDoc, persistActiveDocMutation, speech.position.paragraphIndex]
  );

  const handleDeleteStudyNote = useCallback(
    (noteId: string) => {
      persistActiveDocMutation((doc) => ({
        ...doc,
        studyNotes: (doc.studyNotes || []).filter((n) => n.id !== noteId),
      }));
    },
    [persistActiveDocMutation]
  );

  const savedNoteSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const note of activeDoc?.studyNotes || []) {
      set.add(`${note.title}::${note.content}`);
    }
    return set;
  }, [activeDoc?.studyNotes]);

  const activeParagraphText =
    activeDoc?.paragraphs[speech.position.paragraphIndex]?.text || "";

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-transparent text-slate-900">
      {/* Hidden global PDF file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = "";
        }}
      />

      <TopBar
        activeView={activeView}
        onSelectView={(view) => {
          if (view !== "reader" && settings.focusMode) {
            updateSettings({ focusMode: false });
          }
          setActiveView(view);
        }}
        onTriggerUpload={() => fileInputRef.current?.click()}
        isFocusMode={activeView === "reader" && settings.focusMode && Boolean(activeDoc)}
      />

      {activeView === "reader" && !activeDoc && (
        <UploadWelcome
          recentDocuments={documents}
          isProcessing={isProcessingPdf}
          processingStatus={processingStatus}
          errorMessage={uploadError}
          onFileSelected={handleFileSelected}
          onLoadSamplePdf={handleLoadSamplePdf}
          onOpenDocument={handleOpenDocument}
          onOpenSettings={() => setActiveView("settings")}
        />
      )}

      {activeView === "reader" && activeDoc && (
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <ReaderWorkspace
              document={activeDoc}
              settings={settings}
              onUpdateSettings={updateSettings}
              speech={speech}
              onSelectNaturalVoice={handleSelectNaturalVoice}
              onSelectBrowserVoice={handleSelectBrowserVoice}
              onSelectTone={handleSelectTone}
              onRetryAiVoice={() => {
                speech.resetGeminiQuotaFlag();
                updateSettings({ ttsEngine: "gemini" });
              }}
              onResetSettings={handleResetSettings}
              onPreviewVoice={handlePreviewVoice}
              ocrProgress={ocrProgress}
              onRunLocalOcr={handleRunLocalOcr}
              onRunAiOcr={handleRunAiOcr}
              assistantOpen={assistantOpen}
              onToggleAssistant={() => {
                setAssistantOpen((prev) => {
                  const next = !prev;
                  if (next && settings.focusMode) {
                    updateSettings({ focusMode: false });
                  }
                  return next;
                });
              }}
              onAskAiFromSelection={(action, selectedText) =>
                handleRunAiAction(action, { selectedText })
              }
              onToggleBookmark={handleToggleBookmark}
              onSetBookmark={handleSetBookmark}
              onClearBookmark={handleClearBookmark}
              onAddHighlight={handleAddHighlight}
              onUpdateHighlightColor={handleUpdateHighlightColor}
              onRemoveHighlight={handleRemoveHighlight}
              onDeleteStudyNote={handleDeleteStudyNote}
            />
          </div>

          {assistantOpen && (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl lg:static lg:z-auto lg:w-[350px] xl:w-[390px] lg:max-w-none lg:shadow-none">
              <div className="h-full lg:sticky lg:top-[62px] lg:h-[calc(100vh-62px)]">
                <AiAssistantPanel
                  isOpen={assistantOpen}
                  onClose={() => setAssistantOpen(false)}
                  entries={comprehensionEntries}
                  isLoading={isAiLoading}
                  error={aiError}
                  onDismissError={() => setAiError(null)}
                  suggestedQuestions={suggestedQuestions}
                  aiConsentGiven={settings.aiConsentGiven}
                  onRequestConsent={() => {
                    setConsentDialog({
                      open: true,
                      purpose:
                        "Ao autorizar, você poderá gerar resumos, explicações de palavras, simplificações e perguntas sobre os documentos abertos.",
                      onApprove: () => {
                        updateSettings({ aiConsentGiven: true });
                        setAiError(null);
                        const pending = pendingAiActionRef.current;
                        pendingAiActionRef.current = null;
                        if (pending) {
                          executeComprehensionAction(
                            pending.action,
                            pending.options
                          );
                        }
                      },
                    });
                  }}
                  onRunAction={handleRunAiAction}
                  onClearEntries={() => setComprehensionEntries([])}
                  onSaveStudyNote={handleSaveStudyNote}
                  savedNoteSignatures={savedNoteSignatures}
                  activeParagraphText={activeParagraphText}
                  currentPage={
                    activeDoc.paragraphs[speech.position.paragraphIndex]
                      ?.pageNumber || 1
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === "library" && (
        <LibraryView
          documents={documents}
          activeDocumentId={activeDoc?.id}
          onOpenDocument={handleOpenDocument}
          onDeleteDocument={handleDeleteDocument}
          onClearAll={handleClearAllData}
          onTriggerUpload={() => fileInputRef.current?.click()}
        />
      )}

      {activeView === "settings" && (
        <SettingsView
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={handleResetSettings}
          availableBrowserVoices={speech.availableVoices}
          onRefreshBrowserVoices={speech.refreshVoices}
          previewingVoiceId={speech.previewingVoiceId}
          isPreviewLoading={speech.isPreviewLoading}
          ttsError={speech.ttsError}
          ttsNotice={speech.ttsNotice}
          onDismissNotice={() => {
            speech.setTtsNotice(null);
            speech.setVoiceSwitchInfo(null);
          }}
          onSelectNaturalVoice={handleSelectNaturalVoice}
          onSelectTone={handleSelectTone}
          onPreviewVoice={handlePreviewVoice}
          onStopPreview={speech.stopPreview}
        />
      )}

      {activeView === "privacy" && (
        <PrivacyView
          documentCount={documents.length}
          aiConsentGiven={settings.aiConsentGiven}
          onToggleAiConsent={(val) => updateSettings({ aiConsentGiven: val })}
          onDeleteAllData={handleClearAllData}
          onResetSettings={handleResetSettings}
        />
      )}

      <AiConsentDialog
        open={consentDialog.open}
        purposeDescription={consentDialog.purpose}
        onConfirm={() => {
          const fn = consentDialog.onApprove;
          setConsentDialog((prev) => ({ ...prev, open: false, onDecline: undefined }));
          fn();
        }}
        onCancel={() => {
          const declineFn = consentDialog.onDecline;
          setConsentDialog((prev) => ({ ...prev, open: false, onDecline: undefined }));
          declineFn?.();
        }}
      />
    </div>
  );
}
