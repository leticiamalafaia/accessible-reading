import React from "react";
import { Bookmark, BookmarkCheck, HelpCircle, Volume2 } from "lucide-react";
import {
  ComprehensionAction,
  HighlightColor,
  HighlightStyle,
  PdfParagraph,
  TextHighlight,
} from "../types/reader";
import {
  getHighlightColorDef,
  ThemePaletteDefinition,
} from "../lib/settingsStorage";

interface ParagraphBlockProps {
  paragraph: PdfParagraph;
  index: number;
  blockChapter: string;
  showPageDivider: boolean;
  blockDivisionEnabled: boolean;
  isActiveBlock: boolean;
  isBookmarkedBlock: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  activeSentenceIndex: number;
  activeWordIndex: number;
  fontSize: number;
  highlightStyle: HighlightStyle;
  theme: ThemePaletteDefinition;
  highlights: TextHighlight[] | undefined;
  activeSentenceRef: React.RefObject<HTMLSpanElement | null>;
  registerParagraphRef: (index: number, el: HTMLElement | null) => void;
  onJumpToParagraph: (index: number) => void;
  onPlayFrom: (index: number) => void;
  onToggleBookmark: (index: number) => void;
  onAskAi: (action: ComprehensionAction, selectedText: string) => void;
  onOpenMarkPopover: (
    highlight: TextHighlight,
    rect: DOMRect
  ) => void;
}

const EMPTY_HIGHLIGHTS: TextHighlight[] = [];

