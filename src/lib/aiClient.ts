import {
  ComprehensionAction,
  GeminiVoiceName,
  ReadingTone,
} from "../types/reader";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut && !externalSignal?.aborted) {
      throw new Error(
        "A solicitação demorou mais que o esperado. Tente novamente em instantes."
      );
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new Error(
      "Não foi possível conectar ao servidor no momento. Verifique sua conexão e tente novamente."
    );
  } finally {
    window.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    const raw = await response.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function requestComprehension(params: {
  action: ComprehensionAction | "suggested_questions";
  documentText?: string;
  selectedText?: string;
  question?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ text?: string; questions?: string[] }> {
  const response = await fetchWithTimeout(
    "/api/ai/comprehension",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    38000
  );

  const data = await parseJsonSafely<{
    text?: string;
    questions?: string[];
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Não foi possível obter resposta do assistente agora. Tente novamente em instantes."
    );
  }

  return data || {};
}

export async function requestAiOcr(
  imageBase64: string,
  pageNumber: number
): Promise<string> {
  const response = await fetchWithTimeout(
    "/api/ai/ocr",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        mimeType: "image/png",
        pageNumber,
      }),
    },
    45000
  );

  const data = await parseJsonSafely<{ text?: string; error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(
      data?.error || "Erro ao reconhecer o texto da página com IA."
    );
  }

  return data?.text || "";
}

export class TtsQuotaError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "TtsQuotaError";
  }
}

export async function requestAiTts(
  text: string,
  voiceName: GeminiVoiceName,
  readingTone: ReadingTone = "calmo",
  signal?: AbortSignal,
  forceRetry?: boolean
): Promise<string> {
  const response = await fetchWithTimeout(
    "/api/ai/tts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName, readingTone, forceRetry }),
    },
    22000,
    signal
  );

  const data = await parseJsonSafely<{
    audioBase64?: string;
    mimeType?: string;
    code?: string;
    error?: string;
  }>(response);

  if (response.status === 429 || data?.code === "QUOTA_EXCEEDED") {
    throw new TtsQuotaError(
      data?.error ||
        "Limite gratuito diário da Voz Natural (IA) atingido. Continuando com a voz local."
    );
  }

  if (!response.ok || !data?.audioBase64) {
    throw new Error(
      data?.error || "Não foi possível gerar a narração com voz natural."
    );
  }

  return `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
}
