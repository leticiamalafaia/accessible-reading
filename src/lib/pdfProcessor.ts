import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";
import {
  OcrProgressState,
  PdfDocumentRecord,
  PdfParagraph,
} from "../types/reader";
import { requestAiOcr } from "./aiClient";
import { getDocumentPdfDataFromDb } from "./documentDb";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface RawTextLine {
  y: number;
  fontSize: number;
  text: string;
}

export function splitIntoSentences(paragraphText: string): string[] {
  const normalized = paragraphText.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+(?:[.!?]+|$)/g);
  if (!matches) return [normalized];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function buildParagraphsFromRawText(
  rawText: string,
  pageNumber: number,
  source: "text" | "ocr-local" | "ocr-ai"
): PdfParagraph[] {
  const blocks = rawText
    .split(/\n{2,}/)
    .map((b) => b.replace(/-\n/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);

  return blocks.map((blockText, idx) => {
    const isChapterPattern =
      /^(cap[íi]tulo|se[çc][ãa]o|parte|unidade|m[óo]dulo|tema|li[çc][ãa]o)\s+[\dIVXLCM]+/i.test(
        blockText
      ) || /^(\d+\.(\d+\.)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/.test(blockText);

    const isShortHeading =
      (blockText.length < 95 &&
        !/[.!?]$/.test(blockText) &&
        blockText.split(/\s+/).length <= 12) ||
      (isChapterPattern && blockText.length < 130);

    return {
      id: `p-${pageNumber}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      pageNumber,
      text: blockText,
      sentences: splitIntoSentences(blockText),
      isHeading: isShortHeading,
      source,
    };
  });
}

function extractOrganizedLinesFromItems(
  items: Array<{ str?: string; transform?: number[]; height?: number }>
): { lines: RawTextLine[]; medianFontSize: number } {
  const positioned: Array<{ x: number; y: number; size: number; str: string }> = [];

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const tx = item.transform || [1, 0, 0, 1, 0, 0];
    const x = tx[4] ?? 0;
    const y = tx[5] ?? 0;
    const size = Math.abs(tx[3] ?? item.height ?? 12) || 12;
    positioned.push({ x, y, size, str: item.str });
  }

  if (positioned.length === 0) {
    return { lines: [], medianFontSize: 12 };
  }

  // Sort top-to-bottom (higher Y first in PDF coordinates), then left-to-right
  positioned.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: RawTextLine[] = [];
  for (const token of positioned) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - token.y) <= Math.max(4, token.size * 0.45)) {
      const needsSpace =
        last.text.length > 0 &&
        !last.text.endsWith(" ") &&
        !token.str.startsWith(" ");
      last.text += (needsSpace ? " " : "") + token.str;
      last.fontSize = Math.max(last.fontSize, token.size);
    } else {
      lines.push({
        y: token.y,
        fontSize: token.size,
        text: token.str.trim(),
      });
    }
  }

  const sizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianFontSize = sizes[Math.floor(sizes.length / 2)] || 12;

  return { lines, medianFontSize };
}

function groupLinesIntoParagraphs(
  lines: RawTextLine[],
  medianFontSize: number,
  pageNumber: number
): PdfParagraph[] {
  if (lines.length === 0) return [];

  const paragraphs: PdfParagraph[] = [];
  let buffer: string[] = [];
  let bufferIsHeading = false;

  const flush = () => {
    if (buffer.length === 0) return;
    let joined = "";
    for (const part of buffer) {
      if (!joined) {
        joined = part;
      } else if (joined.endsWith("-")) {
        joined = joined.slice(0, -1) + part;
      } else {
        joined += " " + part;
      }
    }
    const clean = joined.replace(/\s+/g, " ").trim();
    if (clean) {
      paragraphs.push({
        id: `p-${pageNumber}-${paragraphs.length}`,
        pageNumber,
        text: clean,
        sentences: splitIntoSentences(clean),
        isHeading: bufferIsHeading,
        source: "text",
      });
    }
    buffer = [];
    bufferIsHeading = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.text.trim();
    if (!cleanLine) continue;

    // Skip isolated page-number footers like "1" or "Página 2"
    if (
      (i === 0 || i === lines.length - 1) &&
      cleanLine.length <= 12 &&
      /^(página\s*)?\d+$/i.test(cleanLine)
    ) {
      continue;
    }

    const prevLine = i > 0 ? lines[i - 1] : null;
    const isChapterPattern =
      /^(cap[íi]tulo|se[çc][ãa]o|parte|unidade|m[óo]dulo|tema|li[çc][ãa]o)\s+[\dIVXLCM]+/i.test(
        cleanLine
      ) || /^(\d+\.(\d+\.)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/.test(cleanLine);
    const isHeadingLine =
      (line.fontSize >= medianFontSize * 1.15 && cleanLine.length < 130) ||
      (isChapterPattern && cleanLine.length < 130);
    const verticalGap = prevLine ? Math.abs(prevLine.y - line.y) : 0;
    const largeGap = prevLine ? verticalGap > medianFontSize * 1.75 : false;
    const prevEndedSentence =
      prevLine && /[.!?:]$/.test(prevLine.text.trim()) && prevLine.text.length < 68;

    if (
      buffer.length > 0 &&
      (isHeadingLine !== bufferIsHeading || largeGap || prevEndedSentence)
    ) {
      flush();
    }

    if (buffer.length === 0) {
      bufferIsHeading = isHeadingLine;
    }
    buffer.push(cleanLine);
  }

  flush();
  return paragraphs;
}

interface OutlineChapterEntry {
  pageNumber: number;
  title: string;
}

async function extractOutlineChapters(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<OutlineChapterEntry[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) return [];

    const entries: OutlineChapterEntry[] = [];

    const walk = async (nodes: typeof outline) => {
      for (const node of nodes) {
        if (node.title?.trim() && node.dest) {
          try {
            const destArray =
              typeof node.dest === "string"
                ? await pdf.getDestination(node.dest)
                : node.dest;
            if (Array.isArray(destArray) && destArray[0]) {
              const pageIdx = await pdf.getPageIndex(destArray[0]);
              entries.push({
                pageNumber: pageIdx + 1,
                title: node.title.trim(),
              });
            }
          } catch {
            // Skip unresolved outline destination
          }
        }
        if (Array.isArray(node.items) && node.items.length > 0) {
          await walk(node.items);
        }
      }
    };

    await walk(outline);
    return entries.sort((a, b) => a.pageNumber - b.pageNumber);
  } catch {
    return [];
  }
}

export function assignChaptersToParagraphs(
  paragraphs: PdfParagraph[],
  outlineChapters: OutlineChapterEntry[] = [],
  fallbackTitle = "Início do documento"
): PdfParagraph[] {
  let currentChapter = fallbackTitle;
  let lastPage = 0;

  return paragraphs.map((p) => {
    if (p.pageNumber !== lastPage) {
      lastPage = p.pageNumber;
      const outlineMatch = [...outlineChapters]
        .reverse()
        .find((c) => c.pageNumber <= p.pageNumber);
      if (outlineMatch && p.pageNumber === outlineMatch.pageNumber) {
        currentChapter = outlineMatch.title;
      }
    }

    const explicitChapterMatch =
      /^(cap[íi]tulo|se[çc][ãa]o|parte|unidade|m[óo]dulo|tema|li[çc][ãa]o)\s+[\dIVXLCM]+/i.test(
        p.text
      );

    if (p.isHeading || (explicitChapterMatch && p.text.length < 130)) {
      currentChapter = p.text;
    }

    return {
      ...p,
      chapter: p.chapter || currentChapter,
    };
  });
}

export function resolveParagraphChapter(
  paragraphs: PdfParagraph[],
  index: number,
  docTitle?: string
): string {
  const target = paragraphs[index];
  if (!target) return docTitle || "Início do documento";
  if (target.chapter) return target.chapter;

  for (let i = index; i >= 0; i--) {
    if (paragraphs[i]?.chapter) return paragraphs[i].chapter!;
    if (paragraphs[i]?.isHeading) return paragraphs[i].text;
  }
  return docTitle || "Início do documento";
}

export async function processPdfFile(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<PdfDocumentRecord> {
  const arrayBuffer = await file.arrayBuffer();
  const dataCopy = arrayBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const allParagraphs: PdfParagraph[] = [];
  const scannedPages: number[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rawItems = textContent.items as Array<{
      str?: string;
      transform?: number[];
      height?: number;
    }>;

    const totalChars = rawItems.reduce(
      (acc, it) => acc + (it.str ? it.str.trim().length : 0),
      0
    );

    if (totalChars < 25) {
      scannedPages.push(pageNum);
    } else {
      const { lines, medianFontSize } = extractOrganizedLinesFromItems(rawItems);
      const pageParagraphs = groupLinesIntoParagraphs(
        lines,
        medianFontSize,
        pageNum
      );
      allParagraphs.push(...pageParagraphs);
    }

    if (pageNum % 5 === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  const cleanTitle = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const outlineChapters = await extractOutlineChapters(pdf);
  const organizedParagraphs = assignChaptersToParagraphs(
    allParagraphs,
    outlineChapters,
    cleanTitle || "Início do documento"
  );

  const isScanned =
    scannedPages.length > 0 &&
    (organizedParagraphs.length === 0 ||
      scannedPages.length >= Math.ceil(pdf.numPages / 2));

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: cleanTitle || "Documento PDF",
    fileName: file.name,
    fileSize: file.size,
    pageCount: pdf.numPages,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    lastParagraphIndex: 0,
    paragraphs: organizedParagraphs,
    isScanned,
    scannedPages,
    ocrApplied: false,
    pdfData: dataCopy,
  };
}

async function renderPdfPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível inicializar a renderização da página.");
  }
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas;
}

export async function runLocalOcrOnDocument(
  doc: PdfDocumentRecord,
  onProgress: (progress: OcrProgressState) => void
): Promise<PdfDocumentRecord> {
  const rawPdfData = doc.pdfData || (await getDocumentPdfDataFromDb(doc.id));
  if (!rawPdfData) {
    throw new Error(
      "Os dados originais do PDF não estão mais disponíveis neste dispositivo. Recarregue o arquivo para executar o OCR."
    );
  }

  const targetPages =
    doc.scannedPages.length > 0
      ? doc.scannedPages
      : Array.from({ length: doc.pageCount }, (_, i) => i + 1);

  onProgress({
    active: true,
    method: "local",
    currentPage: 0,
    totalPages: targetPages.length,
    pageProgress: 0,
    statusText: "Preparando mecanismo de leitura óptica local (português)...",
  });

  const pdf = await pdfjsLib.getDocument({ data: rawPdfData.slice(0) }).promise;
  let currentTrackedPage = 1;

  const worker = await createWorker("por", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress({
          active: true,
          method: "local",
          currentPage: currentTrackedPage,
          totalPages: targetPages.length,
          pageProgress: Math.round((m.progress || 0) * 100),
          statusText: `Reconhecendo texto localmente na página ${currentTrackedPage} de ${targetPages.length}...`,
        });
      }
    },
  });

  const ocrParagraphsByPage = new Map<number, PdfParagraph[]>();

  try {
    for (let i = 0; i < targetPages.length; i++) {
      const pageNum = targetPages[i];
      currentTrackedPage = i + 1;
      onProgress({
        active: true,
        method: "local",
        currentPage: i + 1,
        totalPages: targetPages.length,
        pageProgress: 5,
        statusText: `Renderizando página ${pageNum} para leitura óptica...`,
      });

      const canvas = await renderPdfPageToCanvas(pdf, pageNum, 2.0);
      const result = await worker.recognize(canvas);
      const parsed = buildParagraphsFromRawText(
        result.data.text || "",
        pageNum,
        "ocr-local"
      );
      ocrParagraphsByPage.set(pageNum, parsed);
    }
  } finally {
    await worker.terminate();
  }

  const keptExisting = doc.paragraphs.filter(
    (p) => !targetPages.includes(p.pageNumber)
  );
  const sortedCombined = [
    ...keptExisting,
    ...Array.from(ocrParagraphsByPage.values()).flat(),
  ].sort((a, b) => a.pageNumber - b.pageNumber);

  const outlineChapters = await extractOutlineChapters(pdf);
  const combined = assignChaptersToParagraphs(
    sortedCombined,
    outlineChapters,
    doc.title
  );

  return {
    ...doc,
    paragraphs: combined,
    ocrApplied: true,
    ocrMethod: "local",
    isScanned: combined.length === 0,
  };
}

export async function runAiOcrOnDocument(
  doc: PdfDocumentRecord,
  onProgress: (progress: OcrProgressState) => void
): Promise<PdfDocumentRecord> {
  const rawPdfData = doc.pdfData || (await getDocumentPdfDataFromDb(doc.id));
  if (!rawPdfData) {
    throw new Error(
      "Os dados originais do PDF não estão disponíveis neste dispositivo."
    );
  }

  const targetPages =
    doc.scannedPages.length > 0
      ? doc.scannedPages
      : Array.from({ length: doc.pageCount }, (_, i) => i + 1);

  const pdf = await pdfjsLib.getDocument({ data: rawPdfData.slice(0) }).promise;
  const ocrParagraphsByPage = new Map<number, PdfParagraph[]>();

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i];
    onProgress({
      active: true,
      method: "ai",
      currentPage: i + 1,
      totalPages: targetPages.length,
      pageProgress: Math.round(((i + 0.5) / targetPages.length) * 100),
      statusText: `Analisando página ${pageNum} com OCR assistido por IA...`,
    });

    const canvas = await renderPdfPageToCanvas(pdf, pageNum, 1.75);
    const dataUrl = canvas.toDataURL("image/png");
    const extracted = await requestAiOcr(dataUrl, pageNum);
    const parsed = buildParagraphsFromRawText(extracted, pageNum, "ocr-ai");
    ocrParagraphsByPage.set(pageNum, parsed);
  }

  const keptExisting = doc.paragraphs.filter(
    (p) => !targetPages.includes(p.pageNumber)
  );
  const sortedCombined = [
    ...keptExisting,
    ...Array.from(ocrParagraphsByPage.values()).flat(),
  ].sort((a, b) => a.pageNumber - b.pageNumber);

  const outlineChapters = await extractOutlineChapters(pdf);
  const combined = assignChaptersToParagraphs(
    sortedCombined,
    outlineChapters,
    doc.title
  );

  return {
    ...doc,
    paragraphs: combined,
    ocrApplied: true,
    ocrMethod: "ai",
    isScanned: combined.length === 0,
  };
}

/**
 * Generates an authentic multi-page Portuguese PDF binary in-memory so users can test
 * the complete PDF upload & extraction pipeline immediately.
 */
export function createSampleAccessiblePdfFile(): File {
  const escapePdfText = (input: string): string => {
    // WinAnsi / ASCII-safe encoding for built-in PDF Helvetica Type1 stream
    return input
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
  };

  const page1Lines: Array<{ text: string; size: number; y: number }> = [
    { text: "Guia de Leitura Confortavel e Foco", size: 18, y: 740 },
    {
      text: "Ler documentos longos nao precisa ser uma tarefa exaustiva. Quando um texto",
      size: 12,
      y: 700,
    },
    {
      text: "apresenta blocos densos e pouco espacamento, nosso cerebro precisa fazer um",
      size: 12,
      y: 682,
    },
    {
      text: "esforco adicional apenas para localizar a linha seguinte.",
      size: 12,
      y: 664,
    },
    { text: "Como a organizacao visual ajuda na compreensao", size: 15, y: 624 },
    {
      text: "Estudos sobre neurodiversidade mostram que fontes com formas distintas,",
      size: 12,
      y: 594,
    },
    {
      text: "como OpenDyslexic e Lexend, diminuem a confusao entre letras parecidas",
      size: 12,
      y: 576,
    },
    {
      text: "e reduzem a fadiga ocular durante a leitura prolongada.",
      size: 12,
      y: 558,
    },
    {
      text: "Alem disso, combinar o acompanhamento auditivo em voz alta com o destaque",
      size: 12,
      y: 522,
    },
    {
      text: "visual das palavras fortalece a memoria de trabalho e ajuda pessoas com",
      size: 12,
      y: 504,
    },
    {
      text: "TDAH a manterem o ritmo sem perder a concentracao no meio do paragrafo.",
      size: 12,
      y: 486,
    },
  ];

  const page2Lines: Array<{ text: string; size: number; y: number }> = [
    { text: "Estrategias praticas para textos complexos", size: 16, y: 740 },
    {
      text: "Em textos academicos, juridicos ou tecnicos, termos pouco usuais como",
      size: 12,
      y: 702,
    },
    {
      text: "neuroplasticidade, metacognicao e sobrecarga cognitiva podem interromper",
      size: 12,
      y: 684,
    },
    {
      text: "o fluxo de compreensao. Nesses momentos, pedir uma explicacao simples",
      size: 12,
      y: 666,
    },
    {
      text: "permite continuar a leitura com seguranca e autonomia.",
      size: 12,
      y: 648,
    },
    {
      text: "Experimente ajustar o fundo para Creme Dislexia, ativar a regua de",
      size: 12,
      y: 608,
    },
    {
      text: "leitura e ouvir este documento em voz alta para testar todos os recursos.",
      size: 12,
      y: 590,
    },
  ];

  const buildStream = (lines: Array<{ text: string; size: number; y: number }>) => {
    const cmds = lines
      .map(
        (l) =>
          `BT /F1 ${l.size} Tf 56 ${l.y} Td (${escapePdfText(l.text)}) Tj ET`
      )
      .join("\n");
    return cmds;
  };

  const s1 = buildStream(page1Lines);
  const s2 = buildStream(page2Lines);

  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    `5 0 obj\n<< /Length ${s1.length} >>\nstream\n${s1}\nendstream\nendobj\n`,
    `6 0 obj\n<< /Length ${s2.length} >>\nstream\n${s2}\nendstream\nendobj\n`,
    "7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
  ];

  let pdfStr = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdfStr.length);
    pdfStr += obj;
  }

  const xrefOffset = pdfStr.length;
  pdfStr += `xref\n0 ${objects.length + 1}\n`;
  pdfStr += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdfStr.length);
  for (let i = 0; i < pdfStr.length; i++) {
    bytes[i] = pdfStr.charCodeAt(i) & 0xff;
  }

  return new File([bytes], "Guia_Leitura_Acessivel.pdf", {
    type: "application/pdf",
  });
}
