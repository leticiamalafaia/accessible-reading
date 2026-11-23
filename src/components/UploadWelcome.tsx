import React, { useState } from "react";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Coffee,
  Eye,
  FileText,
  Highlighter,
  Network,
  ShieldCheck,
  Upload,
  Volume2,
} from "lucide-react";
import { PdfDocumentRecord } from "../types/reader";
import calmDeskImg from "../assets/images/calm_reading_desk_1794575615148.jpg";

interface UploadWelcomeProps {
  recentDocuments: PdfDocumentRecord[];
  isProcessing: boolean;
  processingStatus: string;
  errorMessage: string | null;
  onFileSelected: (file: File) => void;
  onLoadSamplePdf: () => void;
  onOpenDocument: (doc: PdfDocumentRecord) => void;
  onOpenSettings: () => void;
}

export const UploadWelcome: React.FC<UploadWelcomeProps> = ({
  recentDocuments,
  isProcessing,
  processingStatus,
  errorMessage,
  onFileSelected,
  onLoadSamplePdf,
  onOpenDocument,
  onOpenSettings,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      onFileSelected(file);
    } else if (file && file.name.toLowerCase().endsWith(".pdf")) {
      onFileSelected(file);
    }
  };

  return (
    <div className="bg-[radial-gradient(ellipse_at_top_right,rgba(13,148,136,0.10),transparent_52%),radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.07),transparent_48%)]">
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:py-12">
        {/* Main hero split: vibrant editorial typography + upload studio + framed visual */}
        <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-xs font-bold tracking-wider uppercase text-teal-700 sm:text-sm">
              Estúdio de leitura acessível · Dislexia, TDAH e foco profundo
            </p>
            <h1
              className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.8rem] lg:leading-[1.12]"
              style={{ textWrap: "balance" }}
            >
              Leia qualquer PDF no seu ritmo, com{" "}
              <span className="text-teal-700">voz natural</span> e zero cansaço visual
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Transforme arquivos densos em páginas calmas e organizadas. Ajuste
              fontes como OpenDyslexic, ouça com destaque palavra por palavra,
              marque trechos em várias cores e tire dúvidas em linguagem simples.
            </p>

            {/* Elevated Upload Studio Card */}
            <div className="studio-card mt-7 rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-5 transition-colors sm:p-6 ${
                  isDragging
                    ? "border-teal-600 bg-teal-50/80"
                    : "border-teal-300/80 bg-gradient-to-br from-teal-50/55 via-white to-sky-50/50"
                }`}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <div
                      className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-base font-bold text-slate-950">
                      Preparando seu documento
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {processingStatus}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                        Envie um PDF do seu computador ou celular
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        Arraste o arquivo até aqui ou selecione pelo botão. PDFs
                        digitalizados são reconhecidos via OCR local.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-700/25 hover:from-teal-700 hover:to-emerald-700 transition-all whitespace-nowrap">
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        <span>Escolher PDF</span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onFileSelected(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  >
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Secondary actions */}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onLoadSamplePdf}
                disabled={isProcessing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-sm font-semibold text-indigo-950 hover:border-indigo-300 hover:bg-indigo-100/70 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <BookOpen
                  className="h-4 w-4 text-indigo-700"
                  aria-hidden="true"
                />
                <span>Testar com PDF de exemplo</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-slate-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-900"
              >
                Personalizar fonte e cores antes de ler
              </button>
            </div>
          </div>

          {/* Editorial Framed Visual Showcase */}
          <div className="lg:col-span-5">
            <div className="relative flex h-full min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl bg-slate-900 shadow-[0_22px_50px_-16px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10">
              <img
                src={calmDeskImg}
                alt="Mesa iluminada com livro aberto em ambiente tranquilo e acolhedor"
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent"
              />
              <div className="relative z-10 p-6 text-white">
                <div className="h-1 w-12 rounded-full bg-emerald-400" />
                <p className="font-display mt-3 text-xl font-semibold leading-snug text-white">
                  Leitura calma, no seu tempo e do seu jeito
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200 sm:text-sm">
                  Narração em português · Régua de foco · Marcações coloridas ·
                  Ponto de parada salvo
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core pillars strip with vibrant purposeful color accents */}
        <section
          aria-label="Recursos de acessibilidade"
          className="mt-14 grid grid-cols-1 gap-8 border-t border-slate-200/90 pt-10 md:grid-cols-3"
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-700/25">
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-slate-950">
                Voz natural e destaque ativo
              </h2>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Ouça páginas inteiras em ritmo calmo, animado ou pausado enquanto
              cada palavra falada é acompanhada na tela.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-700/25">
                <Highlighter className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-slate-950">
                Marcações coloridas e ponto de parada
              </h2>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Salve exatamente onde parou com um clique, destaque trechos em
              várias cores e consulte tudo no painel lateral.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-600/25">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-slate-950">
                Privacidade local garantida
              </h2>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Seus PDFs, marcações e histórico ficam salvos apenas no seu
              navegador. Recursos externos de IA só rodam se você autorizar.
            </p>
          </div>
        </section>

        {/* Evidence-based dyslexia strategies strip */}
        <section
          aria-label="Estratégias práticas para dislexia integradas ao leitor"
          className="mt-10 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-4">
            <h2 className="font-display text-lg font-bold text-slate-950">
              Estratégias práticas para leitura com dislexia
            </h2>
            <p className="text-xs text-slate-500">
              Recursos visuais e multissensoriais integrados em cada etapa
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Network
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Diagramas e conexões
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Transforme textos densos em esquemas visuais organizados com tema central e passo a passo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Highlighter
                className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cores com significado
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Destaque por função (Essencial, Entendi, Exemplo, Dúvida ? e Conceito) para evitar reler tudo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Coffee
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Etapas com pausas
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Divida documentos extensos em blocos de meta com lembretes gentis para descansar os olhos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Eye
                className="mt-0.5 h-5 w-5 shrink-0 text-teal-700"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Fontes e lentes suaves
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Alterne entre OpenDyslexic, IBM Plex Mono e lentes translúcidas que reduzem o reflexo branco.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent documents if available */}
        {recentDocuments.length > 0 && (
          <section className="mt-12 border-t border-slate-200/90 pt-10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-slate-950">
                Continuar leitura recente
              </h2>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentDocuments.slice(0, 3).map((doc) => {
                const progressPct =
                  doc.paragraphs.length > 0
                    ? Math.round(
                        ((doc.lastParagraphIndex + 1) / doc.paragraphs.length) *
                          100
                      )
                    : 0;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onOpenDocument(doc)}
                    className="studio-card group flex flex-col items-start rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-teal-500"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold text-teal-800 tabular-nums">
                        {progressPct}% concluído
                      </span>
                    </div>

                    <h3 className="mt-3 line-clamp-1 text-base font-bold text-slate-950 group-hover:text-teal-800">
                      {doc.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {doc.pageCount} páginas · {doc.paragraphs.length} blocos
                      {doc.bookmark
                        ? ` · Parou na pág. ${doc.bookmark.pageNumber}`
                        : ""}
                    </p>

                    <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                      />
                    </div>

                    <div className="mt-4 flex w-full items-center justify-between text-xs font-bold text-teal-700">
                      <span className="inline-flex items-center gap-1">
                        {doc.bookmark && (
                          <BookmarkCheck
                            className="h-3.5 w-3.5 text-amber-600"
                            aria-hidden="true"
                          />
                        )}
                        <span>Retomar leitura</span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

