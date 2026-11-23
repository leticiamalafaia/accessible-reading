import React, { useState } from "react";
import { BookOpen, Search, Trash2, Upload } from "lucide-react";
import { PdfDocumentRecord } from "../types/reader";

interface LibraryViewProps {
  documents: PdfDocumentRecord[];
  activeDocumentId?: string;
  onOpenDocument: (doc: PdfDocumentRecord) => void;
  onDeleteDocument: (id: string) => void;
  onClearAll: () => void;
  onTriggerUpload: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  documents,
  activeDocumentId,
  onOpenDocument,
  onDeleteDocument,
  onClearAll,
  onTriggerUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-teal-700">
            Acervo pessoal offline
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Sua Biblioteca Local
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Todos os documentos ficam salvos exclusivamente neste navegador, com seu
            progresso, marcações e ponto de parada preservados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {documents.length > 0 && !confirmClearAll && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 transition-colors"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Limpar histórico</span>
            </button>
          )}

          {confirmClearAll && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <span className="text-xs font-semibold text-red-900">
                Apagar tudo?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearAll(false);
                }}
                className="min-h-[34px] rounded-md bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="min-h-[34px] rounded-md bg-white px-2.5 text-xs font-medium text-slate-700"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 transition-all"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Novo PDF</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {documents.length > 0 && (
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documento pelo nome..."
              aria-label="Buscar documento pelo nome"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-3">
        {documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <BookOpen
              className="mx-auto h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              Nenhum documento salvo ainda
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Carregue um arquivo PDF para iniciar sua leitura acessível e salvar o
              progresso aqui.
            </p>
            <button
              type="button"
              onClick={onTriggerUpload}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Carregar primeiro PDF</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">
            Nenhum documento corresponde à sua busca.
          </p>
        ) : (
          filtered.map((doc) => {
            const isCurrent = doc.id === activeDocumentId;
            const progress =
              doc.paragraphs.length > 0
                ? Math.round(
                    ((doc.lastParagraphIndex + 1) / doc.paragraphs.length) * 100
                  )
                : 0;
            const dateStr = new Date(doc.lastOpenedAt).toLocaleDateString(
              "pt-BR"
            );

            return (
              <div
                key={doc.id}
                className={`studio-card flex flex-col justify-between gap-4 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center ${
                  isCurrent
                    ? "border-teal-500 bg-gradient-to-r from-teal-50/60 via-white to-white"
                    : "border-slate-200/90 bg-white hover:border-slate-300"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-slate-950">
                    {doc.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {doc.pageCount} páginas · {doc.paragraphs.length} blocos ·{" "}
                    {formatBytes(doc.fileSize)} · {progress}% lido · Aberto em{" "}
                    {dateStr}
                    {doc.bookmark
                      ? ` · Parou na pág. ${doc.bookmark.pageNumber}`
                      : ""}
                    {(doc.highlights?.length || 0) > 0
                      ? ` · ${doc.highlights!.length} ${
                          doc.highlights!.length === 1
                            ? "trecho marcado"
                            : "trechos marcados"
                        }`
                      : ""}
                    {doc.ocrApplied
                      ? ` · OCR ${doc.ocrMethod === "ai" ? "IA" : "local"}`
                      : ""}
                  </p>
                  <div className="mt-2.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenDocument(doc)}
                    className="min-h-[42px] rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-700/20 hover:from-teal-700 hover:to-emerald-700 transition-all whitespace-nowrap"
                  >
                    {isCurrent ? "Continuar lendo" : "Abrir documento"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteDocument(doc.id)}
                    aria-label={`Excluir ${doc.title}`}
                    title="Excluir documento"
                    className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
};
