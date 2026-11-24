import {
  DocumentStudyNote,
  PdfDocumentRecord,
  ReadingBookmark,
  TextHighlight,
} from "../types/reader";
import { getAuthHeaders, getAuthToken } from "./authClient";

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function fetchAccountDocuments(): Promise<PdfDocumentRecord[]> {
  if (!getAuthToken()) return [];
  const response = await fetch("/api/documents", {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  const data = await parseJsonSafely<{
    documents?: PdfDocumentRecord[];
    error?: string;
  }>(response);
  if (!response.ok || !data || !Array.isArray(data.documents)) {
    throw new Error(
      data?.error || "Não foi possível carregar os PDFs salvos na sua conta."
    );
  }
  return data.documents;
}

export async function saveAccountDocument(
  doc: PdfDocumentRecord
): Promise<PdfDocumentRecord | null> {
  if (!getAuthToken()) return null;
  const { pdfData: _omitBinary, ...payload } = doc;
  const response = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  const data = await parseJsonSafely<{ document?: PdfDocumentRecord }>(response);
  return data?.document || null;
}

export async function updateAccountDocumentState(
  docId: string,
  patch: {
    lastParagraphIndex?: number;
    lastOpenedAt?: number;
    bookmark?: ReadingBookmark | null;
    highlights?: TextHighlight[];
    studyNotes?: DocumentStudyNote[];
  }
): Promise<boolean> {
  if (!getAuthToken()) return false;
  const response = await fetch(
    `/api/documents/${encodeURIComponent(docId)}/state`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(patch),
    }
  );
  return response.ok;
}

export async function deleteAccountDocument(docId: string): Promise<void> {
  if (!getAuthToken()) return;
  await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });
}

export async function clearAccountDocuments(): Promise<void> {
  if (!getAuthToken()) return;
  await fetch("/api/documents", {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });
}
