import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GeminiVoiceName,
  PdfParagraph,
  ReadingTone,
  TtsEngine,
  UnlimitedVoiceProfileId,
} from "../types/reader";
import { requestAiTts, TtsQuotaError } from "../lib/aiClient";
import {
  AI_VOICE_OPTIONS,
  isGoogleBrowserVoice,
  normalizeVoiceLang,
  READING_TONE_OPTIONS,
  scoreBrowserVoiceNaturalness,
  UNLIMITED_VOICE_PROFILES,
} from "../lib/settingsStorage";

export interface SpeechPosition {
  paragraphIndex: number;
  sentenceIndex: number;
  wordIndex: number;
}

export interface VoiceSwitchInfo {
  fromLabel: string;
  toLabel: string;
  reason: string;
}

interface SentenceOffsetMap {
  paragraphIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  text: string;
  words: string[];
}

interface BuiltSpeechSegment {
  text: string;
  startParagraphIndex: number;
  endParagraphIndex: number;
  nextParagraphIndex: number;
  sentenceMaps: SentenceOffsetMap[];
}

interface UseSpeechReaderProps {
  paragraphs: PdfParagraph[];
  ttsEngine: TtsEngine;
  rate: number;
  readingTone: ReadingTone;
  browserVoiceURI: string;
  browserVoiceProfile?: UnlimitedVoiceProfileId;
  browserVoicePitch?: number;
  aiVoiceName: GeminiVoiceName;
  onParagraphChange?: (index: number) => void;
  onAiConsentNeeded?: (pendingParagraphIndex: number) => void;
  aiConsentGiven: boolean;
}

function buildSpeechSegment(
  paragraphs: PdfParagraph[],
  startIdx: number,
  maxChars: number,
  maxParagraphs: number
): BuiltSpeechSegment | null {
  let cursor = startIdx;
  while (
    cursor < paragraphs.length &&
    !/[\p{L}\p{N}]/u.test(paragraphs[cursor].text)
  ) {
    cursor += 1;
  }
  if (cursor >= paragraphs.length) return null;

  let combined = "";
  const sentenceMaps: SentenceOffsetMap[] = [];
  const firstIdx = cursor;
  let lastIdx = cursor;
  let count = 0;

  while (cursor < paragraphs.length && count < maxParagraphs) {
    const para = paragraphs[cursor];
    const cleanPara = para.text.replace(/\s+/g, " ").trim();
    if (!/[\p{L}\p{N}]/u.test(cleanPara)) {
      cursor += 1;
      continue;
    }

    let separator = "";
    if (combined.length > 0) {
      separator = /[.!?…:]$/.test(combined) ? " " : ". ";
    }

    if (
      combined.length > 0 &&
      combined.length + separator.length + cleanPara.length > maxChars
    ) {
      break;
    }

    combined += separator;
    const sentences = para.sentences.length > 0 ? para.sentences : [cleanPara];

    for (let s = 0; s < sentences.length; s++) {
      const sText = sentences[s].replace(/\s+/g, " ").trim();
      if (!sText) continue;
      if (s > 0) {
        combined += " ";
      }
      const startChar = combined.length;
      combined += sText;
      const endChar = combined.length;
      sentenceMaps.push({
        paragraphIndex: cursor,
        sentenceIndex: s,
        startChar,
        endChar,
        text: sText,
        words: sText.split(/\s+/).filter(Boolean),
      });
    }

    lastIdx = cursor;
    count += 1;
    cursor += 1;

    if (combined.length >= maxChars) {
      break;
    }
  }

  if (sentenceMaps.length === 0) return null;

  return {
    text: combined,
    startParagraphIndex: firstIdx,
    endParagraphIndex: lastIdx,
    nextParagraphIndex: cursor,
    sentenceMaps,
  };
}

function findPositionAtChar(
  sentenceMaps: SentenceOffsetMap[],
  charTarget: number
): SpeechPosition {
  for (let i = 0; i < sentenceMaps.length; i++) {
    const map = sentenceMaps[i];
    if (charTarget <= map.endChar || i === sentenceMaps.length - 1) {
      const localChar = Math.max(0, charTarget - map.startChar);
      const ratio =
        map.text.length > 0 ? Math.min(0.999, localChar / map.text.length) : 0;
      const wordIndex = Math.min(
        Math.max(0, map.words.length - 1),
        Math.floor(ratio * map.words.length)
      );
      return {
        paragraphIndex: map.paragraphIndex,
        sentenceIndex: map.sentenceIndex,
        wordIndex,
      };
    }
  }
  const first = sentenceMaps[0];
  return {
    paragraphIndex: first?.paragraphIndex ?? 0,
    sentenceIndex: first?.sentenceIndex ?? 0,
    wordIndex: 0,
  };
}

