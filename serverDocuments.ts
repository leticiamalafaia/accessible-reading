import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type express from "express";
import {
  type AuthenticatedRequest,
  createRateLimiter,
  requireAuth,
} from "./serverAuth.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DOCS_ROOT = path.resolve(__dirname, ".data", "user-docs");
const MAX_DOCS_PER_USER = 25;
const MAX_DOC_JSON_BYTES = 6 * 1024 * 1024; // 6 MB extracted text/metadata per doc
const VALID_DOC_ID = /^[a-zA-Z0-9_-]{3,80}$/;
const VALID_HIGHLIGHT_COLORS = new Set([
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
]);

interface StoredParagraph {
  id: string;
  pageNumber: number;
  text: string;
  sentences: string[];
  isHeading?: boolean;
}

interface StoredBookmark {
  paragraphIndex: number;
  pageNumber: number;
  chapter: string;
  snippet: string;
  updatedAt: number;
}

interface StoredHighlight {
  id: string;
  paragraphIndex: number;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  text: string;
  color: "yellow" | "green" | "blue" | "pink" | "purple";
  createdAt: number;
}

interface StoredStudyNote {
  id: string;
  title: string;
  sourceSnippet?: string;
  content: string;
  pageNumber?: number;
  createdAt: number;
}

export interface StoredAccountDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedAt: number;
  lastOpenedAt: number;
  lastParagraphIndex: number;
  paragraphs: StoredParagraph[];
  needsOcr: boolean;
  ocrCompleted: boolean;
  bookmark?: StoredBookmark | null;
  highlights?: StoredHighlight[];
  studyNotes?: StoredStudyNote[];
}

// In-memory cache per ownerKey for fast reads and read-only FS fallback
const ownerDocsCache = new Map<string, Map<string, StoredAccountDocument>>();

function getOwnerKey(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex")
    .slice(0, 32);
}

function resolveOwnerDir(ownerKey: string): string {
  const dir = path.resolve(USER_DOCS_ROOT, ownerKey);
  if (!dir.startsWith(USER_DOCS_ROOT + path.sep)) {
    throw new Error("Caminho de conta inválido.");
  }
  return dir;
}

function resolveDocPath(ownerKey: string, docId: string): string {
  if (!VALID_DOC_ID.test(docId)) {
    throw new Error("Identificador de documento inválido.");
  }
  const ownerDir = resolveOwnerDir(ownerKey);
  const filePath = path.resolve(ownerDir, `${docId}.json`);
  if (!filePath.startsWith(ownerDir + path.sep)) {
    throw new Error("Caminho de documento inválido.");
  }
  return filePath;
}

function loadOwnerDocsMap(ownerKey: string): Map<string, StoredAccountDocument> {
  const cached = ownerDocsCache.get(ownerKey);
  if (cached) return cached;

  const map = new Map<string, StoredAccountDocument>();
  try {
    const ownerDir = resolveOwnerDir(ownerKey);
    if (fs.existsSync(ownerDir)) {
      const files = fs.readdirSync(ownerDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const fullPath = path.join(ownerDir, file);
        try {
          const raw = fs.readFileSync(fullPath, "utf8");
          const parsed = JSON.parse(raw) as StoredAccountDocument;
          if (
            parsed &&
            typeof parsed.id === "string" &&
            VALID_DOC_ID.test(parsed.id) &&
            Array.isArray(parsed.paragraphs)
          ) {
            map.set(parsed.id, parsed);
          }
        } catch {
          // Skip malformed document file safely
        }
      }
    }
  } catch {
    // Keep operating in-memory if filesystem is unavailable
  }

  ownerDocsCache.set(ownerKey, map);
  return map;
}

