import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignJustify,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CornerDownRight,
  Eye,
  FileText,
  Focus,
  Highlighter,
  Layers,
  Loader2,
  MessageSquareText,
  Minus,
  Network,
  NotebookPen,
  Plus,
  Pause,
  Play,
  ScanText,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  ComprehensionAction,
  GeminiVoiceName,
  HighlightColor,
  OcrProgressState,
  PdfDocumentRecord,
  PdfParagraph,
  ReaderSettings,
  ReaderViewMode,
  ReadingTone,
  TextHighlight,
  TtsEngine,
} from "../types/reader";
import {
  AI_VOICE_OPTIONS,
  COLOR_LENS_OPTIONS,
  COLUMN_WIDTH_MAP,
  FONT_OPTIONS,
  HIGHLIGHT_COLOR_OPTIONS,
  READING_TONE_OPTIONS,
  resolveThemeColors,
} from "../lib/settingsStorage";
import { resolveParagraphChapter } from "../lib/pdfProcessor";
import { SpeechPosition, VoiceSwitchInfo } from "../hooks/useSpeechReader";
import { VoicePickerPopover } from "./VoicePickerPopover";
import {
  NavigatorDrawerTab,
  PageNavigatorDrawer,
} from "./PageNavigatorDrawer";
import { QuickAppearancePopover } from "./QuickAppearancePopover";
import { ReadingRulerOverlay } from "./ReadingRulerOverlay";
import { ParagraphBlock } from "./ParagraphBlock";

interface ReaderWorkspaceProps {
  document: PdfDocumentRecord;
  settings: ReaderSettings;
  onUpdateSettings: (partial: Partial<ReaderSettings>) => void;
  speech: {
    isPlaying: boolean;
    isPaused: boolean;
    isLoadingAudio: boolean;
    previewingVoiceId: string | null;
    isPreviewLoading: boolean;
    ttsError: string | null;
    ttsNotice: string | null;
    setTtsNotice: (val: string | null) => void;
    voiceSwitchInfo: VoiceSwitchInfo | null;
    setVoiceSwitchInfo: (val: VoiceSwitchInfo | null) => void;
    actualEngine: TtsEngine;
    activeBrowserVoiceLabel: string;
    availableVoices: SpeechSynthesisVoice[];
    refreshVoices?: () => void;
    position: SpeechPosition;
    playFrom: (
      paragraphIndex: number,
      sentenceIndex?: number,
      overrideEngine?: TtsEngine
    ) => void;
    stopPreview: () => void;
    togglePlayPause: () => void;
    stopAll: () => void;
    skipNext: () => void;
    skipPrev: () => void;
    jumpToParagraph: (idx: number) => void;
    jumpToPage: (pageNumber: number) => void;
  };
  onSelectNaturalVoice: (voiceId: GeminiVoiceName) => void;
  onSelectBrowserVoice: (voiceURI: string) => void;
  onSelectTone: (tone: ReadingTone) => void;
  onRetryAiVoice: () => void;
  onResetSettings: () => void;
  onPreviewVoice: (
    engine: TtsEngine,
    voiceId: string,
    customText?: string
  ) => void;
  ocrProgress: OcrProgressState | null;
  onRunLocalOcr: () => void;
  onRunAiOcr: () => void;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
  onAskAiFromSelection: (
    action: ComprehensionAction,
    selectedText: string
  ) => void;
  onToggleBookmark: (paragraphIndex: number) => void;
  onSetBookmark: (paragraphIndex: number) => void;
  onClearBookmark: () => void;
  onAddHighlight: (highlight: Omit<TextHighlight, "id" | "createdAt">) => void;
  onUpdateHighlightColor: (highlightId: string, color: HighlightColor) => void;
  onRemoveHighlight: (highlightId: string) => void;
  onDeleteStudyNote?: (noteId: string) => void;
}

const ALL_MODE_WINDOW_SIZE = 80;

