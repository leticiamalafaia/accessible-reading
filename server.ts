import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import {
  createRateLimiter,
  mountAuthRoutes,
  requireAuth,
  securityHeadersMiddleware,
} from "./serverAuth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "A chave GEMINI_API_KEY não está configurada no ambiente do servidor."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function isTransientAiError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    raw.includes("503") ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("ECONNRESET") ||
    raw.includes("ETIMEDOUT") ||
    raw.includes("fetch failed")
  );
}

function isRateLimitBurstError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED");
}

async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isRateLimitBurstError(err)) {
      await new Promise((resolve) => setTimeout(resolve, 1600));
      return await fn();
    }
    if (!isTransientAiError(err)) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    return await fn();
  }
}

function extractSurroundingContext(
  documentText: string | undefined,
  selectedText: string | undefined,
  fallbackMax = 4000
): string {
  const doc = (documentText || "").trim();
  if (!doc) return "";
  const needle = (selectedText || "").trim().slice(0, 140);
  if (needle) {
    const idx = doc.indexOf(needle);
    if (idx >= 0) {
      const start = Math.max(0, idx - 1800);
      const end = Math.min(doc.length, idx + needle.length + 1800);
      return doc.slice(start, end);
    }
  }
  return doc.slice(0, fallbackMax);
}

function buildRepresentativeDocumentSlice(doc: string, maxChars = 45000): string {
  if (doc.length <= maxChars) return doc;
  const headSize = Math.floor(maxChars * 0.5);
  const midSize = Math.floor(maxChars * 0.25);
  const tailSize = maxChars - headSize - midSize;
  const midStart = Math.max(
    headSize,
    Math.floor((doc.length - midSize) / 2)
  );
  const tailStart = Math.max(midStart + midSize, doc.length - tailSize);
  return (
    doc.slice(0, headSize).trimEnd() +
    "\n\n[... parte intermediária do documento ...]\n\n" +
    doc.slice(midStart, midStart + midSize).trim() +
    "\n\n[... parte final do documento ...]\n\n" +
    doc.slice(tailStart).trimStart()
  );
}

function extractResponseText(response: {
  text?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
}): string {
  try {
    const direct = response.text?.trim();
    if (direct) return direct;
  } catch {
    // Fallback to candidate parts inspection
  }
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text || "")
    .join("")
    .trim();
}

function formatAiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("GEMINI_API_KEY")) {
    return {
      status: 500,
      message:
        "O serviço de IA ainda não está configurado. Verifique a chave GEMINI_API_KEY nas configurações.",
    };
  }
  if (raw.includes("403") || raw.includes("PERMISSION_DENIED") || raw.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message:
        "Chave de API inválida ou sem permissão. Verifique a chave selecionada no painel Settings > Secrets.",
    };
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Limite de solicitações de IA atingido no momento. Aguarde alguns instantes e tente novamente.",
    };
  }
  if (raw.includes("400") || raw.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message:
        "O trecho enviado não pôde ser processado. Tente selecionar um trecho menor ou outro bloco.",
    };
  }
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("DEADLINE_EXCEEDED") || raw.includes("ETIMEDOUT")) {
    return {
      status: 503,
      message:
        "O serviço de IA está temporariamente ocupado. Tente novamente em alguns segundos.",
    };
  }
  if (raw.includes("404") || raw.includes("NOT_FOUND")) {
    return {
      status: 502,
      message:
        "Serviço de modelo temporariamente indisponível. Tente novamente em instantes.",
    };
  }
  return {
    status: 500,
    message: "Não foi possível concluir a solicitação de IA. Tente novamente em instantes.",
  };
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: "20mb" }));

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  mountAuthRoutes(app);

  const aiRateLimiter = createRateLimiter(
    5 * 60 * 1000,
    45,
    "Limite temporário de solicitações de IA atingido. Aguarde alguns instantes."
  );
  app.use("/api/ai", requireAuth, aiRateLimiter);

  app.post("/api/ai/comprehension", async (req, res) => {
    try {
      const {
        action,
        documentText,
        selectedText,
        question,
        history,
      } = (req.body || {}) as {
        action:
          | "summary"
          | "visual_diagram"
          | "simplify"
          | "explain_word"
          | "explain_excerpt"
          | "study_notes"
          | "qa"
          | "difficult_words"
          | "suggested_questions";
        documentText?: string;
        selectedText?: string;
        question?: string;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };

      if (typeof action !== "string" || !action) {
        return res.status(400).json({ error: "Ação não especificada." });
      }

      const rawDocText = typeof documentText === "string" ? documentText.trim() : "";
      const targetSlice =
        typeof selectedText === "string" ? selectedText.trim().slice(0, 8000) : "";
      const contextSlice = buildRepresentativeDocumentSlice(rawDocText, 45000);
      const localContext = extractSurroundingContext(rawDocText, targetSlice, 4000);

      if (action === "suggested_questions" && rawDocText.length < 40) {
        return res.json({ questions: [] });
      }

      const ai = getAiClient();

      const systemInstruction =
        "Você é um assistente de leitura acessível em português brasileiro, especializado em ajudar pessoas com dislexia, TDAH e dificuldades de leitura a compreender documentos. " +
        "Escreva sempre com frases curtas e diretas, vocabulário simples e cotidiano, parágrafos breves com bastante respiro visual e tópicos claros com '• ' quando útil. " +
        "Não use marcações como **, ## ou tabelas Markdown; use apenas texto limpo e organizado. " +
        "Nunca substitua nem altere o texto original do usuário; sua função é explicar e facilitar a compreensão mantendo 100% da fidelidade ao conteúdo original. Não use jargões desnecessários nem introduções longas.";

      let prompt = "";

      switch (action) {
        case "summary":
          if (!contextSlice) {
            return res.status(400).json({
              error:
                "O documento ainda não possui texto extraído para resumir. Se for um PDF digitalizado, execute o OCR primeiro.",
            });
          }
          prompt =
            "Crie um resumo simples e organizado do texto abaixo.\n" +
            "Estrutura desejada (sem usar ** nem #):\n" +
            "1. Ideia principal (2 ou 3 frases curtas)\n" +
            "2. Pontos principais (até 5 tópicos curtos usando •)\n" +
            "3. Conclusão prática em uma frase.\n\n" +
            `Texto do documento:\n"""\n${contextSlice}\n"""`;
          break;

        case "visual_diagram": {
          const visualSource = targetSlice || contextSlice;
          if (!visualSource) {
            return res.status(400).json({
              error:
                "O documento ainda não possui texto para transformar em esquema visual.",
            });
          }
          prompt =
            "Pessoas com dislexia costumam compreender melhor informações organizadas de forma visual e espacial (diagramas, mapas e conexões). " +
            "Transforme o conteúdo abaixo em um Esquema Visual / Mapa de Ideias muito fácil de visualizar (sem usar **, # ou tabelas Markdown).\n" +
            "Use exatamente este formato espacial limpo:\n\n" +
            "Tema Central:\n" +
            "[Nome do assunto em 1 linha curta]\n\n" +
            "Mapa de Ideias e Conexões:\n" +
            "• Bloco 1: [Ideia] → [O que isso significa ou gera]\n" +
            "• Bloco 2: [Ideia] → [O que isso significa ou gera]\n" +
            "• Bloco 3: [Ideia] → [O que isso significa ou gera]\n\n" +
            "Passo a passo ou Ordem lógica:\n" +
            "1. [Primeiro passo ou ponto] →\n" +
            "2. [Segundo passo ou consequência] →\n" +
            "3. [Resultado final]\n\n" +
            `Conteúdo base:\n"""\n${visualSource}\n"""`;
          break;
        }

        case "simplify":
          if (!targetSlice && !contextSlice) {
            return res.status(400).json({
              error: "Selecione ou abra um trecho com texto para simplificar.",
            });
          }
          prompt =
            "Reescreva o trecho abaixo em linguagem simples, clara e acessível, preservando exatamente o significado e os fatos originais. Use frases curtas (máximo de 15 a 20 palavras por frase quando possível) e divida em pequenos blocos.\n\n" +
            `Trecho original:\n"""\n${targetSlice || contextSlice.slice(0, 4000)}\n"""`;
          break;

        case "explain_word":
          if (!targetSlice) {
            return res.status(400).json({
              error: "Digite ou selecione uma palavra para explicar.",
            });
          }
          prompt =
            `Explique o significado da palavra ou expressão "${targetSlice}" de forma muito simples e acolhedora.\n` +
            "Inclua:\n" +
            "• Significado em palavras fáceis\n" +
            "• Um exemplo curto do dia a dia\n" +
            (localContext
              ? `• Como ela está sendo usada neste trecho do documento.\n\nContexto próximo:\n"""\n${localContext.slice(0, 3000)}\n"""`
              : "");
          break;

        case "explain_excerpt":
          if (!targetSlice) {
            return res.status(400).json({
              error: "Selecione um trecho do texto para receber uma explicação.",
            });
          }
          prompt =
            "O leitor selecionou este trecho porque achou difícil de entender. Explique o que ele significa passo a passo, em linguagem simples e sem perder o sentido original.\n\n" +
            `Trecho selecionado:\n"""\n${targetSlice}\n"""\n\n` +
            (localContext
              ? `Contexto próximo no documento:\n"""\n${localContext}\n"""`
              : "");
          break;

        case "study_notes": {
          const studyTarget = targetSlice || contextSlice.slice(0, 8000);
          if (!studyTarget) {
            return res.status(400).json({
              error:
                "Selecione um trecho do texto para gerar resumo e dados de anotação.",
            });
          }
          prompt =
            "O leitor selecionou o trecho abaixo para estudar e fazer anotações. Extraia um resumo claro e os dados mais importantes fielmente do texto, sem inventar informações.\n" +
            "Organize a resposta em 3 blocos fáceis de copiar para o caderno (sem usar títulos com #, sem ** e sem tabelas):\n\n" +
            "Resumo rápido:\n" +
            "(2 a 3 frases curtas com a ideia central do trecho)\n\n" +
            "Dados e pontos importantes para anotar:\n" +
            "• Liste em tópicos curtos os fatos centrais, datas, números, nomes, regras, prazos ou causas/consequências presentes no trecho.\n\n" +
            "Palavras-chave e conceitos:\n" +
            "• Liste de 3 a 5 termos importantes do trecho com uma definição bem curta ao lado.\n\n" +
            `Trecho selecionado:\n"""\n${studyTarget}\n"""` +
            (localContext && targetSlice && localContext !== targetSlice
              ? `\n\nContexto próximo apenas para referência:\n"""\n${localContext.slice(0, 3000)}\n"""`
              : "");
          break;
        }

        case "difficult_words":
          if (!targetSlice && !contextSlice) {
            return res.status(400).json({
              error: "Não há texto suficiente para analisar palavras difíceis.",
            });
          }
          prompt =
            "Identifique até 6 palavras ou termos mais difíceis, técnicos ou pouco comuns no texto abaixo e explique cada um em uma linha simples com '• ', usando linguagem do dia a dia.\n\n" +
            `Texto:\n"""\n${targetSlice || contextSlice.slice(0, 6000)}\n"""`;
          break;

        case "suggested_questions":
          prompt =
            "Gere exatamente 3 perguntas curtas e úteis em português do Brasil que ajudam alguém a revisar e entender melhor o documento abaixo.\n\n" +
            `Texto:\n"""\n${contextSlice.slice(0, 12000)}\n"""`;
          break;

        case "qa": {
          const safeQuestion =
            typeof question === "string" ? question.trim().slice(0, 1000) : "";
          if (!safeQuestion) {
            return res.status(400).json({ error: "Digite uma pergunta para continuar." });
          }
          if (!contextSlice) {
            return res.status(400).json({
              error:
                "O documento ainda não possui texto extraído para responder perguntas. Execute o OCR primeiro se for um PDF digitalizado.",
            });
          }
          const conversationContext = (Array.isArray(history) ? history : [])
            .filter(
              (m) =>
                m &&
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content.trim().length > 0
            )
            .slice(-6)
            .map(
              (m) =>
                `${m.role === "user" ? "Leitor" : "Assistente"}: ${m.content.trim().slice(0, 1000)}`
            )
            .join("\n");

          prompt =
            "Responda à pergunta do leitor baseando-se exclusivamente no documento fornecido. Se a resposta não estiver no texto, diga isso com clareza e gentileza.\n" +
            "Mantenha a resposta curta, clara e fácil de ler.\n\n" +
            `Documento:\n"""\n${contextSlice}\n"""\n\n` +
            (conversationContext ? `Conversa anterior:\n${conversationContext}\n\n` : "") +
            `Pergunta atual do leitor: ${safeQuestion}`;
          break;
        }

        default:
          return res.status(400).json({ error: "Ação de compreensão desconhecida." });
      }

      if (action === "suggested_questions") {
        const response = await withTransientRetry(() =>
          ai.models.generateContent({
            model: "gemini-4-hydrogen",
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );
        const raw = (extractResponseText(response) || "[]")
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "");
        let questions: string[] = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            questions = parsed
              .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
              .slice(0, 3);
          }
        } catch {
          questions = [];
        }
        return res.json({ questions });
      }

      const response = await withTransientRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const generatedText = extractResponseText(response);
      if (!generatedText) {
        return res.status(502).json({
          error:
            "O assistente não retornou texto para este trecho. Tente novamente ou selecione um trecho menor.",
        });
      }

      res.json({
        text: generatedText,
      });
    } catch (error) {
      const formatted = formatAiError(error);
      if (formatted.status === 500) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Erro inesperado em /api/ai/comprehension:", msg);
      }
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/ai/ocr", async (req, res) => {
    try {
      const { imageBase64, mimeType, pageNumber } = req.body as {
        imageBase64: string;
        mimeType?: string;
        pageNumber?: number;
      };

      if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
        return res.status(400).json({ error: "Imagem da página não enviada." });
      }

      const allowedOcrMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
      const safeMimeType =
        typeof mimeType === "string" && allowedOcrMimes.has(mimeType)
          ? mimeType
          : "image/png";
      const safePageNum =
        typeof pageNumber === "number" && Number.isFinite(pageNumber) && pageNumber > 0
          ? Math.floor(pageNumber)
          : 1;

      const ai = getAiClient();
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await withTransientRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeMimeType,
                  data: cleanBase64,
                },
              },
              {
                text:
                  `Extraia todo o texto visível desta página digitalizada (página ${safePageNum}) na ordem natural de leitura. ` +
                  "Junte quebras de linha artificiais dentro do mesmo parágrafo para que o texto flua naturalmente, mas preserve separações reais entre títulos e parágrafos com uma linha em branco. " +
                  "Não adicione comentários nem invente palavras; retorne apenas o texto extraído.",
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ text: (response.text || "").trim() });
    } catch (error) {
      const formatted = formatAiError(error);
      if (formatted.status === 500) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Erro inesperado em /api/ai/ocr:", msg);
      }
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // In-memory LRU cache for TTS WAV payloads to conserve Free Tier quota
  const ttsCache = new Map<string, string>();
  const MAX_TTS_CACHE_ITEMS = 60;
  let ttsQuotaCooldownUntil = 0;

  app.post("/api/ai/tts", async (req, res) => {
    try {
      const { text, voiceName, readingTone, forceRetry } = req.body as {
        text: string;
        voiceName?: string;
        readingTone?: "calmo" | "animado" | "serio" | "divertido" | "pausado";
        forceRetry?: boolean;
      };

      if (!text?.trim()) {
        return res.status(400).json({ error: "Texto vazio para narração." });
      }

      const voiceStyles: Record<string, string> = {
        Kore: "Voz feminina brasileira humana, firme e nítida",
        Zephyr: "Voz feminina brasileira suave, brilhante e empática",
        Aoede: "Voz feminina brasileira leve, fluida e natural",
        Leda: "Voz feminina brasileira jovem e expressiva",
        Sulafat: "Voz feminina brasileira calorosa e acolhedora",
        Callirhoe: "Voz feminina brasileira descontraída e amigável",
        Autonoe: "Voz feminina brasileira alegre e clara",
        Despina: "Voz feminina brasileira macia e serena",
        Erinome: "Voz feminina brasileira muito bem articulada",
        Gacrux: "Voz feminina brasileira madura e estável",
        Laomedeia: "Voz feminina brasileira positiva e envolvente",
        Pulcherrima: "Voz feminina brasileira dinâmica e presente",
        Achernar: "Voz feminina brasileira doce e suave",
        Vindemiatrix: "Voz feminina brasileira delicada e gentil",
        Puck: "Voz masculina jovem brasileira leve e animada",
        Charon: "Voz masculina brasileira calma e informativa",
        Fenrir: "Voz masculina brasileira profunda de narrador",
        Orus: "Voz masculina brasileira firme e equilibrada",
        Enceladus: "Voz masculina brasileira suave e relaxante",
        Iapetus: "Voz masculina brasileira limpa e bem articulada",
        Umbriel: "Voz masculina brasileira tranquila e descontraída",
        Algieba: "Voz masculina brasileira grave e fluida",
        Algenib: "Voz masculina brasileira grave e marcante",
        Rasalgethi: "Voz masculina brasileira profissional de documentário",
        Alnilam: "Voz masculina brasileira confiante e objetiva",
        Schedar: "Voz masculina brasileira constante e didática",
        Achird: "Voz masculina brasileira amigável e gentil",
        Zubenelgenubi: "Voz masculina brasileira natural estilo conversa",
        Sadachbia: "Voz masculina brasileira vibrante e energética",
        Sadaltager: "Voz masculina brasileira serena e didática",
      };

      const safeVoice =
        voiceName && Object.prototype.hasOwnProperty.call(voiceStyles, voiceName)
          ? voiceName
          : "Kore";
      const safeTone = readingTone || "calmo";
      const safeText = text.trim().slice(0, 5000);
      if (!/[\p{L}\p{N}]/u.test(safeText)) {
        return res.status(400).json({
          error: "O trecho selecionado não contém palavras legíveis para narração.",
        });
      }

      const cacheKey = `${safeVoice}:${safeTone}:${safeText}`;
      const cachedAudio = ttsCache.get(cacheKey);
      if (cachedAudio) {
        // Refresh LRU order
        ttsCache.delete(cacheKey);
        ttsCache.set(cacheKey, cachedAudio);
        return res.json({ audioBase64: cachedAudio, mimeType: "audio/wav", cached: true });
      }

      if (forceRetry) {
        ttsQuotaCooldownUntil = 0;
      } else if (Date.now() < ttsQuotaCooldownUntil) {
        return res.json({
          code: "QUOTA_EXCEEDED",
          fallbackToBrowser: true,
          error:
            "A cota gratuita diária da Voz Natural (IA) foi atingida. A leitura continuará com a voz local do seu dispositivo.",
        });
      }

      const toneInstructions: Record<string, string> = {
        calmo:
          "com ritmo calmo, acolhedor, sereno e pausas suaves de respiração em português do Brasil.",
        animado:
          "com ritmo animado, vibrante, entusiasmado e energia positiva envolvente em português do Brasil.",
        serio:
          "com tom sério, firme, formal, respeitoso e dicção precisa e objetiva em português do Brasil.",
        divertido:
          "com tom divertido, leve, sorridente, expressivo e descontraído em português do Brasil.",
        pausado:
          "com ritmo bem pausado, lento e didático, dando tempo claro entre frases e ideias em português do Brasil.",
      };

      const combinedStyle = `${voiceStyles[safeVoice]}, ${
        toneInstructions[safeTone] || toneInstructions.calmo
      }`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "Chave GEMINI_API_KEY não configurada no servidor.",
        });
      }

      const ttsAi = new GoogleGenAI({
        apiKey,
        httpOptions: {
          apiVersion: "v1alpha",
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      const synthesizeWithModel = async (modelId: string) => {
        const response = await ttsAi.models.generateContent({
          model: modelId,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: safeText,
                  speechMetadata: {
                    style: combinedStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: safeVoice },
              },
            },
          },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      };

      let base64Audio: string | undefined;
      try {
        base64Audio = await synthesizeWithModel("gemini-3.8-flash-lite-tts");
      } catch (primaryErr) {
        const rawMsg =
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        const isQuotaOrRate =
          rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED");
        if (isQuotaOrRate) {
          base64Audio = await synthesizeWithModel("gemini-3.8-flash-tts");
        } else {
          throw primaryErr;
        }
      }

      if (!base64Audio) {
        return res.status(500).json({
          error: "Não foi possível gerar o áudio natural com IA no momento.",
        });
      }

      if (ttsCache.size >= MAX_TTS_CACHE_ITEMS) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({ audioBase64: base64Audio, mimeType: "audio/wav" });
    } catch (error) {
      const formatted = formatAiError(error);
      if (formatted.status === 429) {
        ttsQuotaCooldownUntil = Date.now() + 2 * 60 * 1000;
        return res.json({
          code: "QUOTA_EXCEEDED",
          fallbackToBrowser: true,
          error:
            "A cota gratuita diária da Voz Natural (IA) foi atingida. A leitura continuará com a voz local do seu dispositivo.",
        });
      }
      if (formatted.status === 500) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Erro inesperado em /api/ai/tts:", msg);
      }
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Handle malformed JSON or oversized body payloads cleanly without HTML/stack noise
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const errObj = err as { type?: string; status?: number } | null;
      if (errObj?.type === "entity.too.large" || errObj?.status === 413) {
        return res.status(413).json({
          error: "A imagem ou texto enviado é grande demais para uma única solicitação.",
        });
      }
      if (errObj?.type === "entity.parse.failed" || errObj?.status === 400) {
        return res.status(400).json({
          error: "Formato de solicitação inválido.",
        });
      }
      return next(err);
    }
  );

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Leitura Acessível server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