const ParagraphBlockInner: React.FC<ParagraphBlockProps> = ({
  paragraph,
  index,
  blockChapter,
  showPageDivider,
  blockDivisionEnabled,
  isActiveBlock,
  isBookmarkedBlock,
  isPlaying,
  isPaused,
  activeSentenceIndex,
  activeWordIndex,
  fontSize,
  highlightStyle,
  theme,
  highlights = EMPTY_HIGHLIGHTS,
  activeSentenceRef,
  registerParagraphRef,
  onJumpToParagraph,
  onPlayFrom,
  onToggleBookmark,
  onAskAi,
  onOpenMarkPopover,
}) => {
  const isSpokenHighlight = isActiveBlock && (isPlaying || isPaused);

  const renderTokenWithHighlights = (
    tokenText: string,
    tokenStart: number,
    localHighlights: Array<{
      highlight: TextHighlight;
      start: number;
      end: number;
    }>,
    wordStyle: React.CSSProperties | null,
    keyPrefix: string
  ) => {
    const tokenEnd = tokenStart + tokenText.length;
    const intersecting = localHighlights.filter(
      (h) => h.end > tokenStart && h.start < tokenEnd
    );

    if (intersecting.length === 0) {
      if (wordStyle) {
        return (
          <span key={keyPrefix} style={wordStyle}>
            {tokenText}
          </span>
        );
      }
      return <React.Fragment key={keyPrefix}>{tokenText}</React.Fragment>;
    }

    const boundariesSet = new Set<number>([tokenStart, tokenEnd]);
    for (const h of intersecting) {
      boundariesSet.add(Math.max(tokenStart, h.start));
      boundariesSet.add(Math.min(tokenEnd, h.end));
    }
    const boundaries = Array.from(boundariesSet).sort((a, b) => a - b);

    return (
      <React.Fragment key={keyPrefix}>
        {boundaries.slice(0, -1).map((sliceStart, idx) => {
          const sliceEnd = boundaries[idx + 1];
          if (sliceEnd <= sliceStart) return null;
          const sliceText = tokenText.slice(
            sliceStart - tokenStart,
            sliceEnd - tokenStart
          );
          const matching = intersecting.filter(
            (h) => h.start <= sliceStart && h.end >= sliceEnd
          );
          const activeHl =
            matching.length > 0
              ? matching[matching.length - 1].highlight
              : null;

          if (!activeHl) {
            return wordStyle ? (
              <span key={`${keyPrefix}-${idx}`} style={wordStyle}>
                {sliceText}
              </span>
            ) : (
              <React.Fragment key={`${keyPrefix}-${idx}`}>
                {sliceText}
              </React.Fragment>
            );
          }

          const colorDef = getHighlightColorDef(activeHl.color as HighlightColor);
          const markBg = theme.isDark ? colorDef.darkBg : colorDef.lightBg;
          const markText = theme.isDark
            ? colorDef.darkText
            : colorDef.lightText;
          const markBorder = theme.isDark
            ? colorDef.darkBorder
            : colorDef.lightBorder;

          const combinedStyle: React.CSSProperties = {
            backgroundColor: markBg,
            color: markText,
            borderBottom: `2px solid ${markBorder}`,
            borderRadius: "3px",
            padding: "0 2px",
            cursor: "pointer",
            ...(wordStyle
              ? {
                  fontWeight: 700,
                  outline: `2px solid ${
                    theme.isDark ? "#38BDF8" : "#0F766E"
                  }`,
                }
              : {}),
          };

          return (
            <mark
              key={`${keyPrefix}-${idx}`}
              style={combinedStyle}
              title={`Trecho marcado em ${colorDef.label} (clique para alterar ou remover)`}
              onClick={(e) => {
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length > 0) return;
                e.stopPropagation();
                onOpenMarkPopover(
                  activeHl,
                  (e.currentTarget as HTMLElement).getBoundingClientRect()
                );
              }}
            >
              {sliceText}
            </mark>
          );
        })}
      </React.Fragment>
    );
  };

  const renderHighlightedSentence = (
    sentence: string,
    sIndex: number,
    sentenceStartOffset: number
  ) => {
    const isActiveSentence =
      isSpokenHighlight && activeSentenceIndex === sIndex;

    const sentenceEndOffset = sentenceStartOffset + sentence.length;
    const localHighlights =
      highlights.length > 0
        ? highlights
            .filter(
              (h) =>
                h.endOffset > sentenceStartOffset &&
                h.startOffset < sentenceEndOffset
            )
            .map((h) => ({
              highlight: h,
              start: Math.max(0, h.startOffset - sentenceStartOffset),
              end: Math.min(
                sentence.length,
                h.endOffset - sentenceStartOffset
              ),
            }))
        : [];

    if (!isActiveSentence && localHighlights.length === 0) {
      return <span>{sentence} </span>;
    }

    const words = sentence.split(/(\s+)/);
    let wordCounter = -1;
    let charCursor = 0;

    const sentenceBg =
      isActiveSentence && highlightStyle === "soft-block"
        ? theme.highlightSentenceBg
        : "transparent";

    return (
      <span
        ref={isActiveSentence ? activeSentenceRef : undefined}
        style={{
          backgroundColor: sentenceBg,
          borderRadius: "4px",
          padding:
            isActiveSentence && highlightStyle === "soft-block"
              ? "2px 4px"
              : "0",
          outline:
            isActiveSentence && highlightStyle === "focus-outline"
              ? `2px solid ${theme.highlightWordBg}`
              : "none",
        }}
      >
        {words.map((token, idx) => {
          const tokenStart = charCursor;
          charCursor += token.length;

          if (/^\s+$/.test(token)) {
            return renderTokenWithHighlights(
              token,
              tokenStart,
              localHighlights,
              null,
              `ws-${idx}`
            );
          }

          wordCounter += 1;
          const isCurrentWord =
            isActiveSentence && wordCounter === activeWordIndex;

          const wordStyle: React.CSSProperties | null = isCurrentWord
            ? highlightStyle === "underline"
              ? {
                  textDecoration: "underline",
                  textDecorationThickness: "3px",
                  textUnderlineOffset: "4px",
                  textDecorationColor: "#0F766E",
                  fontWeight: 700,
                }
              : highlightStyle === "bold-only"
              ? { fontWeight: 700 }
              : {
                  backgroundColor: theme.highlightWordBg,
                  color: theme.highlightWordText,
                  borderRadius: "4px",
                  padding: "1px 3px",
                  fontWeight: 700,
                }
            : null;

          return renderTokenWithHighlights(
            token,
            tokenStart,
            localHighlights,
            wordStyle,
            `tok-${idx}`
          );
        })}{" "}
      </span>
    );
  };

  let offsetCursor = 0;
  const renderedSentences = paragraph.sentences.map((s, sIdx) => {
    const start = offsetCursor;
    offsetCursor += s.length + 1;
    return (
      <React.Fragment key={sIdx}>
        {renderHighlightedSentence(s, sIdx, start)}
      </React.Fragment>
    );
  });

  const handleParagraphClick = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    onJumpToParagraph(index);
  };

  return (
    <React.Fragment>
      {showPageDivider && (
        <div
          style={{
            borderColor: theme.border,
            color: theme.muted,
          }}
          className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 pt-4 text-xs font-sans font-medium tabular-nums"
        >
          <span className="break-words">
            Página {paragraph.pageNumber} · Capítulo: {blockChapter}
          </span>
          {paragraph.source !== "text" && (
            <span>
              {paragraph.source === "ocr-local"
                ? "Texto reconhecido via OCR local"
                : "Texto reconhecido via OCR com IA"}
            </span>
          )}
        </div>
      )}

      {blockDivisionEnabled ? (
        <section
          data-paragraph-index={index}
          ref={(el) => registerParagraphRef(index, el)}
          style={{
            backgroundColor:
              isActiveBlock || isBookmarkedBlock
                ? theme.surface
                : "transparent",
            borderColor: isActiveBlock
              ? theme.isDark
                ? "#38BDF8"
                : "#0F766E"
              : isBookmarkedBlock
              ? theme.isDark
                ? "#FBBF24"
                : "#D97706"
              : "transparent",
          }}
          className={`group relative scroll-mt-48 rounded-xl border p-3.5 transition-colors sm:p-5 ${
            isActiveBlock || isBookmarkedBlock
              ? "shadow-sm"
              : "hover:border-slate-300/40"
          }`}
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 font-sans">
            <div className="min-w-0 flex-1">
              <span
                style={{
                  color: isActiveBlock
                    ? theme.isDark
                      ? "#7DD3FC"
                      : "#0F766E"
                    : isBookmarkedBlock
                    ? theme.isDark
                      ? "#FCD34D"
                      : "#B45309"
                    : theme.muted,
                }}
                className={`block break-words text-xs leading-snug tabular-nums ${
                  isActiveBlock || isBookmarkedBlock
                    ? "font-semibold"
                    : "font-medium"
                }`}
              >
                {isActiveBlock
                  ? isPlaying && !isPaused
                    ? "Lendo agora · "
                    : "Bloco atual · "
                  : ""}
                {isBookmarkedBlock ? "Onde você parou · " : ""}
                Página {paragraph.pageNumber} · Capítulo: {blockChapter} ·
                Bloco {index + 1}
              </span>
            </div>

            <div
              className={`flex flex-wrap items-center gap-1.5 transition-opacity shrink-0 ${
                isBookmarkedBlock || isActiveBlock
                  ? "opacity-100"
                  : "opacity-95 lg:opacity-65 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(index);
                }}
                aria-pressed={isBookmarkedBlock}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  isBookmarkedBlock
                    ? "border-amber-400 bg-amber-50 text-amber-950"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {isBookmarkedBlock ? (
                  <BookmarkCheck
                    className="h-3.5 w-3.5 text-amber-700"
                    aria-hidden="true"
                  />
                ) : (
                  <Bookmark
                    className="h-3.5 w-3.5 text-teal-700"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {isBookmarkedBlock ? "Parei aqui" : "Marcar parada"}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayFrom(index);
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Volume2 className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                <span>Ouvir daqui</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAi("explain_excerpt", paragraph.text);
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <HelpCircle className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                <span>Explicar</span>
              </button>
            </div>
          </div>

          {paragraph.isHeading ? (
            <h2
              data-paragraph-text={index}
              onClick={handleParagraphClick}
              className="cursor-pointer font-bold tracking-tight"
              style={{ fontSize: `${Math.round(fontSize * 1.25)}px` }}
            >
              {renderedSentences}
            </h2>
          ) : (
            <p
              data-paragraph-text={index}
              onClick={handleParagraphClick}
              className="cursor-pointer"
            >
              {renderedSentences}
            </p>
          )}
        </section>
      ) : (
        <section
          data-paragraph-index={index}
          ref={(el) => registerParagraphRef(index, el)}
          style={{
            backgroundColor:
              isSpokenHighlight || isBookmarkedBlock
                ? theme.surface
                : "transparent",
            borderColor: isSpokenHighlight
              ? theme.isDark
                ? "rgba(56, 189, 248, 0.55)"
                : "rgba(15, 118, 110, 0.35)"
              : isBookmarkedBlock
              ? theme.isDark
                ? "rgba(251, 191, 36, 0.65)"
                : "rgba(217, 119, 6, 0.5)"
              : "transparent",
          }}
          className={`group relative scroll-mt-48 rounded-xl border px-3 py-2 transition-colors sm:px-4 ${
            paragraph.isHeading ? "pt-3" : ""
          }`}
        >
          <div
            className={`mb-1 flex flex-wrap items-center justify-between gap-1.5 font-sans transition-opacity ${
              isBookmarkedBlock || isActiveBlock
                ? "opacity-100"
                : "lg:opacity-50 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
            }`}
          >
            <span
              style={{
                color: isBookmarkedBlock
                  ? theme.isDark
                    ? "#FCD34D"
                    : "#B45309"
                  : "transparent",
              }}
              className="text-[11px] font-semibold"
            >
              {isBookmarkedBlock ? "Onde você parou" : ""}
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(index);
                }}
                aria-pressed={isBookmarkedBlock}
                className={`inline-flex min-h-[30px] items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  isBookmarkedBlock
                    ? "border-amber-400 bg-amber-50 text-amber-950"
                    : "border-slate-300 bg-white/95 text-slate-800 hover:bg-slate-50"
                }`}
              >
                {isBookmarkedBlock ? (
                  <BookmarkCheck
                    className="h-3 w-3 text-amber-700"
                    aria-hidden="true"
                  />
                ) : (
                  <Bookmark
                    className="h-3 w-3 text-teal-700"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {isBookmarkedBlock ? "Parei aqui" : "Parei aqui?"}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayFrom(index);
                }}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-slate-300 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Volume2 className="h-3 w-3 text-teal-700" aria-hidden="true" />
                <span>Ouvir daqui</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAi("explain_excerpt", paragraph.text);
                }}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-slate-300 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                <HelpCircle className="h-3 w-3 text-teal-700" aria-hidden="true" />
                <span>Explicar</span>
              </button>
            </div>
          </div>

          {paragraph.isHeading ? (
            <h2
              data-paragraph-text={index}
              onClick={handleParagraphClick}
              className="cursor-pointer font-bold tracking-tight"
              style={{ fontSize: `${Math.round(fontSize * 1.25)}px` }}
            >
              {renderedSentences}
            </h2>
          ) : (
            <p
              data-paragraph-text={index}
              onClick={handleParagraphClick}
              className="cursor-pointer"
            >
              {renderedSentences}
            </p>
          )}
        </section>
      )}
    </React.Fragment>
  );
};

export const ParagraphBlock = React.memo(ParagraphBlockInner);