function findWordPositionFromCharIndex(
  sentenceMaps: SentenceOffsetMap[],
  charIndex: number
): SpeechPosition {
  for (let i = 0; i < sentenceMaps.length; i++) {
    const map = sentenceMaps[i];
    if (charIndex <= map.endChar || i === sentenceMaps.length - 1) {
      const slice = map.text
        .slice(0, Math.max(0, charIndex - map.startChar + 1))
        .trim();
      const wIdx = slice
        ? Math.max(
            0,
            Math.min(map.words.length - 1, slice.split(/\s+/).length - 1)
          )
        : 0;
      return {
        paragraphIndex: map.paragraphIndex,
        sentenceIndex: map.sentenceIndex,
        wordIndex: wIdx,
      };
    }
  }
  const first = sentenceMaps[0];
  return {
    paragraphIndex: first?.paragraphIndex ?? 0,
    sentenceIndex: first?.sentenceIndex ?? 0,
    wordIndex: 0,
  };
}

interface BrowserUtteranceChunk {
  text: string;
  sentenceMaps: SentenceOffsetMap[];
}

function splitTextAtNaturalLimit(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const parts: string[] = [];
  let remaining = clean;
  while (remaining.length > maxChars) {
    const windowSlice = remaining.slice(0, maxChars + 1);
    let splitAt = -1;
    for (const sep of [". ", "! ", "? ", "; ", ": ", ", ", " — ", " - "]) {
      const idx = windowSlice.lastIndexOf(sep);
      if (idx >= Math.floor(maxChars * 0.45)) {
        splitAt = Math.max(splitAt, idx + sep.length);
      }
    }
    if (splitAt <= 0) {
      const lastSpace = windowSlice.lastIndexOf(" ");
      splitAt = lastSpace >= Math.floor(maxChars * 0.4) ? lastSpace + 1 : maxChars;
    }
    const piece = remaining.slice(0, splitAt).trim();
    if (piece) parts.push(piece);
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function buildBrowserUtteranceChunks(
  segment: BuiltSpeechSegment,
  maxChunkChars: number
): BrowserUtteranceChunk[] {
  const chunks: BrowserUtteranceChunk[] = [];
  let currentText = "";
  let currentMaps: SentenceOffsetMap[] = [];

  const flushChunk = () => {
    if (currentMaps.length > 0 && currentText.trim()) {
      chunks.push({ text: currentText.trim(), sentenceMaps: currentMaps });
    }
    currentText = "";
    currentMaps = [];
  };

  for (const map of segment.sentenceMaps) {
    const subParts = splitTextAtNaturalLimit(map.text, maxChunkChars);
    for (let i = 0; i < subParts.length; i++) {
      const partText = subParts[i];
      const sep = currentText.length > 0 ? " " : "";
      if (
        currentText.length > 0 &&
        currentText.length + sep.length + partText.length > maxChunkChars
      ) {
        flushChunk();
      }
      const prefix = currentText.length > 0 ? " " : "";
      const startChar = currentText.length + prefix.length;
      currentText += prefix + partText;
      const endChar = currentText.length;
      currentMaps.push({
        paragraphIndex: map.paragraphIndex,
        sentenceIndex: map.sentenceIndex,
        startChar,
        endChar,
        text: partText,
        words: partText.split(/\s+/).filter(Boolean),
      });
    }
  }
  flushChunk();
  return chunks;
}

export function useSpeechReader({
  paragraphs,
  ttsEngine,
  rate,
  readingTone,
  browserVoiceURI,
  browserVoiceProfile = "padrao",
  browserVoicePitch = 1.0,
  aiVoiceName,
  onParagraphChange,
  onAiConsentNeeded,
  aiConsentGiven,
}: UseSpeechReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const [voiceSwitchInfo, setVoiceSwitchInfo] =
    useState<VoiceSwitchInfo | null>(null);
  const [actualEngine, setActualEngine] = useState<TtsEngine>(ttsEngine);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [position, setPosition] = useState<SpeechPosition>({
    paragraphIndex: 0,
    sentenceIndex: 0,
    wordIndex: -1,
  });

  const activeRunIdRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const startTimeoutRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const geminiQuotaExhaustedRef = useRef(false);
  const forceRetryNextAiTtsRef = useRef(false);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const lastReportedParaRef = useRef(-1);
  const positionRef = useRef(position);
  positionRef.current = position;
  const paragraphsRef = useRef(paragraphs);
  paragraphsRef.current = paragraphs;
  const onParagraphChangeRef = useRef(onParagraphChange);
  onParagraphChangeRef.current = onParagraphChange;
  const onAiConsentNeededRef = useRef(onAiConsentNeeded);
  onAiConsentNeededRef.current = onAiConsentNeeded;

  const updatePositionIfChanged = useCallback((next: SpeechPosition) => {
    const curr = positionRef.current;
    if (
      curr.paragraphIndex === next.paragraphIndex &&
      curr.sentenceIndex === next.sentenceIndex &&
      curr.wordIndex === next.wordIndex
    ) {
      return;
    }
    setPosition(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (ttsAbortRef.current && previewAudioRef.current === null && !isPlayingRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.onended = null;
      previewAudioRef.current.onerror = null;
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore restricted browser speechSynthesis errors
      }
    }
    setIsPreviewLoading(false);
    setPreviewingVoiceId(null);
  }, []);

  const stopAll = useCallback(() => {
    activeRunIdRef.current += 1;
    clearTimers();
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    stopPreview();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore restricted browser speechSynthesis errors
      }
    }
    if (audioElRef.current) {
      audioElRef.current.onended = null;
      audioElRef.current.ontimeupdate = null;
      audioElRef.current.onerror = null;
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    isPlayingRef.current = false;
    isPausedRef.current = false;
    lastReportedParaRef.current = -1;
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
  }, [clearTimers, stopPreview]);

  const refreshVoices = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const sorted = [...voices].sort((a, b) => {
      const diff =
        scoreBrowserVoiceNaturalness(b) - scoreBrowserVoiceNaturalness(a);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
    setAvailableVoices(sorted);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    refreshVoices();
    const t1 = window.setTimeout(refreshVoices, 300);
    const t2 = window.setTimeout(refreshVoices, 1200);
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [refreshVoices]);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  useEffect(() => {
    if (ttsEngine === "browser") {
      setActualEngine("browser");
      setVoiceSwitchInfo(null);
    } else if (!geminiQuotaExhaustedRef.current) {
      setActualEngine("gemini");
    }
  }, [ttsEngine]);

  const resolveChosenBrowserVoice = useCallback(() => {
    return (
      availableVoices.find((v) => v.voiceURI === browserVoiceURI) ||
      availableVoices.find((v) => normalizeVoiceLang(v.lang).startsWith("pt-br")) ||
      availableVoices.find((v) => normalizeVoiceLang(v.lang).startsWith("pt"))
    );
  }, [availableVoices, browserVoiceURI]);

  const activeBrowserVoiceLabel =
    resolveChosenBrowserVoice()?.name.split(/\s+/).slice(0, 3).join(" ") ||
    "Google / Dispositivo (PT-BR)";

  const reportParagraphOnce = useCallback((pIdx: number) => {
    if (lastReportedParaRef.current !== pIdx) {
      lastReportedParaRef.current = pIdx;
      onParagraphChangeRef.current?.(pIdx);
    }
  }, []);

  const speakSegmentBrowser = useCallback(
    (startParaIdx: number, runId: number, waitAfterCancel = false) => {
      if (runId !== activeRunIdRef.current) return;
      const list = paragraphsRef.current;

      const chosenVoice = resolveChosenBrowserVoice();
      const needsShortGoogleChunks =
        !chosenVoice ||
        !chosenVoice.localService ||
        isGoogleBrowserVoice(chosenVoice);

      const segment = buildSpeechSegment(
        list,
        startParaIdx,
        needsShortGoogleChunks ? 520 : 420,
        needsShortGoogleChunks ? 2 : 3
      );
      if (!segment) {
        stopAll();
        return;
      }

      const chunks = buildBrowserUtteranceChunks(
        segment,
        needsShortGoogleChunks ? 180 : 420
      );
      if (chunks.length === 0) {
        stopAll();
        return;
      }

      setActualEngine("browser");

      const speakChunkAt = (chunkIdx: number) => {
        if (runId !== activeRunIdRef.current) return;
        const chunk = chunks[chunkIdx];
        if (!chunk) {
          if (segment.nextParagraphIndex < paragraphsRef.current.length) {
            speakSegmentBrowser(segment.nextParagraphIndex, runId, false);
          } else {
            stopAll();
          }
          return;
        }

        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          setTtsError(
            "Este navegador não oferece suporte à leitura em voz alta local."
          );
          stopAll();
          return;
        }

        const toneCfg =
          READING_TONE_OPTIONS.find((t) => t.id === readingTone) ||
          READING_TONE_OPTIONS[0];
        const profileCfg =
          UNLIMITED_VOICE_PROFILES.find((p) => p.id === browserVoiceProfile) ||
          UNLIMITED_VOICE_PROFILES[0];
        const safeRate = Number.isFinite(rate) ? rate : 1.0;
        const safePitch = Number.isFinite(browserVoicePitch)
          ? browserVoicePitch
          : 1.0;
        const effectiveRate = Math.max(
          0.5,
          Math.min(
            2.2,
            safeRate * toneCfg.browserRateFactor * profileCfg.rateFactor
          )
        );
        const effectivePitch = Math.max(
          0.55,
          Math.min(
            1.65,
            toneCfg.browserPitch * profileCfg.pitchFactor * safePitch
          )
        );

        const firstPos = chunk.sentenceMaps[0];
        updatePositionIfChanged({
          paragraphIndex: firstPos.paragraphIndex,
          sentenceIndex: firstPos.sentenceIndex,
          wordIndex: 0,
        });
        reportParagraphOnce(firstPos.paragraphIndex);

        const utterance = new SpeechSynthesisUtterance(chunk.text);
        utterance.lang = chosenVoice?.lang
          ? normalizeVoiceLang(chosenVoice.lang)
          : "pt-br";
        utterance.rate = effectiveRate;
        utterance.pitch = effectivePitch;
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        let boundaryFired = false;
        let hasStarted = false;
        let finished = false;
        const wordsAll = chunk.text.split(/\s+/).filter(Boolean);
        const estimatedDurationMs = Math.max(
          900,
          (wordsAll.length / (2.7 * effectiveRate)) * 1000
        );
        const tickMs = 150;
        let elapsedMs = 0;

        if (fallbackTimerRef.current !== null) {
          window.clearInterval(fallbackTimerRef.current);
        }

        const advanceToNext = () => {
          if (finished || runId !== activeRunIdRef.current) return;
          finished = true;
          if (fallbackTimerRef.current !== null) {
            window.clearInterval(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          if (chunkIdx + 1 < chunks.length) {
            speakChunkAt(chunkIdx + 1);
          } else if (segment.nextParagraphIndex < paragraphsRef.current.length) {
            speakSegmentBrowser(segment.nextParagraphIndex, runId, false);
          } else {
            stopAll();
          }
        };

        fallbackTimerRef.current = window.setInterval(() => {
          if (isPausedRef.current || runId !== activeRunIdRef.current || finished) {
            return;
          }
          if (window.speechSynthesis.paused && !isPausedRef.current) {
            window.speechSynthesis.resume();
          }
          elapsedMs += tickMs;
          // Watchdog: recover if Chrome remote Google voice silently drops onend
          if (
            hasStarted &&
            !window.speechSynthesis.speaking &&
            !window.speechSynthesis.pending &&
            elapsedMs > 450
          ) {
            advanceToNext();
            return;
          }
          if (elapsedMs > estimatedDurationMs + 4500) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            advanceToNext();
            return;
          }
          if (boundaryFired) return;
          const ratio = Math.min(0.99, elapsedMs / estimatedDurationMs);
          const approxChar = Math.floor(ratio * chunk.text.length);
          const pos = findPositionAtChar(chunk.sentenceMaps, approxChar);
          updatePositionIfChanged(pos);
          reportParagraphOnce(pos.paragraphIndex);
        }, tickMs);

        utterance.onstart = () => {
          hasStarted = true;
        };

        utterance.onboundary = (event) => {
          if (runId !== activeRunIdRef.current || finished) return;
          hasStarted = true;
          if (typeof event.charIndex === "number") {
            boundaryFired = true;
            const pos = findWordPositionFromCharIndex(
              chunk.sentenceMaps,
              event.charIndex
            );
            updatePositionIfChanged(pos);
            reportParagraphOnce(pos.paragraphIndex);
          }
        };

        utterance.onend = () => {
          advanceToNext();
        };

        utterance.onerror = (ev) => {
          if (fallbackTimerRef.current !== null) {
            window.clearInterval(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          if (ev.error === "interrupted" || ev.error === "canceled") return;
          if (runId === activeRunIdRef.current && !finished) {
            setTtsError("A voz do navegador encontrou um erro neste trecho.");
            stopAll();
          }
        };

        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        window.setTimeout(() => {
          if (
            runId === activeRunIdRef.current &&
            !finished &&
            !hasStarted &&
            !window.speechSynthesis.speaking &&
            !window.speechSynthesis.pending &&
            !isPausedRef.current
          ) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume();
          }
        }, 450);
      };

      if (waitAfterCancel) {
        startTimeoutRef.current = window.setTimeout(() => speakChunkAt(0), 70);
      } else {
        speakChunkAt(0);
      }
    },
    [
      browserVoicePitch,
      browserVoiceProfile,
      rate,
      readingTone,
      reportParagraphOnce,
      resolveChosenBrowserVoice,
      stopAll,
      updatePositionIfChanged,
    ]
  );

  const fetchOrGetCachedGeminiAudio = useCallback(
    async (
      text: string,
      voice: GeminiVoiceName,
      tone: ReadingTone,
      signal?: AbortSignal
    ) => {
      const normalized = text.trim();
      const cacheKey = `${voice}:${tone}:${normalized}`;
      const existing = audioCacheRef.current.get(cacheKey);
      if (existing) return existing;
      const shouldForceRetry = forceRetryNextAiTtsRef.current;
      forceRetryNextAiTtsRef.current = false;
      const generated = await requestAiTts(
        normalized,
        voice,
        tone,
        signal,
        shouldForceRetry
      );
      if (audioCacheRef.current.size >= 40) {
        const oldestKey = audioCacheRef.current.keys().next().value;
        if (oldestKey) audioCacheRef.current.delete(oldestKey);
      }
      audioCacheRef.current.set(cacheKey, generated);
      return generated;
    },
    []
  );

  const activateQuotaFallback = useCallback(() => {
    geminiQuotaExhaustedRef.current = true;
    const aiLabel =
      AI_VOICE_OPTIONS.find((v) => v.id === aiVoiceName)?.name || "Clara";
    const info: VoiceSwitchInfo = {
      fromLabel: `${aiLabel} (Voz Natural IA)`,
      toLabel: `${activeBrowserVoiceLabel} (Dispositivo)`,
      reason:
        "A cota gratuita diária da API externa de voz foi atingida. A leitura continua automaticamente e sem limites com a voz do seu aparelho.",
    };
    setVoiceSwitchInfo(info);
    setTtsNotice(
      `Troca automática de voz: de ${info.fromLabel} para ${info.toLabel}. ${info.reason}`
    );
    setActualEngine("browser");
  }, [activeBrowserVoiceLabel, aiVoiceName]);

  const speakSegmentGemini = useCallback(
    async (startParaIdx: number, runId: number) => {
      if (runId !== activeRunIdRef.current) return;
      const list = paragraphsRef.current;

      const segment = buildSpeechSegment(list, startParaIdx, 2400, 12);
      if (!segment) {
        stopAll();
        return;
      }

      const cacheKey = `${aiVoiceName}:${readingTone}:${segment.text}`;
      let audioSrc = audioCacheRef.current.get(cacheKey);

      if (!audioSrc && geminiQuotaExhaustedRef.current) {
        activateQuotaFallback();
        speakSegmentBrowser(segment.startParagraphIndex, runId, false);
        return;
      }

      setActualEngine("gemini");
      updatePositionIfChanged({
        paragraphIndex: segment.startParagraphIndex,
        sentenceIndex: 0,
        wordIndex: 0,
      });
      reportParagraphOnce(segment.startParagraphIndex);

      if (!audioSrc) {
        if (ttsAbortRef.current) ttsAbortRef.current.abort();
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        setIsLoadingAudio(true);
        try {
          audioSrc = await fetchOrGetCachedGeminiAudio(
            segment.text,
            aiVoiceName,
            readingTone,
            controller.signal
          );
          if (runId !== activeRunIdRef.current) return;
        } catch (err) {
          if (runId !== activeRunIdRef.current) return;
          if (err instanceof TtsQuotaError) {
            setIsLoadingAudio(false);
            activateQuotaFallback();
            speakSegmentBrowser(segment.startParagraphIndex, runId, false);
            return;
          }
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          // Seamless fallback to local voice if external TTS fails or times out
          setIsLoadingAudio(false);
          setTtsNotice(
            `Voz Natural indisponível neste trecho. Continuando automaticamente com ${activeBrowserVoiceLabel}.`
          );
          speakSegmentBrowser(segment.startParagraphIndex, runId, false);
          return;
        } finally {
          if (runId === activeRunIdRef.current) {
            setIsLoadingAudio(false);
          }
          if (ttsAbortRef.current === controller) {
            ttsAbortRef.current = null;
          }
        }
      }

      if (runId !== activeRunIdRef.current) return;

      const audio = new Audio(audioSrc);
      audio.playbackRate = rate;
      audioElRef.current = audio;

      const totalChars = Math.max(1, segment.text.length);

      audio.ontimeupdate = () => {
        if (
          runId !== activeRunIdRef.current ||
          !Number.isFinite(audio.duration) ||
          audio.duration <= 0
        ) {
          return;
        }
        const ratio = Math.min(0.999, audio.currentTime / audio.duration);
        const charTarget = Math.floor(ratio * totalChars);
        const pos = findPositionAtChar(segment.sentenceMaps, charTarget);
        updatePositionIfChanged(pos);
        reportParagraphOnce(pos.paragraphIndex);
      };

      audio.onended = () => {
        if (runId !== activeRunIdRef.current) return;
        if (segment.nextParagraphIndex < paragraphsRef.current.length) {
          speakSegmentGemini(segment.nextParagraphIndex, runId);
        } else {
          stopAll();
        }
      };

      audio.onerror = () => {
        if (runId === activeRunIdRef.current) {
          setTtsError("Não foi possível reproduzir o áudio gerado.");
          stopAll();
        }
      };

      try {
        await audio.play();
      } catch (playErr) {
        if (
          runId !== activeRunIdRef.current ||
          (playErr instanceof DOMException && playErr.name === "AbortError")
        ) {
          return;
        }
        setTtsError(
          "O navegador bloqueou a reprodução automática. Clique em Ouvir leitura novamente."
        );
        stopAll();
      }
    },
    [
      activateQuotaFallback,
      aiVoiceName,
      fetchOrGetCachedGeminiAudio,
      rate,
      readingTone,
      reportParagraphOnce,
      speakSegmentBrowser,
      stopAll,
      updatePositionIfChanged,
    ]
  );

  const playFrom = useCallback(
    (
      paragraphIndex: number,
      _sentenceIndex = 0,
      overrideEngine?: TtsEngine
    ) => {
      const list = paragraphsRef.current;
      if (list.length === 0) return;
      const safeIndex = Math.max(0, Math.min(list.length - 1, paragraphIndex));
      const targetEngine = overrideEngine || ttsEngine;
      setTtsError(null);

      if (targetEngine === "gemini" && !aiConsentGiven && !overrideEngine) {
        onAiConsentNeededRef.current?.(safeIndex);
        return;
      }

      stopAll();
      const runId = activeRunIdRef.current;
      isPlayingRef.current = true;
      isPausedRef.current = false;
      setIsPlaying(true);
      setIsPaused(false);

      if (targetEngine === "gemini") {
        speakSegmentGemini(safeIndex, runId);
      } else {
        speakSegmentBrowser(safeIndex, runId, true);
      }
    },
    [aiConsentGiven, speakSegmentBrowser, speakSegmentGemini, stopAll, ttsEngine]
  );

  const resetGeminiQuotaFlag = useCallback(() => {
    geminiQuotaExhaustedRef.current = false;
    forceRetryNextAiTtsRef.current = true;
    setVoiceSwitchInfo(null);
    setTtsNotice(null);
  }, []);

  const speakBrowserUtterance = useCallback(
    (
      sampleText: string,
      preferredVoiceURI?: string,
      onFinish?: () => void,
      overrideProfileId?: UnlimitedVoiceProfileId
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onFinish?.();
        return;
      }
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current);
      }
      previewTimerRef.current = window.setTimeout(() => {
        previewTimerRef.current = null;
        const toneCfg =
          READING_TONE_OPTIONS.find((t) => t.id === readingTone) ||
          READING_TONE_OPTIONS[0];
        const profileCfg =
          UNLIMITED_VOICE_PROFILES.find(
            (p) => p.id === (overrideProfileId || browserVoiceProfile)
          ) || UNLIMITED_VOICE_PROFILES[0];
        const safePitch = Number.isFinite(browserVoicePitch)
          ? browserVoicePitch
          : 1.0;
        const found =
          (preferredVoiceURI &&
            availableVoices.find((v) => v.voiceURI === preferredVoiceURI)) ||
          resolveChosenBrowserVoice();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = found?.lang ? normalizeVoiceLang(found.lang) : "pt-br";
        utterance.rate = Math.max(
          0.5,
          Math.min(
            2.2,
            rate * toneCfg.browserRateFactor * profileCfg.rateFactor
          )
        );
        utterance.pitch = Math.max(
          0.55,
          Math.min(
            1.65,
            toneCfg.browserPitch * profileCfg.pitchFactor * safePitch
          )
        );
        if (found) utterance.voice = found;
        utterance.onend = () => onFinish?.();
        utterance.onerror = () => onFinish?.();
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 60);
    },
    [
      availableVoices,
      browserVoicePitch,
      browserVoiceProfile,
      rate,
      readingTone,
      resolveChosenBrowserVoice,
    ]
  );

  const previewVoice = useCallback(
    async (
      engine: TtsEngine,
      voiceId: string,
      sampleText = "Olá! Esta é uma prévia da minha voz para tornar sua leitura mais confortável."
    ) => {
      setTtsError(null);
      stopAll();
      setPreviewingVoiceId(`${engine}:${voiceId}`);

      if (engine === "browser") {
        if (voiceId.startsWith("profile:")) {
          const profileId = voiceId.replace(
            "profile:",
            ""
          ) as UnlimitedVoiceProfileId;
          speakBrowserUtterance(
            sampleText,
            browserVoiceURI,
            () => setPreviewingVoiceId(null),
            profileId
          );
          return;
        }
        speakBrowserUtterance(sampleText, voiceId, () =>
          setPreviewingVoiceId(null)
        );
        return;
      }

      const cachedKey = `${voiceId}:${readingTone}:${sampleText.trim()}`;
      if (
        geminiQuotaExhaustedRef.current &&
        !audioCacheRef.current.has(cachedKey)
      ) {
        activateQuotaFallback();
        speakBrowserUtterance(sampleText, browserVoiceURI, () =>
          setPreviewingVoiceId(null)
        );
        return;
      }

      if (ttsAbortRef.current) ttsAbortRef.current.abort();
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      setIsPreviewLoading(true);
      try {
        const audioSrc = await fetchOrGetCachedGeminiAudio(
          sampleText,
          voiceId as GeminiVoiceName,
          readingTone,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setIsPreviewLoading(false);
        const audio = new Audio(audioSrc);
        audio.playbackRate = rate;
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.onerror = () => setPreviewingVoiceId(null);
        await audio.play();
      } catch (err) {
        setIsPreviewLoading(false);
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          setPreviewingVoiceId(null);
          return;
        }
        if (err instanceof TtsQuotaError) {
          activateQuotaFallback();
          speakBrowserUtterance(sampleText, browserVoiceURI, () =>
            setPreviewingVoiceId(null)
          );
          return;
        }
        setPreviewingVoiceId(null);
        setTtsError(
          err instanceof Error
            ? err.message
            : "Não foi possível reproduzir a prévia da voz."
        );
      } finally {
        if (ttsAbortRef.current === controller) {
          ttsAbortRef.current = null;
        }
      }
    },
    [
      activateQuotaFallback,
      browserVoiceURI,
      fetchOrGetCachedGeminiAudio,
      rate,
      readingTone,
      speakBrowserUtterance,
      stopAll,
    ]
  );

  const pause = useCallback(() => {
    if (!isPlayingRef.current || isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);

    if (audioElRef.current) {
      audioElRef.current.pause();
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (!isPlayingRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);

    if (audioElRef.current) {
      audioElRef.current.play().catch(() => {});
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlayingRef.current) {
      playFrom(
        positionRef.current.paragraphIndex,
        positionRef.current.sentenceIndex
      );
    } else if (isPausedRef.current) {
      resume();
    } else {
      pause();
    }
  }, [pause, playFrom, resume]);

  const skipNext = useCallback(() => {
    const list = paragraphsRef.current;
    if (list.length === 0) return;
    const nextIdx = Math.min(
      list.length - 1,
      positionRef.current.paragraphIndex + 1
    );
    if (isPlayingRef.current) {
      playFrom(nextIdx, 0);
    } else {
      updatePositionIfChanged({
        paragraphIndex: nextIdx,
        sentenceIndex: 0,
        wordIndex: -1,
      });
      onParagraphChangeRef.current?.(nextIdx);
    }
  }, [playFrom, updatePositionIfChanged]);

  const skipPrev = useCallback(() => {
    const prevIdx = Math.max(0, positionRef.current.paragraphIndex - 1);
    if (isPlayingRef.current) {
      playFrom(prevIdx, 0);
    } else {
      updatePositionIfChanged({
        paragraphIndex: prevIdx,
        sentenceIndex: 0,
        wordIndex: -1,
      });
      onParagraphChangeRef.current?.(prevIdx);
    }
  }, [playFrom, updatePositionIfChanged]);

  const jumpToParagraph = useCallback(
    (idx: number) => {
      const list = paragraphsRef.current;
      const clamped =
        list.length > 0
          ? Math.max(0, Math.min(list.length - 1, idx))
          : Math.max(0, idx);
      if (isPlayingRef.current) {
        playFrom(clamped, 0);
      } else {
        updatePositionIfChanged({
          paragraphIndex: clamped,
          sentenceIndex: 0,
          wordIndex: -1,
        });
        onParagraphChangeRef.current?.(clamped);
      }
    },
    [playFrom, updatePositionIfChanged]
  );

  const syncInitialPosition = useCallback((idx: number) => {
    const safeIdx = Math.max(0, idx);
    lastReportedParaRef.current = safeIdx;
    setPosition({ paragraphIndex: safeIdx, sentenceIndex: 0, wordIndex: -1 });
  }, []);

  const jumpToPage = useCallback(
    (pageNumber: number) => {
      const list = paragraphsRef.current;
      const idx = list.findIndex((p) => p.pageNumber >= pageNumber);
      const targetIdx = idx >= 0 ? idx : Math.max(0, list.length - 1);
      jumpToParagraph(targetIdx);
    },
    [jumpToParagraph]
  );

  useEffect(() => {
    setPosition((prev) => {
      if (paragraphs.length === 0) {
        if (
          prev.paragraphIndex === 0 &&
          prev.sentenceIndex === 0 &&
          prev.wordIndex === -1
        ) {
          return prev;
        }
        return { paragraphIndex: 0, sentenceIndex: 0, wordIndex: -1 };
      }
      if (prev.paragraphIndex < 0 || prev.paragraphIndex >= paragraphs.length) {
        return { paragraphIndex: 0, sentenceIndex: 0, wordIndex: -1 };
      }
      return prev;
    });
  }, [paragraphs.length]);

  const prevRateRef = useRef(rate);
  const prevToneRef = useRef(readingTone);
  const prevProfileRef = useRef(browserVoiceProfile);
  const prevPitchRef = useRef(browserVoicePitch);

  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.playbackRate = rate;
    }
    const rateChanged = prevRateRef.current !== rate;
    const toneChanged = prevToneRef.current !== readingTone;
    const profileChanged = prevProfileRef.current !== browserVoiceProfile;
    const pitchChanged = prevPitchRef.current !== browserVoicePitch;
    prevRateRef.current = rate;
    prevToneRef.current = readingTone;
    prevProfileRef.current = browserVoiceProfile;
    prevPitchRef.current = browserVoicePitch;

    if (
      (rateChanged || toneChanged || profileChanged || pitchChanged) &&
      isPlaying &&
      !isPaused &&
      actualEngine === "browser"
    ) {
      activeRunIdRef.current += 1;
      const runId = activeRunIdRef.current;
      clearTimers();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      speakSegmentBrowser(positionRef.current.paragraphIndex, runId, true);
    }
  }, [
    actualEngine,
    browserVoicePitch,
    browserVoiceProfile,
    clearTimers,
    isPaused,
    isPlaying,
    rate,
    readingTone,
    speakSegmentBrowser,
  ]);

  return useMemo(
    () => ({
      isPlaying,
      isPaused,
      isLoadingAudio,
      previewingVoiceId,
      isPreviewLoading,
      ttsError,
      setTtsError,
      ttsNotice,
      setTtsNotice,
      voiceSwitchInfo,
      setVoiceSwitchInfo,
      actualEngine,
      activeBrowserVoiceLabel,
      resetGeminiQuotaFlag,
      availableVoices,
      refreshVoices,
      position,
      playFrom,
      previewVoice,
      stopPreview,
      pause,
      resume,
      stopAll,
      togglePlayPause,
      skipNext,
      skipPrev,
      jumpToParagraph,
      jumpToPage,
      syncInitialPosition,
    }),
    [
      activeBrowserVoiceLabel,
      actualEngine,
      availableVoices,
      isLoadingAudio,
      isPaused,
      isPlaying,
      isPreviewLoading,
      jumpToPage,
      jumpToParagraph,
      pause,
      playFrom,
      position,
      previewVoice,
      previewingVoiceId,
      refreshVoices,
      resetGeminiQuotaFlag,
      resume,
      skipNext,
      skipPrev,
      stopAll,
      stopPreview,
      syncInitialPosition,
      togglePlayPause,
      ttsError,
      ttsNotice,
      voiceSwitchInfo,
    ]
  );
}
