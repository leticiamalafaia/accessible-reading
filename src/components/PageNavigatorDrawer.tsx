import React, { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Highlighter,
  NotebookPen,
  Trash2,
  X,
} from "lucide-react";
import { HighlightColor, PdfDocumentRecord } from "../types/reader";
import {
  getHighlightColorDef,
  HIGHLIGHT_COLOR_OPTIONS,
} from "../lib/settingsStorage";

export type NavigatorDrawerTab = "pages" | "chapters" | "marks";

interface PageNavigatorDrawerProps {
  open: boolean;
  initialTab?: NavigatorDrawerTab;
  onClose: () => void;
  document: PdfDocumentRecord;
  currentPage: number;
  activeParagraphIndex: number;
  onSelectPage: (pageNumber: number) => void;
  onSelectParagraph: (paragraphIndex: number) => void;
  onSetBookmarkAtCurrent: () => void;
  onClearBookmark: () => void;
  onUpdateHighlightColor: (highlightId: string, color: HighlightColor) => void;
  onRemoveHighlight: (highlightId: string) => void;
  onDeleteStudyNote?: (noteId: string) => void;
}

interface ChapterNavItem {
  title: string;
  pageNumber: number;
  paragraphIndex: number;
}

interface PageNavItem {
  pageNumber: number;
  chapterTitle: string;
  blockCount: number;
  firstSnippet: string;
  firstParagraphIndex: number;
}

