import { PdfDocumentRecord } from "../types/reader";

const DB_NAME = "claraleitura_local_db";
const DB_VERSION = 2;
const STORE_NAME = "documents";
const BLOB_STORE_NAME = "pdf_blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("lastOpenedAt", "lastOpenedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
        db.createObjectStore(BLOB_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

interface StoredLocalDocument extends PdfDocumentRecord {
  ownerEmail?: string;
}

function normalizeOwnerEmail(ownerEmail?: string): string | undefined {
  const clean = ownerEmail?.trim().toLowerCase();
  return clean || undefined;
}

export async function saveDocumentToDb(
  doc: PdfDocumentRecord,
  ownerEmail?: string
): Promise<void> {
  const db = await openDb();
  const { pdfData, ...lightweightDoc } = doc;
  const normalizedOwner = normalizeOwnerEmail(ownerEmail);
  const recordToStore: StoredLocalDocument = normalizedOwner
    ? { ...lightweightDoc, ownerEmail: normalizedOwner }
    : lightweightDoc;

  return new Promise((resolve, reject) => {
    const stores = pdfData ? [STORE_NAME, BLOB_STORE_NAME] : [STORE_NAME];
    const tx = db.transaction(stores, "readwrite");
    tx.objectStore(STORE_NAME).put(recordToStore);
    if (pdfData) {
      tx.objectStore(BLOB_STORE_NAME).put({ id: doc.id, pdfData });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllDocumentsFromDb(
  ownerEmail?: string
): Promise<PdfDocumentRecord[]> {
  const db = await openDb();
  const normalizedOwner = normalizeOwnerEmail(ownerEmail);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const rawItems = req.result as StoredLocalDocument[];
      const filtered = normalizedOwner
        ? rawItems.filter(
            (item) =>
              item.ownerEmail === normalizedOwner || !item.ownerEmail
          )
        : rawItems;

      const items = filtered.map((item) => {
        const { pdfData: _legacy, ownerEmail: _owner, ...rest } = item;
        return rest as PdfDocumentRecord;
      });
      items.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDocumentFromDb(
  id: string
): Promise<PdfDocumentRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as PdfDocumentRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getDocumentPdfDataFromDb(
  id: string
): Promise<ArrayBuffer | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BLOB_STORE_NAME, STORE_NAME], "readonly");
    const blobReq = tx.objectStore(BLOB_STORE_NAME).get(id);
    blobReq.onsuccess = () => {
      const blobRecord = blobReq.result as
        | { id: string; pdfData?: ArrayBuffer }
        | undefined;
      if (blobRecord?.pdfData) {
        resolve(blobRecord.pdfData);
        return;
      }
      // Fallback for records created in v1 before pdf_blobs store existed
      const docReq = tx.objectStore(STORE_NAME).get(id);
      docReq.onsuccess = () => {
        const docRecord = docReq.result as PdfDocumentRecord | undefined;
        resolve(docRecord?.pdfData);
      };
      docReq.onerror = () => reject(docReq.error);
    };
    blobReq.onerror = () => reject(blobReq.error);
  });
}

export async function updateDocumentProgressInDb(
  id: string,
  lastParagraphIndex: number,
  ownerEmail?: string
): Promise<void> {
  const db = await openDb();
  const normalizedOwner = normalizeOwnerEmail(ownerEmail);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const doc = req.result as StoredLocalDocument | undefined;
      if (!doc) {
        resolve();
        return;
      }
      doc.lastParagraphIndex = lastParagraphIndex;
      doc.lastOpenedAt = Date.now();
      if (normalizedOwner && !doc.ownerEmail) {
        doc.ownerEmail = normalizedOwner;
      }
      store.put(doc);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteDocumentFromDb(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.objectStore(BLOB_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllDocumentsFromDb(
  ownerEmail?: string
): Promise<void> {
  const db = await openDb();
  const normalizedOwner = normalizeOwnerEmail(ownerEmail);
  if (!normalizedOwner) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(BLOB_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], "readwrite");
    const docStore = tx.objectStore(STORE_NAME);
    const blobStore = tx.objectStore(BLOB_STORE_NAME);
    const req = docStore.getAll();
    req.onsuccess = () => {
      const all = req.result as StoredLocalDocument[];
      for (const item of all) {
        if (item.ownerEmail === normalizedOwner || !item.ownerEmail) {
          docStore.delete(item.id);
          blobStore.delete(item.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