export const ReaderWorkspace: React.FC<ReaderWorkspaceProps> = ({
  document: pdfDoc,
  settings,
  onUpdateSettings,
  speech,
  onSelectNaturalVoice,
  onSelectBrowserVoice,
  onSelectTone,
  onRetryAiVoice,
  onResetSettings,
  onPreviewVoice,
  ocrProgress,
  onRunLocalOcr,
  onRunAiOcr,
  assistantOpen,
  onToggleAssistant,
  onAskAiFromSelection,
  onToggleBookmark,
  onSetBookmark,
  onClearBookmark,
  onAddHighlight,
  onUpdateHighlightColor,
  onRemoveHighlight,
  onDeleteStudyNote,
}) => {
  const theme = useMemo(() => resolveThemeColors(settings), [settings]);
  const fontClass =
    FONT_OPTIONS.find((f) => f.id === settings.fontFamily)?.className ||
    "font-lexend";

  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [navDrawerTab, setNavDrawerTab] = useState<NavigatorDrawerTab>("pages");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [allModeWindow, setAllModeWindow] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: ALL_MODE_WINDOW_SIZE });
  const [selectionState, setSelectionState] = useState<{
    text: string;
    x: number;
    y: number;
    placeBelow: boolean;
    paragraphIndex: number | null;
    startOffset: number;
    endOffset: number;
    pageNumber: number;
  } | null>(null);
  const [activeMarkPopover, setActiveMarkPopover] = useState<{
    highlight: TextHighlight;
    x: number;
    y: number;
    placeBelow: boolean;
  } | null>(null);
  const [pausedStageAck, setPausedStageAck] = useState<number | null>(null);

  const viewMode: ReaderViewMode =
    !settings.blockDivisionEnabled && settings.viewMode === "block"
      ? "page"
      : settings.viewMode || (settings.guidedBlockMode ? "block" : "page");

  const isAutoSwitched =
    Boolean(speech.voiceSwitchInfo) ||
    (settings.ttsEngine === "gemini" && speech.actualEngine === "browser");

  const activeVoiceLabel = useMemo(() => {
    if (isAutoSwitched) {
      return `Troca: ${speech.activeBrowserVoiceLabel}`;
    }
    if (settings.ttsEngine === "gemini") {
      const found = AI_VOICE_OPTIONS.find((v) => v.id === settings.aiVoiceName);
      return `${found?.name || "Clara"} (Voz IA)`;
    }
    const browserFound = speech.availableVoices.find(
      (v) => v.voiceURI === settings.browserVoiceURI
    );
    if (browserFound) {
      return `${browserFound.name.split(/\s+/).slice(0, 2).join(" ")} (Local)`;
    }
    return "Voz local";
  }, [
    isAutoSwitched,
    settings.aiVoiceName,
    settings.browserVoiceURI,
    settings.ttsEngine,
    speech.activeBrowserVoiceLabel,
    speech.availableVoices,
  ]);

  const paragraphRefs = useRef<Map<number, HTMLElement>>(new Map());
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  const registerParagraphRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      if (el) {
        paragraphRefs.current.set(index, el);
      } else {
        paragraphRefs.current.delete(index);
      }
    },
    []
  );

  const activeParagraphIdx = Math.max(
    0,
    Math.min(
      Math.max(0, pdfDoc.paragraphs.length - 1),
      speech.position.paragraphIndex
    )
  );
  const currentParagraph: PdfParagraph | undefined =
    pdfDoc.paragraphs[activeParagraphIdx];
  const currentPage = currentParagraph?.pageNumber || 1;
  const totalPages = Math.max(1, pdfDoc.pageCount);

  const currentChapter = useMemo(
    () =>
      resolveParagraphChapter(pdfDoc.paragraphs, activeParagraphIdx, pdfDoc.title),
    [activeParagraphIdx, pdfDoc.paragraphs, pdfDoc.title]
  );

  // Keep sliding window centered around activeParagraphIdx in "all" mode for huge PDFs
  useEffect(() => {
    setAllModeWindow({
      start: 0,
      end: Math.min(pdfDoc.paragraphs.length, ALL_MODE_WINDOW_SIZE),
    });
    setActiveMarkPopover(null);
    setSelectionState(null);
    setPausedStageAck(null);
  }, [pdfDoc.id, pdfDoc.paragraphs.length]);

  useEffect(() => {
    if (viewMode !== "all" || pdfDoc.paragraphs.length <= ALL_MODE_WINDOW_SIZE) {
      return;
    }
    setAllModeWindow((prev) => {
      if (
        activeParagraphIdx >= prev.start &&
        activeParagraphIdx < prev.end
      ) {
        return prev;
      }
      const nextStart = Math.max(0, activeParagraphIdx - 25);
      const nextEnd = Math.min(
        pdfDoc.paragraphs.length,
        nextStart + ALL_MODE_WINDOW_SIZE
      );
      return { start: nextStart, end: nextEnd };
    });
  }, [activeParagraphIdx, pdfDoc.paragraphs.length, viewMode]);

  const prevPageRef = useRef(currentPage);
  const prevParaRef = useRef(activeParagraphIdx);

  // Smoothly scroll when turning pages or advancing playback
  useEffect(() => {
    const pageChanged = prevPageRef.current !== currentPage;
    const paraChanged = prevParaRef.current !== activeParagraphIdx;
    prevPageRef.current = currentPage;
    prevParaRef.current = activeParagraphIdx;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (pageChanged && viewMode === "page" && !speech.isPlaying) {
      window.scrollTo({
        top: 0,
        behavior: reduced ? "auto" : "smooth",
      });
      return;
    }

    const el = paragraphRefs.current.get(activeParagraphIdx);
    if (!el) return;
    if (speech.isPlaying || viewMode === "block") {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
    } else if (paraChanged && pageChanged && viewMode === "all") {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [activeParagraphIdx, currentPage, speech.isPlaying, viewMode]);

  const getActiveSentenceRect = useCallback(() => {
    return activeSentenceRef.current
      ? activeSentenceRef.current.getBoundingClientRect()
      : null;
  }, []);

  // Keyboard accessibility shortcuts inside reader (never hijack Space on buttons/links/inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return;
        e.preventDefault();
        speech.togglePlayPause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        speech.skipNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        speech.skipPrev();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        if (currentPage < totalPages) {
          speech.jumpToPage(currentPage + 1);
        }
      } else if (e.key === "PageUp") {
        e.preventDefault();
        if (currentPage > 1) {
          speech.jumpToPage(currentPage - 1);
        }
      } else if (e.key.toLowerCase() === "r") {
        onUpdateSettings({
          readingRulerEnabled: !settings.readingRulerEnabled,
        });
      } else if (e.key.toLowerCase() === "f") {
        onUpdateSettings({ focusMode: !settings.focusMode });
      } else if (e.key === "Escape") {
        if (activeMarkPopover) setActiveMarkPopover(null);
        else if (selectionState) setSelectionState(null);
        else if (voiceMenuOpen) setVoiceMenuOpen(false);
        else if (appearanceOpen) setAppearanceOpen(false);
        else if (navDrawerOpen) setNavDrawerOpen(false);
        else if (settings.focusMode) onUpdateSettings({ focusMode: false });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeMarkPopover,
    appearanceOpen,
    currentPage,
    navDrawerOpen,
    onUpdateSettings,
    selectionState,
    settings.focusMode,
    settings.readingRulerEnabled,
    speech,
    totalPages,
    voiceMenuOpen,
  ]);

  const highlightsByParagraph = useMemo(() => {
    const map = new Map<number, TextHighlight[]>();
    for (const hl of pdfDoc.highlights || []) {
      const list = map.get(hl.paragraphIndex) || [];
      list.push(hl);
      map.set(hl.paragraphIndex, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [pdfDoc.highlights]);

  // Precompute page paragraphs index in O(N) once per document
  const paragraphsByPage = useMemo(() => {
    const map = new Map<
      number,
      Array<{ paragraph: PdfParagraph; index: number; chapter: string }>
    >();
    let runningChapter = pdfDoc.title || "Início do documento";
    for (let i = 0; i < pdfDoc.paragraphs.length; i++) {
      const p = pdfDoc.paragraphs[i];
      if (p.chapter) runningChapter = p.chapter;
      else if (p.isHeading) runningChapter = p.text;
      const list = map.get(p.pageNumber) || [];
      list.push({ paragraph: p, index: i, chapter: runningChapter });
      map.set(p.pageNumber, list);
    }
    return map;
  }, [pdfDoc.paragraphs, pdfDoc.title]);

  const allParagraphItems = useMemo(() => {
    const items: Array<{
      paragraph: PdfParagraph;
      index: number;
      chapter: string;
    }> = [];
    let runningChapter = pdfDoc.title || "Início do documento";
    for (let i = 0; i < pdfDoc.paragraphs.length; i++) {
      const p = pdfDoc.paragraphs[i];
      if (p.chapter) runningChapter = p.chapter;
      else if (p.isHeading) runningChapter = p.text;
      items.push({ paragraph: p, index: i, chapter: runningChapter });
    }
    return items;
  }, [pdfDoc.paragraphs, pdfDoc.title]);

  const visibleParagraphs = useMemo(() => {
    if (pdfDoc.paragraphs.length === 0) return [];
    if (viewMode === "block") {
      const item = allParagraphItems[activeParagraphIdx];
      return item ? [item] : [];
    }
    if (viewMode === "page") {
      return paragraphsByPage.get(currentPage) || [];
    }
    if (allParagraphItems.length <= ALL_MODE_WINDOW_SIZE) {
      return allParagraphItems;
    }
    return allParagraphItems.slice(allModeWindow.start, allModeWindow.end);
  }, [
    activeParagraphIdx,
    allModeWindow.end,
    allModeWindow.start,
    allParagraphItems,
    currentPage,
    paragraphsByPage,
    pdfDoc.paragraphs.length,
    viewMode,
  ]);

  const touchSelectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (touchSelectionTimerRef.current !== null) {
        window.clearTimeout(touchSelectionTimerRef.current);
      }
    };
  }, []);

  const readSelectionToolbar = useCallback(
    (target: HTMLElement | null) => {
      if (target && target.closest("button, select, input, a")) {
        return;
      }

      const sel = window.getSelection();
      const raw = sel ? sel.toString() : "";
      const trimmed = raw.trim();
      if (!sel || sel.rangeCount === 0 || !trimmed || trimmed.length < 2) {
        setSelectionState(null);
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const startEl =
          range.startContainer.nodeType === Node.ELEMENT_NODE
            ? (range.startContainer as HTMLElement)
            : range.startContainer.parentElement;
        const endEl =
          range.endContainer.nodeType === Node.ELEMENT_NODE
            ? (range.endContainer as HTMLElement)
            : range.endContainer.parentElement;
        const commonEl =
          range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? (range.commonAncestorContainer as HTMLElement)
            : range.commonAncestorContainer.parentElement;

        const isInsideArticle = Boolean(
          startEl?.closest("[data-reader-prose]") ||
            endEl?.closest("[data-reader-prose]") ||
            commonEl?.closest("[data-reader-prose]")
        );
        if (!isInsideArticle) {
          setSelectionState(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelectionState(null);
          return;
        }

        let paragraphIndex: number | null = null;
        let startOffset = 0;
        let endOffset = 0;
        let pageNumber = currentPage;

        const startParaTextEl = startEl?.closest(
          "[data-paragraph-text]"
        ) as HTMLElement | null;
        const endParaTextEl = endEl?.closest(
          "[data-paragraph-text]"
        ) as HTMLElement | null;

        if (startParaTextEl && startParaTextEl === endParaTextEl) {
          const idxAttr = startParaTextEl.getAttribute("data-paragraph-text");
          const parsedIdx = idxAttr !== null ? Number(idxAttr) : NaN;
          const targetPara = Number.isFinite(parsedIdx)
            ? pdfDoc.paragraphs[parsedIdx]
            : undefined;

          if (targetPara) {
            paragraphIndex = parsedIdx;
            pageNumber = targetPara.pageNumber;
            const joinedText = targetPara.sentences.join(" ");

            const preStartRange = window.document.createRange();
            preStartRange.selectNodeContents(startParaTextEl);
            preStartRange.setEnd(range.startContainer, range.startOffset);
            const rawStart = preStartRange.toString().length;

            const preEndRange = window.document.createRange();
            preEndRange.selectNodeContents(startParaTextEl);
            preEndRange.setEnd(range.endContainer, range.endOffset);
            const rawEnd = preEndRange.toString().length;

            const clampedRawStart = Math.max(
              0,
              Math.min(joinedText.length, rawStart)
            );
            const clampedRawEnd = Math.max(
              clampedRawStart,
              Math.min(joinedText.length, rawEnd)
            );

            const rawSlice = joinedText.slice(clampedRawStart, clampedRawEnd);
            const leadingWs = rawSlice.length - rawSlice.trimStart().length;
            const trailingWs = rawSlice.length - rawSlice.trimEnd().length;

            startOffset = clampedRawStart + leadingWs;
            endOffset = Math.max(startOffset, clampedRawEnd - trailingWs);

            if (
              joinedText.slice(startOffset, endOffset).trim() !==
              trimmed.slice(0, endOffset - startOffset).trim()
            ) {
              const fallbackIdx = joinedText.indexOf(trimmed);
              if (fallbackIdx >= 0) {
                startOffset = fallbackIdx;
                endOffset = fallbackIdx + trimmed.length;
              }
            }

            if (endOffset <= startOffset) {
              paragraphIndex = null;
            }
          }
        }

        const placeBelow = rect.top < 220;
        const margin = 12;
        const halfWidth = Math.min(
          185,
          Math.max(110, window.innerWidth / 2 - margin)
        );
        const clampedX = Math.min(
          Math.max(halfWidth, rect.left + rect.width / 2),
          window.innerWidth - halfWidth
        );
        setActiveMarkPopover(null);
        setSelectionState({
          text: trimmed,
          x: clampedX,
          y: placeBelow
            ? Math.min(window.innerHeight - 150, rect.bottom + 10)
            : Math.max(76, rect.top - 10),
          placeBelow,
          paragraphIndex,
          startOffset,
          endOffset,
          pageNumber,
        });
      } catch {
        setSelectionState(null);
      }
    },
    [currentPage, pdfDoc.paragraphs]
  );

  const handleTextMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      readSelectionToolbar(e.target as HTMLElement | null);
    },
    [readSelectionToolbar]
  );

  const handleTextTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (touchSelectionTimerRef.current !== null) {
        window.clearTimeout(touchSelectionTimerRef.current);
      }
      touchSelectionTimerRef.current = window.setTimeout(() => {
        touchSelectionTimerRef.current = null;
        readSelectionToolbar(target);
      }, 160);
    },
    [readSelectionToolbar]
  );

  useEffect(() => {
    if (!selectionState && !activeMarkPopover) return;
    const handleScrollHide = () => {
      setSelectionState(null);
      setActiveMarkPopover(null);
    };
    window.addEventListener("scroll", handleScrollHide, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollHide);
  }, [activeMarkPopover, selectionState]);

  const handleParagraphJump = useCallback(
    (index: number) => {
      setActiveMarkPopover(null);
      speech.jumpToParagraph(index);
    },
    [speech]
  );

  const handleParagraphPlayFrom = useCallback(
    (index: number) => {
      setActiveMarkPopover(null);
      speech.playFrom(index, 0);
    },
    [speech]
  );

  const handleOpenMarkPopover = useCallback(
    (highlight: TextHighlight, rect: DOMRect) => {
      const placeBelow = rect.top < 190;
      setSelectionState(null);
      setActiveMarkPopover({
        highlight,
        x: Math.min(
          Math.max(140, rect.left + rect.width / 2),
          window.innerWidth - 140
        ),
        y: placeBelow
          ? Math.min(window.innerHeight - 80, rect.bottom + 10)
          : rect.top - 10,
        placeBelow,
      });
    },
    []
  );

  const progressPercentage =
    pdfDoc.paragraphs.length > 0
      ? Math.round(((activeParagraphIdx + 1) / pdfDoc.paragraphs.length) * 100)
      : 0;

  const isSingleWordSelection =
    selectionState && selectionState.text.split(/\s+/).length <= 1;

  const rulerBandHeight = Math.max(
    44,
    Math.round(settings.fontSize * settings.lineHeight * 1.45)
  );

  const activeLens = useMemo(
    () =>
      COLOR_LENS_OPTIONS.find((l) => l.id === settings.colorLensOverlay) ||
      COLOR_LENS_OPTIONS[0],
    [settings.colorLensOverlay]
  );

  const chunkGoal =
    typeof settings.readingChunkGoal === "number"
      ? settings.readingChunkGoal
      : 8;
  const stageMeta = useMemo(() => {
    if (chunkGoal <= 0 || pdfDoc.paragraphs.length < chunkGoal) return null;
    const currentStage = Math.floor(activeParagraphIdx / chunkGoal) + 1;
    const totalStages = Math.ceil(pdfDoc.paragraphs.length / chunkGoal);
    const posInStage = (activeParagraphIdx % chunkGoal) + 1;
    const isStageEnd =
      (activeParagraphIdx + 1) % chunkGoal === 0 &&
      activeParagraphIdx < pdfDoc.paragraphs.length - 1;
    return { currentStage, totalStages, posInStage, goal: chunkGoal, isStageEnd };
  }, [activeParagraphIdx, chunkGoal, pdfDoc.paragraphs.length]);

  return (
    <div className="relative flex min-h-[calc(100vh-56px)] w-full min-w-0 flex-col sm:min-h-[calc(100vh-62px)]">
      {/* Sticky control bar positioned flush below TopBar (no backdrop-blur lag) */}
      <div
        className={`sticky z-20 w-full border-b border-slate-200 bg-white shadow-[0_6px_20px_-10px_rgba(15,23,42,0.12)] ${
          settings.focusMode ? "top-0" : "top-[56px] sm:top-[62px]"
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-[1440px] flex-col gap-2.5 ${
            settings.focusMode
              ? "px-3 py-2 sm:px-4"
              : "px-3 py-2 sm:px-6 sm:py-2.5"
          }`}
        >
          {/* Tier 1: Document Orientation + Unified Audio Studio + Primary Reading Tools */}
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 w-full xl:w-auto xl:flex-1">
              <h1 className="break-words text-sm font-bold leading-snug text-slate-950">
                {settings.focusMode
                  ? `Página ${currentPage} de ${totalPages} · Cap.: ${currentChapter}`
                  : pdfDoc.title}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                {!settings.focusMode && (
                  <span className="break-words">· Cap.: {currentChapter}</span>
                )}
                {settings.blockDivisionEnabled && (
                  <span>
                    · Bloco{" "}
                    {pdfDoc.paragraphs.length > 0 ? activeParagraphIdx + 1 : 0}/
                    {pdfDoc.paragraphs.length}
                  </span>
                )}
                <span>· {progressPercentage}%</span>
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
              {/* Unified Audio Player */}
              <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-slate-50 to-sky-50/70 p-1 shadow-xs">
                <button
                  type="button"
                  onClick={speech.skipPrev}
                  disabled={
                    activeParagraphIdx <= 0 || pdfDoc.paragraphs.length === 0
                  }
                  aria-label="Bloco anterior"
                  title="Bloco anterior (Seta esquerda)"
                  className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:shadow-xs disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={speech.togglePlayPause}
                  disabled={
                    pdfDoc.paragraphs.length === 0 || speech.isLoadingAudio
                  }
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {speech.isLoadingAudio ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : speech.isPlaying && !speech.isPaused ? (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {speech.isLoadingAudio
                      ? "Gerando voz..."
                      : speech.isPlaying && !speech.isPaused
                      ? "Pausar"
                      : speech.isPaused
                      ? "Continuar"
                      : "Ouvir leitura"}
                  </span>
                </button>

                {(speech.isPlaying || speech.isLoadingAudio) && (
                  <button
                    type="button"
                    onClick={speech.stopAll}
                    aria-label="Parar leitura"
                    title="Parar leitura"
                    className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={speech.skipNext}
                  disabled={
                    activeParagraphIdx >= pdfDoc.paragraphs.length - 1 ||
                    pdfDoc.paragraphs.length === 0
                  }
                  aria-label="Próximo bloco"
                  title="Próximo bloco (Seta direita)"
                  className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:shadow-xs disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <span
                  aria-hidden="true"
                  className="hidden sm:block mx-0.5 h-5 w-px bg-slate-200"
                />

                <button
                  type="button"
                  onClick={() => {
                    setAppearanceOpen(false);
                    setVoiceMenuOpen((prev) => {
                      const next = !prev;
                      if (next) speech.refreshVoices?.();
                      return next;
                    });
                  }}
                  aria-expanded={voiceMenuOpen}
                  className={`inline-flex min-h-[38px] max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    isAutoSwitched
                      ? "bg-amber-100 text-amber-950"
                      : voiceMenuOpen || settings.ttsEngine === "gemini"
                      ? "bg-white text-teal-900 shadow-xs"
                      : "text-slate-800 hover:bg-white"
                  }`}
                >
                  <Volume2
                    className="h-3.5 w-3.5 shrink-0 text-teal-700"
                    aria-hidden="true"
                  />
                  <span className="max-w-[120px] sm:max-w-[160px] truncate">
                    {activeVoiceLabel}
                  </span>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVoiceMenuOpen(false);
                  setAppearanceOpen((prev) => !prev);
                }}
                aria-expanded={appearanceOpen}
                title="Alterar fonte, cores, blocos e espaçamento sem sair da página"
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  appearanceOpen
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>Ajustes</span>
              </button>

              {!settings.focusMode && (
                <button
                  type="button"
                  onClick={onToggleAssistant}
                  aria-expanded={assistantOpen}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                    assistantOpen
                      ? "border-indigo-700 bg-indigo-600 text-white shadow-sm shadow-indigo-700/25"
                      : "border-indigo-200 bg-indigo-50/70 text-indigo-950 hover:border-indigo-300 hover:bg-indigo-100/80"
                  }`}
                >
                  <MessageSquareText
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Leitura Assistida</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ focusMode: !settings.focusMode })
                }
                aria-pressed={settings.focusMode}
                title="Modo foco sem distrações (Tecla F)"
                className={`hidden md:inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.focusMode
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Focus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{settings.focusMode ? "Sair do Foco" : "Modo Foco"}</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMoreOpen((prev) => !prev)}
                aria-expanded={mobileMoreOpen}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 md:hidden whitespace-nowrap"
              >
                <span>{mobileMoreOpen ? "Menos" : "Controles"}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    mobileMoreOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* Tier 2: Organized Navigation, Bookmarks, View Mode & Speed */}
          <div
            className={`${
              mobileMoreOpen ? "flex" : "hidden md:flex"
            } w-full min-w-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 pt-2`}
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setNavDrawerTab("pages");
                  setNavDrawerOpen(true);
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <BookOpen
                  className="h-3.5 w-3.5 text-teal-700 shrink-0"
                  aria-hidden="true"
                />
                <span>Sumário</span>
              </button>

              <div className="inline-flex max-w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    speech.jumpToPage(Math.max(1, currentPage - 1))
                  }
                  disabled={currentPage <= 1 || pdfDoc.paragraphs.length === 0}
                  aria-label="Página anterior"
                  title="Página anterior (Page Up)"
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-800 hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden lg:inline">Anterior</span>
                </button>

                <select
                  aria-label="Selecionar página do documento"
                  value={currentPage}
                  onChange={(e) => speech.jumpToPage(Number(e.target.value))}
                  disabled={pdfDoc.paragraphs.length === 0}
                  className="min-h-[34px] min-w-0 max-w-[138px] sm:max-w-none bg-transparent px-1.5 sm:px-2 text-xs font-semibold text-slate-950 tabular-nums focus:outline-none"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <option key={pageNum} value={pageNum}>
                        Pág. {pageNum} de {totalPages}
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    speech.jumpToPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={
                    currentPage >= totalPages || pdfDoc.paragraphs.length === 0
                  }
                  aria-label="Próxima página"
                  title="Próxima página (Page Down)"
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-800 hover:bg-white disabled:opacity-40"
                >
                  <span className="hidden lg:inline">Próxima</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onToggleBookmark(activeParagraphIdx)}
                disabled={pdfDoc.paragraphs.length === 0}
                aria-pressed={
                  pdfDoc.bookmark?.paragraphIndex === activeParagraphIdx
                }
                title={
                  pdfDoc.bookmark?.paragraphIndex === activeParagraphIdx
                    ? "Remover marcação de onde parei neste bloco"
                    : "Salvar o bloco atual como onde parei a leitura"
                }
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
                  pdfDoc.bookmark?.paragraphIndex === activeParagraphIdx
                    ? "border-amber-500 bg-amber-50 text-amber-950"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {pdfDoc.bookmark?.paragraphIndex === activeParagraphIdx ? (
                  <BookmarkCheck
                    className="h-3.5 w-3.5 text-amber-700 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Bookmark
                    className="h-3.5 w-3.5 text-teal-700 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {pdfDoc.bookmark?.paragraphIndex === activeParagraphIdx
                    ? "Parei aqui"
                    : "Marcar onde parei"}
                </span>
              </button>

              {pdfDoc.bookmark &&
                pdfDoc.bookmark.paragraphIndex !== activeParagraphIdx && (
                  <button
                    type="button"
                    onClick={() =>
                      speech.jumpToParagraph(pdfDoc.bookmark!.paragraphIndex)
                    }
                    title={`Voltar para onde você parou (Página ${pdfDoc.bookmark.pageNumber}, Bloco ${pdfDoc.bookmark.paragraphIndex + 1})`}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap tabular-nums"
                  >
                    <CornerDownRight
                      className="h-3.5 w-3.5 text-amber-700 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Ir onde parei (Pág. {pdfDoc.bookmark.pageNumber})</span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  setNavDrawerTab("marks");
                  setNavDrawerOpen(true);
                }}
                title="Abrir lista de trechos marcados e ponto de parada"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap tabular-nums"
              >
                <Highlighter
                  className="h-3.5 w-3.5 text-teal-700 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Marcações
                  {(pdfDoc.highlights?.length || 0) > 0
                    ? ` (${pdfDoc.highlights!.length})`
                    : ""}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div
                role="group"
                aria-label="Modo de visualização"
                className="inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-0.5"
              >
                {(
                  [
                    { id: "page", label: "Por página", icon: FileText },
                    { id: "block", label: "Por bloco", icon: Layers },
                    { id: "all", label: "Tudo", icon: AlignJustify },
                  ] as Array<{
                    id: ReaderViewMode;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                  }>
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = viewMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          viewMode: opt.id,
                          guidedBlockMode: opt.id === "block",
                          ...(opt.id === "block"
                            ? { blockDivisionEnabled: true }
                            : {}),
                        })
                      }
                      aria-pressed={active}
                      className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !settings.blockDivisionEnabled;
                  if (!next && viewMode === "block") {
                    onUpdateSettings({
                      blockDivisionEnabled: false,
                      viewMode: "page",
                      guidedBlockMode: false,
                    });
                  } else {
                    onUpdateSettings({ blockDivisionEnabled: next });
                  }
                }}
                aria-pressed={settings.blockDivisionEnabled}
                title="Ativar ou desativar a divisão visual do texto em blocos"
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.blockDivisionEnabled
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {settings.blockDivisionEnabled ? "Blocos: Sim" : "Blocos: Não"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <label className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                <span>Vel.</span>
                <select
                  aria-label="Velocidade da narração"
                  value={settings.ttsRate}
                  onChange={(e) =>
                    onUpdateSettings({ ttsRate: Number(e.target.value) })
                  }
                  className="bg-transparent font-semibold text-slate-900 tabular-nums focus:outline-none"
                >
                  {[0.6, 0.75, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0].map((v) => (
                    <option key={v} value={v}>
                      {v.toFixed(2).replace(/\.00$/, ".0")}x
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                <span>Ritmo</span>
                <select
                  aria-label="Ritmo da leitura"
                  value={settings.readingTone}
                  onChange={(e) => onSelectTone(e.target.value as ReadingTone)}
                  className="bg-transparent font-semibold text-slate-900 focus:outline-none"
                >
                  {READING_TONE_OPTIONS.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    readingRulerEnabled: !settings.readingRulerEnabled,
                  })
                }
                aria-pressed={settings.readingRulerEnabled}
                title="Régua de leitura (Tecla R)"
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.readingRulerEnabled
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Régua</span>
              </button>

              {!settings.focusMode && (
                <div className="hidden xl:inline-flex items-center rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    aria-label="Diminuir fonte"
                    onClick={() =>
                      onUpdateSettings({
                        fontSize: Math.max(14, settings.fontSize - 1),
                      })
                    }
                    className="inline-flex min-h-[34px] min-w-[32px] items-center justify-center text-slate-700 hover:bg-slate-50"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="px-1.5 text-xs font-semibold text-slate-800 tabular-nums">
                    {settings.fontSize}px
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar fonte"
                    onClick={() =>
                      onUpdateSettings({
                        fontSize: Math.min(32, settings.fontSize + 1),
                      })
                    }
                    className="inline-flex min-h-[34px] min-w-[32px] items-center justify-center text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ focusMode: !settings.focusMode })
                }
                aria-pressed={settings.focusMode}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold md:hidden ${
                  settings.focusMode
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                <Focus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{settings.focusMode ? "Sair Foco" : "Foco"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vibrant reading progress track */}
        <div aria-hidden="true" className="h-[3px] w-full bg-slate-100">
          <div
            style={{ width: `${progressPercentage}%` }}
            className="h-full bg-gradient-to-r from-teal-600 via-emerald-500 to-sky-500 transition-all duration-200"
          />
        </div>
      </div>

      {/* Main Reading Canvas (no GPU filter layer when contrast === 100) */}
      <div
        onMouseUp={handleTextMouseUp}
        onTouchEnd={handleTextTouchEnd}
        style={{
          backgroundColor: theme.bg,
          color: theme.text,
          ...(settings.contrastLevel !== 100
            ? { filter: `contrast(${settings.contrastLevel}%)` }
            : {}),
        }}
        className="relative flex-1 transition-colors duration-200"
      >
        {activeLens.id !== "none" && (
          <div
            aria-hidden="true"
            style={{ backgroundColor: activeLens.overlayRgba }}
            className="pointer-events-none absolute inset-0 z-10"
          />
        )}

        <ReadingRulerOverlay
          enabled={settings.readingRulerEnabled}
          isDark={theme.isDark}
          bandHeight={rulerBandHeight}
          isPlaying={speech.isPlaying}
          getActiveSentenceRect={getActiveSentenceRect}
          speechSyncKey={`${speech.position.paragraphIndex}:${speech.position.sentenceIndex}:${speech.position.wordIndex}`}
        />

        {/* Scanned PDF / OCR Prompt Banner */}
        {!settings.focusMode &&
          (pdfDoc.scannedPages.length > 0 || pdfDoc.paragraphs.length === 0) &&
          !pdfDoc.ocrApplied && (
            <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-slate-900">
                <div className="flex items-start gap-3">
                  <ScanText
                    className="mt-0.5 h-5 w-5 text-amber-800 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-slate-950">
                      {pdfDoc.paragraphs.length === 0
                        ? "PDF digitalizado detectado"
                        : `Páginas digitalizadas detectadas (${pdfDoc.scannedPages.join(", ")})`}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">
                      Este documento contém imagens em vez de texto selecionável.
                      Escolha como deseja extrair o texto para leitura acessível e
                      narração em voz alta:
                    </p>

                    {ocrProgress?.active ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 tabular-nums">
                          <span>{ocrProgress.statusText}</span>
                          <span>{ocrProgress.pageProgress}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200">
                          <div
                            style={{ width: `${ocrProgress.pageProgress}%` }}
                            className="h-full bg-teal-700 transition-all duration-200"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={onRunLocalOcr}
                          className="min-h-[44px] rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
                        >
                          Reconhecer com OCR Local (Privado)
                        </button>
                        <button
                          type="button"
                          onClick={onRunAiOcr}
                          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                        >
                          Reconhecer com IA (Envio externo)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {speech.ttsError && (
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              {speech.ttsError}
            </div>
          </div>
        )}

        {(speech.voiceSwitchInfo || speech.ttsNotice) && (
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <div
              role="status"
              className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-amber-950">
                    {speech.voiceSwitchInfo
                      ? "Troca automática de voz ativada"
                      : "Aviso de narração"}
                  </p>
                  {speech.voiceSwitchInfo ? (
                    <>
                      <p>
                        A leitura mudou de{" "}
                        <strong>{speech.voiceSwitchInfo.fromLabel}</strong> para{" "}
                        <strong>{speech.voiceSwitchInfo.toLabel}</strong>.
                      </p>
                      <p className="text-xs leading-relaxed text-amber-900">
                        {speech.voiceSwitchInfo.reason}
                      </p>
                    </>
                  ) : (
                    <p>{speech.ttsNotice}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceMenuOpen(true)}
                    className="min-h-[38px] rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    Escolher outra voz
                  </button>
                  {speech.voiceSwitchInfo && (
                    <>
                      <button
                        type="button"
                        onClick={onRetryAiVoice}
                        className="min-h-[38px] rounded-lg border border-teal-700 bg-white px-3 text-xs font-semibold text-teal-900 hover:bg-teal-50"
                      >
                        Tentar Voz IA novamente
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ ttsEngine: "browser" });
                          speech.setVoiceSwitchInfo(null);
                          speech.setTtsNotice(null);
                        }}
                        className="min-h-[38px] rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-950"
                      >
                        Fixar voz local
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      speech.setTtsNotice(null);
                      speech.setVoiceSwitchInfo(null);
                    }}
                    className="min-h-[38px] px-2 text-xs font-semibold text-amber-900 hover:underline"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Prose Container */}
        <article
          data-reader-prose="true"
          style={{
            maxWidth: COLUMN_WIDTH_MAP[settings.columnWidth],
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}em`,
            wordSpacing: `${settings.wordSpacing}em`,
          }}
          className={`mx-auto w-full min-w-0 px-4 py-7 sm:px-8 sm:py-10 lg:py-12 [overflow-wrap:anywhere] break-words ${fontClass}`}
        >
          {pdfDoc.paragraphs.length === 0 ? (
            <div
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
              }}
              className="rounded-xl border p-8 text-center"
            >
              <p className="text-base font-semibold">
                Nenhum texto selecionável encontrado ainda neste PDF.
              </p>
              <p style={{ color: theme.muted }} className="mt-2 text-sm">
                Use o botão de reconhecimento OCR acima para extrair o conteúdo das
                páginas digitalizadas.
              </p>
            </div>
          ) : (
            <div
              className={
                settings.blockDivisionEnabled ? "space-y-6" : "space-y-4"
              }
            >
              {stageMeta && !settings.focusMode && (
                <div
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.muted,
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 font-sans text-xs tabular-nums"
                >
                  <span>
                    <strong style={{ color: theme.text }}>
                      Etapa {stageMeta.currentStage} de {stageMeta.totalStages}
                    </strong>{" "}
                    · Bloco {stageMeta.posInStage} de {stageMeta.goal} antes da
                    pausa
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Array.from(
                      { length: stageMeta.goal },
                      (_, stepIdx) => stepIdx < stageMeta.posInStage
                    ).map((done, stepIdx) => (
                      <span
                        key={stepIdx}
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full transition-colors ${
                          done ? "bg-teal-600" : "bg-slate-300/70"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {stageMeta &&
                stageMeta.isStageEnd &&
                pausedStageAck !== stageMeta.currentStage && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-sans text-slate-900 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <Coffee
                          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                          aria-hidden="true"
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-emerald-950">
                            Etapa {stageMeta.currentStage} concluída — hora de uma pausa rápida
                          </p>
                          <p className="text-xs leading-relaxed text-emerald-900">
                            Dividir a leitura em partes menores reduz a fadiga visual. Beba água, levante-se por 1 minuto ou descanse os olhos antes da próxima etapa.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPausedStageAck(stageMeta.currentStage);
                            speech.jumpToParagraph(
                              Math.min(
                                pdfDoc.paragraphs.length - 1,
                                activeParagraphIdx + 1
                              )
                            );
                          }}
                          className="min-h-[36px] rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                        >
                          Próxima etapa
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPausedStageAck(stageMeta.currentStage)
                          }
                          className="min-h-[36px] rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-950 hover:bg-emerald-100 whitespace-nowrap"
                        >
                          Pausar depois
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({ readingChunkGoal: 0 })
                          }
                          className="min-h-[36px] px-2 text-xs font-semibold text-emerald-900 hover:underline whitespace-nowrap"
                        >
                          Desativar metas
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {viewMode === "all" && allModeWindow.start > 0 && (
                <div className="flex justify-center pb-2 font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setAllModeWindow((prev) => ({
                        ...prev,
                        start: Math.max(0, prev.start - 50),
                      }))
                    }
                    className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50"
                  >
                    Carregar blocos anteriores ({allModeWindow.start} ocultos)
                  </button>
                </div>
              )}

              {visibleParagraphs.map(({ paragraph, index, chapter }, visIdx) => {
                const isActiveBlock = index === activeParagraphIdx;
                const isBookmarkedBlock =
                  pdfDoc.bookmark?.paragraphIndex === index;
                const showPageDivider =
                  viewMode !== "block" &&
                  (visIdx === 0 ||
                    visibleParagraphs[visIdx - 1]?.paragraph.pageNumber !==
                      paragraph.pageNumber);

                return (
                  <ParagraphBlock
                    key={paragraph.id}
                    paragraph={paragraph}
                    index={index}
                    blockChapter={chapter}
                    showPageDivider={showPageDivider}
                    blockDivisionEnabled={settings.blockDivisionEnabled}
                    isActiveBlock={isActiveBlock}
                    isBookmarkedBlock={isBookmarkedBlock}
                    isPlaying={isActiveBlock ? speech.isPlaying : false}
                    isPaused={isActiveBlock ? speech.isPaused : false}
                    activeSentenceIndex={
                      isActiveBlock ? speech.position.sentenceIndex : -1
                    }
                    activeWordIndex={
                      isActiveBlock ? speech.position.wordIndex : -1
                    }
                    fontSize={settings.fontSize}
                    highlightStyle={settings.highlightStyle}
                    theme={theme}
                    highlights={highlightsByParagraph.get(index)}
                    activeSentenceRef={activeSentenceRef}
                    registerParagraphRef={registerParagraphRef}
                    onJumpToParagraph={handleParagraphJump}
                    onPlayFrom={handleParagraphPlayFrom}
                    onToggleBookmark={onToggleBookmark}
                    onAskAi={onAskAiFromSelection}
                    onOpenMarkPopover={handleOpenMarkPopover}
                  />
                );
              })}

              {viewMode === "all" &&
                allModeWindow.end < allParagraphItems.length && (
                  <div className="flex justify-center pt-4 font-sans">
                    <button
                      type="button"
                      onClick={() =>
                        setAllModeWindow((prev) => ({
                          ...prev,
                          end: Math.min(allParagraphItems.length, prev.end + 60),
                        }))
                      }
                      className="min-h-[42px] rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:from-teal-700 hover:to-emerald-700"
                    >
                      Carregar próximos blocos (restam{" "}
                      {allParagraphItems.length - allModeWindow.end})
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* Page-by-page navigation footer */}
          {viewMode === "page" && pdfDoc.paragraphs.length > 0 && (
            <div
              style={{ borderColor: theme.border }}
              className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6 font-sans"
            >
              <button
                type="button"
                onClick={() => speech.jumpToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span>Página anterior</span>
              </button>

              <span
                style={{ color: theme.muted }}
                className="text-sm font-semibold tabular-nums"
              >
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  speech.jumpToPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage >= totalPages}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-40"
              >
                <span>Próxima página</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Block-by-block guided navigation footer */}
          {viewMode === "block" && pdfDoc.paragraphs.length > 0 && (
            <div
              style={{ borderColor: theme.border }}
              className="mt-8 flex items-center justify-between gap-4 border-t pt-6 font-sans"
            >
              <button
                type="button"
                onClick={speech.skipPrev}
                disabled={activeParagraphIdx <= 0}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span>Bloco anterior</span>
              </button>

              <span
                style={{ color: theme.muted }}
                className="text-sm font-medium tabular-nums"
              >
                {activeParagraphIdx + 1} / {pdfDoc.paragraphs.length}
              </span>

              <button
                type="button"
                onClick={speech.skipNext}
                disabled={activeParagraphIdx >= pdfDoc.paragraphs.length - 1}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-40"
              >
                <span>Próximo bloco</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {!settings.focusMode && pdfDoc.paragraphs.length > 0 && (
            <footer
              style={{ borderColor: theme.border, color: theme.muted }}
              className="mt-14 border-t pt-6 font-sans text-xs"
            >
              Atalhos de teclado: Espaço para reproduzir ou pausar · Setas esquerda e
              direita para navegar entre blocos · Page Up / Page Down para mudar de
              página · R para régua de leitura · F para modo foco.
            </footer>
          )}
        </article>
      </div>

      <PageNavigatorDrawer
        open={navDrawerOpen}
        initialTab={navDrawerTab}
        onClose={() => setNavDrawerOpen(false)}
        document={pdfDoc}
        currentPage={currentPage}
        activeParagraphIndex={activeParagraphIdx}
        onSelectPage={speech.jumpToPage}
        onSelectParagraph={speech.jumpToParagraph}
        onSetBookmarkAtCurrent={() => onSetBookmark(activeParagraphIdx)}
        onClearBookmark={onClearBookmark}
        onUpdateHighlightColor={onUpdateHighlightColor}
        onRemoveHighlight={onRemoveHighlight}
        onDeleteStudyNote={onDeleteStudyNote}
      />

      <VoicePickerPopover
        open={voiceMenuOpen}
        onClose={() => setVoiceMenuOpen(false)}
        settings={settings}
        availableBrowserVoices={speech.availableVoices}
        onRefreshBrowserVoices={speech.refreshVoices}
        previewingVoiceId={speech.previewingVoiceId}
        isPreviewLoading={speech.isPreviewLoading}
        ttsError={speech.ttsError}
        ttsNotice={speech.ttsNotice}
        voiceSwitchInfo={speech.voiceSwitchInfo}
        onDismissNotice={() => {
          speech.setTtsNotice(null);
          speech.setVoiceSwitchInfo(null);
        }}
        onRetryAiVoice={onRetryAiVoice}
        activeParagraphSnippet={currentParagraph?.text}
        onSelectNaturalVoice={(voiceId) => {
          onSelectNaturalVoice(voiceId);
          setVoiceMenuOpen(false);
        }}
        onSelectBrowserVoice={(uri) => {
          onSelectBrowserVoice(uri);
          setVoiceMenuOpen(false);
        }}
        onSelectBrowserVoiceProfile={(profileId) => {
          speech.stopAll();
          onUpdateSettings({
            ttsEngine: "browser",
            browserVoiceProfile: profileId,
          });
        }}
        onChangeBrowserVoicePitch={(pitch) =>
          onUpdateSettings({
            ttsEngine: "browser",
            browserVoicePitch: pitch,
          })
        }
        onSelectTone={onSelectTone}
        onPreviewVoice={onPreviewVoice}
        onStopPreview={speech.stopPreview}
      />

      <QuickAppearancePopover
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={onResetSettings}
      />

      {/* Floating Selection Toolbar: Multi-color Highlighting + AI Comprehension */}
      {selectionState && (
        <div
          style={{
            left: `${selectionState.x}px`,
            top: `${selectionState.y}px`,
            transform: selectionState.placeBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
          className="fixed z-40 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-xl border border-slate-300 bg-white p-2.5 shadow-xl"
        >
          {selectionState.paragraphIndex !== null && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                <Highlighter
                  className="h-3.5 w-3.5 text-teal-700"
                  aria-hidden="true"
                />
                <span>Marcar trecho:</span>
              </span>
              <div className="flex items-center gap-1.5">
                {HIGHLIGHT_COLOR_OPTIONS.map((colorOpt) => (
                  <button
                    key={colorOpt.id}
                    type="button"
                    onClick={() => {
                      if (selectionState.paragraphIndex === null) return;
                      onAddHighlight({
                        paragraphIndex: selectionState.paragraphIndex,
                        pageNumber: selectionState.pageNumber,
                        text: selectionState.text,
                        startOffset: selectionState.startOffset,
                        endOffset: selectionState.endOffset,
                        color: colorOpt.id,
                      });
                      window.getSelection()?.removeAllRanges();
                      setSelectionState(null);
                    }}
                    aria-label={`Marcar trecho em ${colorOpt.label}: ${colorOpt.meaning}`}
                    title={`${colorOpt.label} — ${colorOpt.meaning}`}
                    style={{ backgroundColor: colorOpt.swatchHex }}
                    className="h-7 w-7 rounded-full border border-slate-400/70 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                ))}
              </div>
              <p className="w-full text-[10px] leading-tight text-slate-500">
                Amarelo: Essencial · Verde: Entendi · Azul: Exemplo · Rosa: Dúvida (?) · Roxo: Conceito
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {isSingleWordSelection ? (
              <button
                type="button"
                onClick={() => {
                  const txt = selectionState.text;
                  setSelectionState(null);
                  onAskAiFromSelection("explain_word", txt);
                }}
                className="min-h-[36px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
              >
                Explicar palavra
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const txt = selectionState.text;
                    window.getSelection()?.removeAllRanges();
                    setSelectionState(null);
                    onAskAiFromSelection("study_notes", txt);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 whitespace-nowrap"
                >
                  <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Resumo p/ anotação</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = selectionState.text;
                    window.getSelection()?.removeAllRanges();
                    setSelectionState(null);
                    onAskAiFromSelection("visual_diagram", txt);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 whitespace-nowrap"
                >
                  <Network className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Esquema visual</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = selectionState.text;
                    window.getSelection()?.removeAllRanges();
                    setSelectionState(null);
                    onAskAiFromSelection("explain_excerpt", txt);
                  }}
                  className="min-h-[36px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
                >
                  O que isso significa?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = selectionState.text;
                    window.getSelection()?.removeAllRanges();
                    setSelectionState(null);
                    onAskAiFromSelection("simplify", txt);
                  }}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  Simplificar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectionState(null)}
              aria-label="Fechar barra de seleção"
              className="min-h-[36px] rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Floating Popover to recolor or remove an existing highlight */}
      {activeMarkPopover && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setActiveMarkPopover(null)}
            className="fixed inset-0 z-30"
          />
          <div
            style={{
              left: `${activeMarkPopover.x}px`,
              top: `${activeMarkPopover.y}px`,
              transform: activeMarkPopover.placeBelow
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            }}
            className="fixed z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-xl"
          >
            <span className="text-[11px] font-semibold text-slate-700">
              Cor:
            </span>
            <div className="flex items-center gap-1.5">
              {HIGHLIGHT_COLOR_OPTIONS.map((colorOpt) => {
                const isSelected =
                  activeMarkPopover.highlight.color === colorOpt.id;
                return (
                  <button
                    key={colorOpt.id}
                    type="button"
                    onClick={() => {
                      onUpdateHighlightColor(
                        activeMarkPopover.highlight.id,
                        colorOpt.id
                      );
                      setActiveMarkPopover((prev) =>
                        prev
                          ? {
                              ...prev,
                              highlight: {
                                ...prev.highlight,
                                color: colorOpt.id,
                              },
                            }
                          : null
                      );
                    }}
                    aria-label={`Mudar marcação para ${colorOpt.label}: ${colorOpt.meaning}`}
                    aria-pressed={isSelected}
                    title={`${colorOpt.label} — ${colorOpt.meaning}`}
                    style={{ backgroundColor: colorOpt.swatchHex }}
                    className={`h-7 w-7 rounded-full border transition-transform ${
                      isSelected
                        ? "scale-110 border-slate-950 ring-2 ring-slate-900/20"
                        : "border-slate-400/70 hover:scale-105"
                    }`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onRemoveHighlight(activeMarkPopover.highlight.id);
                setActiveMarkPopover(null);
              }}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remover</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