export const PageNavigatorDrawer: React.FC<PageNavigatorDrawerProps> = ({
  open,
  initialTab = "pages",
  onClose,
  document: pdfDoc,
  currentPage,
  activeParagraphIndex,
  onSelectPage,
  onSelectParagraph,
  onSetBookmarkAtCurrent,
  onClearBookmark,
  onUpdateHighlightColor,
  onRemoveHighlight,
  onDeleteStudyNote,
}) => {
  const [tab, setTab] = useState<NavigatorDrawerTab>(initialTab);
  const [colorFilter, setColorFilter] = useState<HighlightColor | "all">("all");
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [initialTab, open]);

  const highlights = useMemo(
    () =>
      [...(pdfDoc.highlights || [])].sort((a, b) =>
        a.paragraphIndex !== b.paragraphIndex
          ? a.paragraphIndex - b.paragraphIndex
          : a.startOffset - b.startOffset
      ),
    [pdfDoc.highlights]
  );

  const studyNotes = useMemo(
    () =>
      [...(pdfDoc.studyNotes || [])].sort((a, b) => b.createdAt - a.createdAt),
    [pdfDoc.studyNotes]
  );

  const filteredHighlights = useMemo(() => {
    if (colorFilter === "all") return highlights;
    return highlights.filter((h) => h.color === colorFilter);
  }, [colorFilter, highlights]);

  const marksTotalCount =
    highlights.length + studyNotes.length + (pdfDoc.bookmark ? 1 : 0);

  const { pageItems, chapterItems } = useMemo(() => {
    const pagesMap = new Map<number, PageNavItem>();
    const chapters: ChapterNavItem[] = [];
    const seenChapterKeys = new Set<string>();
    let runningChapter = pdfDoc.title || "Início do documento";

    for (let idx = 0; idx < pdfDoc.paragraphs.length; idx++) {
      const p = pdfDoc.paragraphs[idx];
      if (p.chapter) {
        runningChapter = p.chapter;
      } else if (p.isHeading) {
        runningChapter = p.text;
      }
      const chap = runningChapter;

      if (!pagesMap.has(p.pageNumber)) {
        pagesMap.set(p.pageNumber, {
          pageNumber: p.pageNumber,
          chapterTitle: chap,
          blockCount: 1,
          firstSnippet: p.text.slice(0, 90),
          firstParagraphIndex: idx,
        });
      } else {
        const existing = pagesMap.get(p.pageNumber)!;
        existing.blockCount += 1;
      }

      if (p.isHeading || idx === 0) {
        const title = p.isHeading ? p.text : chap;
        const key = `${p.pageNumber}:${title.toLowerCase()}`;
        if (!seenChapterKeys.has(key)) {
          seenChapterKeys.add(key);
          chapters.push({
            title,
            pageNumber: p.pageNumber,
            paragraphIndex: idx,
          });
        }
      }
    }

    const pages: PageNavItem[] = [];
    for (let pageNum = 1; pageNum <= pdfDoc.pageCount; pageNum++) {
      const existing = pagesMap.get(pageNum);
      if (existing) {
        pages.push(existing);
      } else {
        pages.push({
          pageNumber: pageNum,
          chapterTitle: "Página sem texto extraído",
          blockCount: 0,
          firstSnippet: "Conteúdo digitalizado ou página em branco.",
          firstParagraphIndex: -1,
        });
      }
    }

    return { pageItems: pages, chapterItems: chapters };
  }, [pdfDoc.pageCount, pdfDoc.paragraphs, pdfDoc.title]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-slate-950/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Navegador de páginas, capítulos e marcações"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-[calc(100vw-1rem)] flex-col border-r border-slate-200 bg-white shadow-2xl sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-950">
              Navegar no documento
            </h2>
            <p className="truncate text-xs text-slate-500 tabular-nums">
              Página atual: {currentPage} de {pdfDoc.pageCount}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar navegador"
            className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Direct page jump input */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <label
            htmlFor="drawer-page-jump"
            className="block text-xs font-semibold text-slate-700"
          >
            Ir direto para a página
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <select
              id="drawer-page-jump"
              value={currentPage}
              onChange={(e) => {
                onSelectPage(Number(e.target.value));
                onClose();
              }}
              className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 tabular-nums"
            >
              {pageItems.map((p) => (
                <option key={p.pageNumber} value={p.pageNumber}>
                  Página {p.pageNumber} de {pdfDoc.pageCount}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Switcher between Pages, Chapters and Marks */}
        <div className="border-b border-slate-200 px-4 py-2.5 sm:px-5">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("pages")}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors ${
                tab === "pages"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Páginas ({pdfDoc.pageCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("chapters")}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors ${
                tab === "chapters"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Cap. ({chapterItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("marks")}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors ${
                tab === "marks"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Highlighter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Marcas{marksTotalCount > 0 ? ` (${marksTotalCount})` : ""}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {tab === "pages" ? (
            pageItems.map((item) => {
              const isCurrent = item.pageNumber === currentPage;
              const isBookmarkedPage =
                pdfDoc.bookmark?.pageNumber === item.pageNumber;
              return (
                <button
                  key={item.pageNumber}
                  type="button"
                  onClick={() => {
                    onSelectPage(item.pageNumber);
                    onClose();
                  }}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    isCurrent
                      ? "border-teal-700 bg-teal-50/70"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-teal-800 tabular-nums">
                      <span>Página {item.pageNumber}</span>
                      {isCurrent && <span>· Você está aqui</span>}
                      {isBookmarkedPage && (
                        <span className="inline-flex items-center gap-1 text-amber-800">
                          · <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" /> Onde parei
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
                      {item.chapterTitle}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {item.firstSnippet}
                      {item.firstSnippet.length >= 90 ? "..." : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {item.blockCount}{" "}
                      {item.blockCount === 1 ? "bloco" : "blocos"}
                    </p>
                  </div>
                  <ChevronRight
                    className={`mt-1 h-4 w-4 shrink-0 ${
                      isCurrent ? "text-teal-700" : "text-slate-400"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })
          ) : tab === "chapters" ? (
            chapterItems.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Nenhum título de capítulo separado foi detectado. Use a aba
                Páginas ao lado para ir direto a qualquer página.
              </p>
            ) : (
              chapterItems.map((chap, i) => {
                const isActive =
                  chap.paragraphIndex === activeParagraphIndex ||
                  chap.pageNumber === currentPage;
                return (
                  <button
                    key={`${chap.pageNumber}-${i}`}
                    type="button"
                    onClick={() => {
                      onSelectParagraph(chap.paragraphIndex);
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      isActive
                        ? "border-teal-700 bg-teal-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {chap.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        Página {chap.pageNumber}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-teal-700" : "text-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })
            )
          ) : (
            <div className="space-y-4">
              {/* Bookmark ("Onde parei") section */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {pdfDoc.bookmark ? (
                      <BookmarkCheck
                        className="h-4 w-4 text-teal-700 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Bookmark
                        className="h-4 w-4 text-slate-500 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <h3 className="text-sm font-bold text-slate-950">
                      Onde parei a leitura
                    </h3>
                  </div>
                  {pdfDoc.bookmark && (
                    <span className="text-xs font-semibold text-teal-800 tabular-nums">
                      Pág. {pdfDoc.bookmark.pageNumber} · Bloco{" "}
                      {pdfDoc.bookmark.paragraphIndex + 1}
                    </span>
                  )}
                </div>

                {pdfDoc.bookmark ? (
                  <div className="mt-2.5 space-y-3">
                    {pdfDoc.bookmark.chapter && (
                      <p className="text-xs font-medium text-slate-600">
                        Capítulo: {pdfDoc.bookmark.chapter}
                      </p>
                    )}
                    <p className="line-clamp-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-relaxed text-slate-800">
                      “{pdfDoc.bookmark.snippet}
                      {pdfDoc.bookmark.snippet.length >= 140 ? "..." : ""}”
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectParagraph(pdfDoc.bookmark!.paragraphIndex);
                          onClose();
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <span>Ir para onde parei</span>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      {pdfDoc.bookmark.paragraphIndex !== activeParagraphIndex && (
                        <button
                          type="button"
                          onClick={onSetBookmarkAtCurrent}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <span>Mover para bloco atual</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onClearBookmark}
                        className="inline-flex min-h-[38px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2.5">
                    <p className="text-xs leading-relaxed text-slate-600">
                      Você ainda não marcou onde parou neste documento. Salve sua
                      posição atual para retomar exatamente deste trecho depois.
                    </p>
                    <button
                      type="button"
                      onClick={onSetBookmarkAtCurrent}
                      disabled={pdfDoc.paragraphs.length === 0}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                    >
                      <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Marcar bloco atual (Pág. {currentPage})</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Multi-color highlighted excerpts section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-950">
                    Trechos marcados ({highlights.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-700">
                  {HIGHLIGHT_COLOR_OPTIONS.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: c.swatchHex }}
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-400/60"
                      />
                      <span>
                        <strong className="text-slate-900">{c.label}:</strong>{" "}
                        {c.meaning}
                      </span>
                    </div>
                  ))}
                </div>

                {highlights.length > 0 && (
                  <div
                    role="group"
                    aria-label="Filtrar trechos por cor"
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => setColorFilter("all")}
                      aria-pressed={colorFilter === "all"}
                      className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                        colorFilter === "all"
                          ? "border-teal-700 bg-teal-50 text-teal-900"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Todas ({highlights.length})
                    </button>
                    {HIGHLIGHT_COLOR_OPTIONS.map((c) => {
                      const count = highlights.filter(
                        (h) => h.color === c.id
                      ).length;
                      if (count === 0) return null;
                      const active = colorFilter === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColorFilter(c.id)}
                          aria-pressed={active}
                          title={c.meaning}
                          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                            active
                              ? "border-slate-900 bg-slate-100 text-slate-950"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            style={{ backgroundColor: c.swatchHex }}
                            className="h-3 w-3 rounded-full border border-slate-400/50"
                          />
                          <span>
                            {c.label} ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredHighlights.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                    {highlights.length === 0
                      ? "Nenhum trecho marcado ainda. Selecione qualquer palavra ou frase no texto do PDF e escolha uma cor conforme o significado acima."
                      : "Nenhum trecho encontrado com esta cor."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredHighlights.map((hl) => {
                      const colorDef = getHighlightColorDef(hl.color);
                      return (
                        <div
                          key={hl.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-700 tabular-nums">
                              <span
                                aria-hidden="true"
                                style={{ backgroundColor: colorDef.swatchHex }}
                                className="h-3 w-3 rounded-full border border-slate-400/50"
                              />
                              <span>{colorDef.meaning}</span>
                              <span className="text-slate-400">·</span>
                              <span>
                                Pág. {hl.pageNumber} · Bloco{" "}
                                {hl.paragraphIndex + 1}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveHighlight(hl.id)}
                              aria-label="Excluir marcação de trecho"
                              title="Excluir marcação"
                              className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectParagraph(hl.paragraphIndex);
                              onClose();
                            }}
                            className="mt-2 block w-full text-left"
                          >
                            <p
                              style={{
                                backgroundColor: colorDef.lightBg,
                                color: colorDef.lightText,
                              }}
                              className="line-clamp-3 rounded-lg px-2.5 py-2 text-xs font-medium leading-relaxed"
                            >
                              “{hl.text}”
                            </p>
                          </button>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div
                              role="group"
                              aria-label="Alterar cor do trecho"
                              className="flex items-center gap-1.5"
                            >
                              {HIGHLIGHT_COLOR_OPTIONS.map((opt) => {
                                const isCurrentColor = opt.id === hl.color;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() =>
                                      onUpdateHighlightColor(hl.id, opt.id)
                                    }
                                    aria-label={`Mudar cor para ${opt.label}`}
                                    aria-pressed={isCurrentColor}
                                    title={opt.label}
                                    style={{ backgroundColor: opt.swatchHex }}
                                    className={`h-6 w-6 rounded-full border transition-transform ${
                                      isCurrentColor
                                        ? "scale-110 border-slate-950 ring-2 ring-slate-900/20"
                                        : "border-slate-400/60 hover:scale-105"
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                onSelectParagraph(hl.paragraphIndex);
                                onClose();
                              }}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                            >
                              <span>Ir ao trecho</span>
                              <ChevronRight
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Saved AI study notes section */}
              <section className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-950">
                    <NotebookPen
                      className="h-4 w-4 text-indigo-700"
                      aria-hidden="true"
                    />
                    <span>Anotações salvas ({studyNotes.length})</span>
                  </h3>
                </div>

                {studyNotes.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                    Nenhuma anotação salva ainda. Selecione um trecho do PDF, peça{" "}
                    <strong className="font-semibold text-slate-900">
                      Resumo p/ anotação
                    </strong>{" "}
                    e clique em{" "}
                    <strong className="font-semibold text-slate-900">
                      Salvar anotação
                    </strong>
                    .
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {studyNotes.map((note) => {
                      const isCopied = copiedNoteId === note.id;
                      return (
                        <div
                          key={note.id}
                          className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-3.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 text-xs font-semibold text-indigo-900 tabular-nums">
                              <span className="truncate">{note.title}</span>
                              {note.pageNumber ? (
                                <span className="text-slate-500">
                                  {" "}
                                  · Pág. {note.pageNumber}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      note.content
                                    );
                                    setCopiedNoteId(note.id);
                                    window.setTimeout(() => {
                                      setCopiedNoteId((curr) =>
                                        curr === note.id ? null : curr
                                      );
                                    }, 2000);
                                  } catch {
                                    // Ignore clipboard error
                                  }
                                }}
                                aria-label="Copiar anotação"
                                title="Copiar anotação"
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-950"
                              >
                                {isCopied ? (
                                  <>
                                    <Check
                                      className="h-3.5 w-3.5 text-teal-700"
                                      aria-hidden="true"
                                    />
                                    <span className="text-teal-800">
                                      Copiado
                                    </span>
                                  </>
                                ) : (
                                  <Copy
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                              {onDeleteStudyNote && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteStudyNote(note.id)}
                                  aria-label="Excluir anotação"
                                  title="Excluir anotação"
                                  className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          {note.sourceSnippet && (
                            <p className="mt-1.5 line-clamp-2 rounded-lg border border-indigo-100 bg-white/80 px-2.5 py-1.5 text-[11px] italic text-slate-600">
                              “{note.sourceSnippet}”
                            </p>
                          )}

                          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-800">
                            {note.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