function persistOwnerDocFile(
  ownerKey: string,
  doc: StoredAccountDocument
): void {
  try {
    const ownerDir = resolveOwnerDir(ownerKey);
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true, mode: 0o700 });
    }
    const targetPath = resolveDocPath(ownerKey, doc.id);
    const tmpPath = `${targetPath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(doc), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(tmpPath, targetPath);
  } catch {
    // Keep operating in-memory if filesystem is read-only
  }
}

function removeOwnerDocFile(ownerKey: string, docId: string): void {
  try {
    const targetPath = resolveDocPath(ownerKey, docId);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch {
    // Non-blocking cleanup failure
  }
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\u0000/g, "").slice(0, maxLen);
}

function sanitizeBookmark(raw: unknown): StoredBookmark | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const paragraphIndex = Number(b.paragraphIndex);
  const pageNumber = Number(b.pageNumber);
  if (!Number.isFinite(paragraphIndex) || paragraphIndex < 0) return null;
  return {
    paragraphIndex: Math.floor(paragraphIndex),
    pageNumber:
      Number.isFinite(pageNumber) && pageNumber >= 1
        ? Math.floor(pageNumber)
        : 1,
    chapter: sanitizeText(b.chapter, 200),
    snippet: sanitizeText(b.snippet, 300),
    updatedAt:
      typeof b.updatedAt === "number" && Number.isFinite(b.updatedAt)
        ? b.updatedAt
        : Date.now(),
  };
}

function sanitizeHighlights(raw: unknown): StoredHighlight[] {
  if (!Array.isArray(raw)) return [];
  const result: StoredHighlight[] = [];
  for (const item of raw.slice(0, 600)) {
    if (!item || typeof item !== "object") continue;
    const h = item as Record<string, unknown>;
    const id = sanitizeText(h.id, 80);
    const paragraphIndex = Number(h.paragraphIndex);
    const pageNumber = Number(h.pageNumber);
    const startOffset = Number(h.startOffset);
    const endOffset = Number(h.endOffset);
    const color =
      typeof h.color === "string" && VALID_HIGHLIGHT_COLORS.has(h.color)
        ? (h.color as StoredHighlight["color"])
        : "yellow";
    if (
      !id ||
      !Number.isFinite(paragraphIndex) ||
      paragraphIndex < 0 ||
      !Number.isFinite(startOffset) ||
      !Number.isFinite(endOffset) ||
      endOffset <= startOffset
    ) {
      continue;
    }
    result.push({
      id,
      paragraphIndex: Math.floor(paragraphIndex),
      pageNumber:
        Number.isFinite(pageNumber) && pageNumber >= 1
          ? Math.floor(pageNumber)
          : 1,
      startOffset: Math.max(0, Math.floor(startOffset)),
      endOffset: Math.floor(endOffset),
      text: sanitizeText(h.text, 2000),
      color,
      createdAt:
        typeof h.createdAt === "number" && Number.isFinite(h.createdAt)
          ? h.createdAt
          : Date.now(),
    });
  }
  return result;
}

function sanitizeStudyNotes(raw: unknown): StoredStudyNote[] {
  if (!Array.isArray(raw)) return [];
  const result: StoredStudyNote[] = [];
  for (const item of raw.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    const id = sanitizeText(n.id, 80);
    const title = sanitizeText(n.title, 200).trim();
    const content = sanitizeText(n.content, 15000).trim();
    if (!id || !title || !content) continue;
    const pageNumber = Number(n.pageNumber);
    result.push({
      id,
      title,
      sourceSnippet: n.sourceSnippet
        ? sanitizeText(n.sourceSnippet, 2000)
        : undefined,
      content,
      pageNumber:
        Number.isFinite(pageNumber) && pageNumber >= 1
          ? Math.floor(pageNumber)
          : undefined,
      createdAt:
        typeof n.createdAt === "number" && Number.isFinite(n.createdAt)
          ? n.createdAt
          : Date.now(),
    });
  }
  return result;
}

function sanitizeParagraphs(raw: unknown): StoredParagraph[] {
  if (!Array.isArray(raw)) return [];
  const paragraphs: StoredParagraph[] = [];
  for (let i = 0; i < Math.min(raw.length, 6000); i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const text = sanitizeText(p.text, 12000);
    const pageNumber = Number(p.pageNumber);
    const rawSentences = Array.isArray(p.sentences) ? p.sentences : [];
    const sentences = rawSentences
      .slice(0, 120)
      .map((s) => sanitizeText(s, 3000))
      .filter(Boolean);
    paragraphs.push({
      id: sanitizeText(p.id, 80) || `p-${i}`,
      pageNumber:
        Number.isFinite(pageNumber) && pageNumber >= 1
          ? Math.floor(pageNumber)
          : 1,
      text,
      sentences: sentences.length > 0 ? sentences : text ? [text] : [],
      isHeading: Boolean(p.isHeading),
    });
  }
  return paragraphs;
}

function sanitizeIncomingDocument(
  docId: string,
  body: unknown
): StoredAccountDocument | null {
  if (!VALID_DOC_ID.test(docId) || !body || typeof body !== "object") {
    return null;
  }
  const d = body as Record<string, unknown>;
  const title = sanitizeText(d.title, 260).trim() || "Documento PDF";
  const fileName = sanitizeText(d.fileName, 260).trim() || `${title}.pdf`;
  const fileSize = Number(d.fileSize);
  const pageCount = Number(d.pageCount);
  const uploadedAt = Number(d.uploadedAt);
  const lastOpenedAt = Number(d.lastOpenedAt);
  const lastParagraphIndex = Number(d.lastParagraphIndex);

  const paragraphs = sanitizeParagraphs(d.paragraphs);
  const maxIdx = Math.max(0, paragraphs.length - 1);

  return {
    id: docId,
    title,
    fileName,
    fileSize:
      Number.isFinite(fileSize) && fileSize >= 0 ? Math.floor(fileSize) : 0,
    pageCount:
      Number.isFinite(pageCount) && pageCount >= 1 ? Math.floor(pageCount) : 1,
    uploadedAt:
      Number.isFinite(uploadedAt) && uploadedAt > 0 ? uploadedAt : Date.now(),
    lastOpenedAt:
      Number.isFinite(lastOpenedAt) && lastOpenedAt > 0
        ? lastOpenedAt
        : Date.now(),
    lastParagraphIndex:
      Number.isFinite(lastParagraphIndex) && lastParagraphIndex >= 0
        ? Math.min(maxIdx, Math.floor(lastParagraphIndex))
        : 0,
    paragraphs,
    needsOcr: Boolean(d.needsOcr),
    ocrCompleted: Boolean(d.ocrCompleted),
    bookmark: sanitizeBookmark(d.bookmark),
    highlights: sanitizeHighlights(d.highlights),
    studyNotes: sanitizeStudyNotes(d.studyNotes),
  };
}

export function mountDocumentRoutes(app: express.Express): void {
  const docsRateLimiter = createRateLimiter(
    5 * 60 * 1000,
    180,
    "Muitas sincronizações seguidas. Aguarde alguns segundos."
  );

  app.use("/api/documents", requireAuth, docsRateLimiter, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    next();
  });

  app.get("/api/documents", (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ownerKey = getOwnerKey(authReq.authUser!.email);
    const docsMap = loadOwnerDocsMap(ownerKey);
    const documents = Array.from(docsMap.values()).sort(
      (a, b) => b.lastOpenedAt - a.lastOpenedAt
    );
    res.json({ documents });
  });

  app.put("/api/documents/:id", (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ownerKey = getOwnerKey(authReq.authUser!.email);
    const docId = req.params.id;

    if (!VALID_DOC_ID.test(docId)) {
      return res
        .status(400)
        .json({ error: "Identificador de documento inválido." });
    }

    const sanitized = sanitizeIncomingDocument(docId, req.body);
    if (!sanitized) {
      return res
        .status(400)
        .json({ error: "Dados do documento inválidos para salvamento." });
    }

    const serializedSize = Buffer.byteLength(JSON.stringify(sanitized), "utf8");
    if (serializedSize > MAX_DOC_JSON_BYTES) {
      return res.status(413).json({
        error:
          "Este documento excede o limite de texto sincronizado por arquivo (6 MB).",
      });
    }

    const docsMap = loadOwnerDocsMap(ownerKey);
    if (!docsMap.has(docId) && docsMap.size >= MAX_DOCS_PER_USER) {
      // Automatically evict the least-recently-opened document if account reaches cap
      const oldest = Array.from(docsMap.values()).sort(
        (a, b) => a.lastOpenedAt - b.lastOpenedAt
      )[0];
      if (oldest) {
        docsMap.delete(oldest.id);
        removeOwnerDocFile(ownerKey, oldest.id);
      }
    }

    docsMap.set(docId, sanitized);
    persistOwnerDocFile(ownerKey, sanitized);
    res.json({ document: sanitized });
  });

  app.patch("/api/documents/:id/state", (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ownerKey = getOwnerKey(authReq.authUser!.email);
    const docId = req.params.id;

    if (!VALID_DOC_ID.test(docId)) {
      return res
        .status(400)
        .json({ error: "Identificador de documento inválido." });
    }

    const docsMap = loadOwnerDocsMap(ownerKey);
    const existing = docsMap.get(docId);
    if (!existing) {
      return res
        .status(404)
        .json({ error: "Documento não encontrado nesta conta." });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const maxIdx = Math.max(0, existing.paragraphs.length - 1);

    if (typeof body.lastParagraphIndex === "number" && Number.isFinite(body.lastParagraphIndex)) {
      existing.lastParagraphIndex = Math.max(
        0,
        Math.min(maxIdx, Math.floor(body.lastParagraphIndex))
      );
    }
    if (typeof body.lastOpenedAt === "number" && Number.isFinite(body.lastOpenedAt)) {
      existing.lastOpenedAt = body.lastOpenedAt;
    } else {
      existing.lastOpenedAt = Date.now();
    }
    if (Object.prototype.hasOwnProperty.call(body, "bookmark")) {
      existing.bookmark = sanitizeBookmark(body.bookmark);
    }
    if (Object.prototype.hasOwnProperty.call(body, "highlights")) {
      existing.highlights = sanitizeHighlights(body.highlights);
    }
    if (Object.prototype.hasOwnProperty.call(body, "studyNotes")) {
      existing.studyNotes = sanitizeStudyNotes(body.studyNotes);
    }

    docsMap.set(docId, existing);
    persistOwnerDocFile(ownerKey, existing);
    res.json({ ok: true, lastOpenedAt: existing.lastOpenedAt });
  });

  app.delete("/api/documents/:id", (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ownerKey = getOwnerKey(authReq.authUser!.email);
    const docId = req.params.id;

    if (!VALID_DOC_ID.test(docId)) {
      return res
        .status(400)
        .json({ error: "Identificador de documento inválido." });
    }

    const docsMap = loadOwnerDocsMap(ownerKey);
    docsMap.delete(docId);
    removeOwnerDocFile(ownerKey, docId);
    res.json({ ok: true });
  });

  app.delete("/api/documents", (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ownerKey = getOwnerKey(authReq.authUser!.email);
    const docsMap = loadOwnerDocsMap(ownerKey);
    for (const docId of Array.from(docsMap.keys())) {
      removeOwnerDocFile(ownerKey, docId);
    }
    docsMap.clear();
    res.json({ ok: true });
  });
}
