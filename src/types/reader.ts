export type AppView = "reader" | "library" | "settings" | "privacy";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: number;
  lastLoginAt?: number;
  managedByEnv?: boolean;
}

export interface AuthStatusResponse {
  ownerEmail: string;
  needsAdminSetup: boolean;
  adminConfiguredByEnv: boolean;
  registrationEnabled: boolean;
}

export type ReadingFontFamily =
  | "opendyslexic"
  | "lexend"
  | "atkinson"
  | "jakarta"
  | "lora"
  | "ibm-mono";

export type ColorLensOverlay = "none" | "amber" | "mint" | "blue" | "rose";

export type ReadingThemePreset =
  | "papel-suave"
  | "creme-dislexia"
  | "salvia-calma"
  | "azul-sereno"
  | "noturno-suave"
  | "alto-contraste"
  | "personalizado";

export type HighlightStyle = "soft-block" | "underline" | "focus-outline" | "bold-only";

export type ColumnWidthOption = "narrow" | "ideal" | "wide";

export type TtsEngine = "browser" | "gemini";

export type GeminiVoiceName =
  | "Kore"
  | "Zephyr"
  | "Aoede"
  | "Leda"
  | "Sulafat"
  | "Callirhoe"
  | "Autonoe"
  | "Despina"
  | "Erinome"
  | "Gacrux"
  | "Laomedeia"
  | "Pulcherrima"
  | "Achernar"
  | "Vindemiatrix"
  | "Puck"
  | "Charon"
  | "Fenrir"
  | "Orus"
  | "Enceladus"
  | "Iapetus"
  | "Umbriel"
  | "Algieba"
  | "Algenib"
  | "Rasalgethi"
  | "Alnilam"
  | "Schedar"
  | "Achird"
  | "Zubenelgenubi"
  | "Sadachbia"
  | "Sadaltager";

export type UnlimitedVoiceProfileId =
  | "padrao"
  | "suave-clara"
  | "didatica-pausada"
  | "jovem-leve"
  | "narrador-grave"
  | "firme-objetiva"
  | "leve-aguda"
  | "locucao-serena";

export type ReadingTone = "calmo" | "animado" | "serio" | "divertido" | "pausado";

export type ReaderViewMode = "page" | "block" | "all";

export type HighlightColor = "amarelo" | "verde" | "azul" | "rosa" | "roxo";

export interface TextHighlight {
  id: string;
  paragraphIndex: number;
  pageNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
  color: HighlightColor;
  createdAt: number;
}

export interface ReadingBookmark {
  paragraphIndex: number;
  pageNumber: number;
  chapter?: string;
  snippet: string;
  updatedAt: number;
}

export interface PdfParagraph {
  id: string;
  pageNumber: number;
  chapter?: string;
  text: string;
  sentences: string[];
  isHeading: boolean;
  source: "text" | "ocr-local" | "ocr-ai";
}

export interface PdfDocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: number;
  lastOpenedAt: number;
  lastParagraphIndex: number;
  paragraphs: PdfParagraph[];
  isScanned: boolean;
  scannedPages: number[];
  ocrApplied: boolean;
  ocrMethod?: "local" | "ai";
  bookmark?: ReadingBookmark | null;
  highlights?: TextHighlight[];
  studyNotes?: DocumentStudyNote[];
  /** Stored only locally in IndexedDB; optional raw buffer for re-running OCR on demand */
  pdfData?: ArrayBuffer;
}

export interface DocumentStudyNote {
  id: string;
  title: string;
  sourceSnippet?: string;
  content: string;
  pageNumber?: number;
  createdAt: number;
}

export interface ReaderSettings {
  fontFamily: ReadingFontFamily;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  columnWidth: ColumnWidthOption;
  themePreset: ReadingThemePreset;
  customBgColor: string;
  customTextColor: string;
  contrastLevel: number;
  highlightStyle: HighlightStyle;
  viewMode: ReaderViewMode;
  blockDivisionEnabled: boolean;
  guidedBlockMode: boolean;
  readingRulerEnabled: boolean;
  focusMode: boolean;
  colorLensOverlay: ColorLensOverlay;
  readingChunkGoal: number;
  ttsEngine: TtsEngine;
  ttsRate: number;
  readingTone: ReadingTone;
  browserVoiceURI: string;
  browserVoiceProfile: UnlimitedVoiceProfileId;
  browserVoicePitch: number;
  aiVoiceName: GeminiVoiceName;
  aiConsentGiven: boolean;
}

export type ComprehensionAction =
  | "summary"
  | "visual_diagram"
  | "simplify"
  | "explain_word"
  | "explain_excerpt"
  | "study_notes"
  | "difficult_words"
  | "qa";

export interface ComprehensionEntry {
  id: string;
  action: ComprehensionAction;
  title: string;
  sourceSnippet?: string;
  content: string;
  createdAt: number;
}

export interface OcrProgressState {
  active: boolean;
  method: "local" | "ai";
  currentPage: number;
  totalPages: number;
  pageProgress: number;
  statusText: string;
}
