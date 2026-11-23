import {
  ColorLensOverlay,
  ColumnWidthOption,
  GeminiVoiceName,
  HighlightColor,
  ReaderSettings,
  ReadingFontFamily,
  ReadingThemePreset,
  ReadingTone,
  UnlimitedVoiceProfileId,
} from "../types/reader";

const SETTINGS_STORAGE_KEY = "claraleitura_settings_v1";

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontFamily: "lexend",
  fontSize: 19,
  lineHeight: 1.85,
  letterSpacing: 0.03,
  wordSpacing: 0.1,
  columnWidth: "ideal",
  themePreset: "papel-suave",
  customBgColor: "#F8FAFC",
  customTextColor: "#1E293B",
  contrastLevel: 100,
  highlightStyle: "soft-block",
  viewMode: "page",
  blockDivisionEnabled: true,
  guidedBlockMode: false,
  readingRulerEnabled: false,
  focusMode: false,
  colorLensOverlay: "none",
  readingChunkGoal: 8,
  ttsEngine: "browser",
  ttsRate: 1.0,
  readingTone: "calmo",
  browserVoiceURI: "",
  browserVoiceProfile: "padrao",
  browserVoicePitch: 1.0,
  aiVoiceName: "Kore",
  aiConsentGiven: false,
};

export interface ThemePaletteDefinition {
  id: Exclude<ReadingThemePreset, "personalizado">;
  name: string;
  description: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  highlightSentenceBg: string;
  highlightWordBg: string;
  highlightWordText: string;
  isDark: boolean;
}

export const READING_THEMES: ThemePaletteDefinition[] = [
  {
    id: "papel-suave",
    name: "Papel Suave",
    description: "Branco fosco que evita reflexo intenso",
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    border: "#E2E8F0",
    text: "#1E293B",
    muted: "#475569",
    highlightSentenceBg: "#E0F2FE",
    highlightWordBg: "#BAE6FD",
    highlightWordText: "#0C4A6E",
    isDark: false,
  },
  {
    id: "creme-dislexia",
    name: "Creme Dislexia",
    description: "Tom amarelado suave que reduz cansaço visual",
    bg: "#F6EFE2",
    surface: "#FCF8F0",
    border: "#E6DAC3",
    text: "#2C231D",
    muted: "#5E4F44",
    highlightSentenceBg: "#FDE68A",
    highlightWordBg: "#FCD34D",
    highlightWordText: "#451A03",
    isDark: false,
  },
  {
    id: "salvia-calma",
    name: "Sálvia Calma",
    description: "Verde pastel que promove foco tranquilo",
    bg: "#EBF3EE",
    surface: "#F4F9F6",
    border: "#CFE0D6",
    text: "#182C23",
    muted: "#415D50",
    highlightSentenceBg: "#CCFBF1",
    highlightWordBg: "#99F6E4",
    highlightWordText: "#134E4A",
    isDark: false,
  },
  {
    id: "azul-sereno",
    name: "Azul Sereno",
    description: "Filtro azul suave para maior conforto",
    bg: "#EAF2F9",
    surface: "#F5F9FD",
    border: "#CBDCEB",
    text: "#162536",
    muted: "#3E546B",
    highlightSentenceBg: "#DBEAFE",
    highlightWordBg: "#93C5FD",
    highlightWordText: "#1E3A8A",
    isDark: false,
  },
  {
    id: "noturno-suave",
    name: "Noturno Suave",
    description: "Fundo escuro fosco para leitura à noite",
    bg: "#171C24",
    surface: "#1F2631",
    border: "#2E3746",
    text: "#E2E8F0",
    muted: "#94A3B8",
    highlightSentenceBg: "#1E3A5F",
    highlightWordBg: "#0284C7",
    highlightWordText: "#FFFFFF",
    isDark: true,
  },
  {
    id: "alto-contraste",
    name: "Alto Contraste",
    description: "Máxima nitidez para baixa visão",
    bg: "#09090B",
    surface: "#141418",
    border: "#3F3F46",
    text: "#FEF08A",
    muted: "#D4D4D8",
    highlightSentenceBg: "#27272A",
    highlightWordBg: "#FACC15",
    highlightWordText: "#09090B",
    isDark: true,
  },
];

export const FONT_OPTIONS: Array<{
  id: ReadingFontFamily;
  name: string;
  detail: string;
  className: string;
}> = [
  {
    id: "opendyslexic",
    name: "OpenDyslexic",
    detail: "Base reforçada para evitar inversão de letras",
    className: "font-opendyslexic",
  },
  {
    id: "lexend",
    name: "Lexend",
    detail: "Espaçamento calibrado para fluência visual",
    className: "font-lexend",
  },
  {
    id: "atkinson",
    name: "Atkinson Hyperlegible",
    detail: "Distingue letras parecidas com alta clareza",
    className: "font-atkinson",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    detail: "Moderna, limpa e equilibrada",
    className: "font-jakarta",
  },
  {
    id: "lora",
    name: "Lora (Serifa Suave)",
    detail: "Leitura clássica de livros e artigos",
    className: "font-lora",
  },
  {
    id: "ibm-mono",
    name: "IBM Plex Mono (Monoespaçada)",
    detail: "Letras com largura fixa para evitar troca e aglomeração",
    className: "font-mono-reading",
  },
];

export interface ColorLensDefinition {
  id: ColorLensOverlay;
  label: string;
  description: string;
  overlayRgba: string;
  swatchHex: string;
}

export const COLOR_LENS_OPTIONS: ColorLensDefinition[] = [
  {
    id: "none",
    label: "Sem lente",
    description: "Cores originais do tema",
    overlayRgba: "transparent",
    swatchHex: "#FFFFFF",
  },
  {
    id: "amber",
    label: "Lente Âmbar",
    description: "Reduz luz azul e brilho intenso",
    overlayRgba: "rgba(251, 191, 36, 0.11)",
    swatchHex: "#FDE68A",
  },
  {
    id: "mint",
    label: "Verde-Menta",
    description: "Suaviza contraste e cansaço visual",
    overlayRgba: "rgba(52, 211, 153, 0.10)",
    swatchHex: "#A7F3D0",
  },
  {
    id: "blue",
    label: "Azul Calmo",
    description: "Filtro frio leve para foco contínuo",
    overlayRgba: "rgba(56, 189, 248, 0.10)",
    swatchHex: "#BAE6FD",
  },
  {
    id: "rose",
    label: "Rosa Suave",
    description: "Atenua reflexo branco do papel",
    overlayRgba: "rgba(244, 114, 182, 0.09)",
    swatchHex: "#FBCFE8",
  },
];

export const COLUMN_WIDTH_MAP: Record<ColumnWidthOption, string> = {
  narrow: "52ch",
  ideal: "65ch",
  wide: "80ch",
};

export interface AiVoiceOptionDefinition {
  id: GeminiVoiceName;
  name: string;
  gender: "feminina" | "masculina";
  tag: string;
  description: string;
}

export const AI_VOICE_OPTIONS: AiVoiceOptionDefinition[] = [
  {
    id: "Kore",
    name: "Clara",
    gender: "feminina",
    tag: "Feminina · Firme e nítida",
    description: "Voz humana clara, segura e bem articulada",
  },
  {
    id: "Zephyr",
    name: "Sofia",
    gender: "feminina",
    tag: "Feminina · Suave e brilhante",
    description: "Tom leve e agradável para leituras longas",
  },
  {
    id: "Aoede",
    name: "Aurora",
    gender: "feminina",
    tag: "Feminina · Natural e fluida",
    description: "Expressão espontânea, leve e acolhedora",
  },
  {
    id: "Leda",
    name: "Helena",
    gender: "feminina",
    tag: "Feminina · Jovem",
    description: "Voz jovem, vívida e fácil de acompanhar",
  },
  {
    id: "Sulafat",
    name: "Beatriz",
    gender: "feminina",
    tag: "Feminina · Calorosa",
    description: "Timbre acolhedor e próximo para leitura calma",
  },
  {
    id: "Callirhoe",
    name: "Camila",
    gender: "feminina",
    tag: "Feminina · Descontraída",
    description: "Fala tranquila, amigável e sem rigidez",
  },
  {
    id: "Autonoe",
    name: "Lorena",
    gender: "feminina",
    tag: "Feminina · Alegre",
    description: "Tom luminoso que ajuda a manter a atenção",
  },
  {
    id: "Despina",
    name: "Marina",
    gender: "feminina",
    tag: "Feminina · Serena",
    description: "Fluxo macio e contínuo para textos extensos",
  },
  {
    id: "Erinome",
    name: "Íris",
    gender: "feminina",
    tag: "Feminina · Articulada",
    description: "Pronúncia nítida ideal para estudo e revisão",
  },
  {
    id: "Gacrux",
    name: "Cláudia",
    gender: "feminina",
    tag: "Feminina · Madura",
    description: "Voz firme e estável para textos formais",
  },
  {
    id: "Laomedeia",
    name: "Alice",
    gender: "feminina",
    tag: "Feminina · Positiva",
    description: "Leitura animada, clara e motivadora",
  },
  {
    id: "Pulcherrima",
    name: "Gabriela",
    gender: "feminina",
    tag: "Feminina · Dinâmica",
    description: "Presença vocal forte e envolvente",
  },
  {
    id: "Achernar",
    name: "Lívia",
    gender: "feminina",
    tag: "Feminina · Suave",
    description: "Voz delicada e gentil para leitura relaxante",
  },
  {
    id: "Vindemiatrix",
    name: "Vitória",
    gender: "feminina",
    tag: "Feminina · Gentil",
    description: "Ritmo calmo, doce e acolhedor",
  },
  {
    id: "Puck",
    name: "Lucas",
    gender: "masculina",
    tag: "Masculina · Jovem e animada",
    description: "Leitura leve, expressiva e envolvente",
  },
  {
    id: "Charon",
    name: "Mateus",
    gender: "masculina",
    tag: "Masculina · Calma",
    description: "Timbre informativo, tranquilo e bem articulado",
  },
  {
    id: "Fenrir",
    name: "Rafael",
    gender: "masculina",
    tag: "Masculina · Narrador",
    description: "Estilo audiolivro intenso e envolvente",
  },
  {
    id: "Orus",
    name: "Thiago",
    gender: "masculina",
    tag: "Masculina · Firme",
    description: "Voz equilibrada, clara e confiante",
  },
  {
    id: "Enceladus",
    name: "Bruno",
    gender: "masculina",
    tag: "Masculina · Suave",
    description: "Timbre macio e relaxante sem peso excessivo",
  },
  {
    id: "Iapetus",
    name: "Daniel",
    gender: "masculina",
    tag: "Masculina · Limpa",
    description: "Dicção cristalina para artigos e apostilas",
  },
  {
    id: "Umbriel",
    name: "Gustavo",
    gender: "masculina",
    tag: "Masculina · Tranquila",
    description: "Tom descontraído e confortável",
  },
  {
    id: "Algieba",
    name: "Henrique",
    gender: "masculina",
    tag: "Masculina · Grave fluida",
    description: "Voz grave macia e agradável de ouvir",
  },
  {
    id: "Algenib",
    name: "Igor",
    gender: "masculina",
    tag: "Masculina · Marcante",
    description: "Timbre profundo com personalidade de locutor",
  },
  {
    id: "Rasalgethi",
    name: "João",
    gender: "masculina",
    tag: "Masculina · Documentário",
    description: "Narração profissional clara e informativa",
  },
  {
    id: "Alnilam",
    name: "Leonardo",
    gender: "masculina",
    tag: "Masculina · Segura",
    description: "Fala firme e direta para leitura técnica",
  },
  {
    id: "Schedar",
    name: "Murilo",
    gender: "masculina",
    tag: "Masculina · Constante",
    description: "Cadência uniforme que facilita a concentração",
  },
  {
    id: "Achird",
    name: "Pedro",
    gender: "masculina",
    tag: "Masculina · Amigável",
    description: "Tom próximo, simpático e acolhedor",
  },
  {
    id: "Zubenelgenubi",
    name: "Rodrigo",
    gender: "masculina",
    tag: "Masculina · Natural",
    description: "Estilo conversa simples do dia a dia",
  },
  {
    id: "Sadachbia",
    name: "Vítor",
    gender: "masculina",
    tag: "Masculina · Vibrante",
    description: "Voz energética para manter o foco ativo",
  },
  {
    id: "Sadaltager",
    name: "Eduardo",
    gender: "masculina",
    tag: "Masculina · Didática",
    description: "Tom sereno de professor explicando com calma",
  },
];

export interface UnlimitedVoiceProfileDefinition {
  id: UnlimitedVoiceProfileId;
  label: string;
  description: string;
  pitchFactor: number;
  rateFactor: number;
}

export const UNLIMITED_VOICE_PROFILES: UnlimitedVoiceProfileDefinition[] = [
  {
    id: "padrao",
    label: "Natural (Padrão Google)",
    description: "Timbre original da voz selecionada, sem alterações",
    pitchFactor: 1.0,
    rateFactor: 1.0,
  },
  {
    id: "suave-clara",
    label: "Clara Suave",
    description: "Tom levemente mais agudo e gentil para leitura leve",
    pitchFactor: 1.14,
    rateFactor: 0.97,
  },
  {
    id: "didatica-pausada",
    label: "Didática Pausada",
    description: "Cadência tranquila ideal para estudo e compreensão",
    pitchFactor: 1.03,
    rateFactor: 0.9,
  },
  {
    id: "jovem-leve",
    label: "Jovem Expressiva",
    description: "Tom mais brilhante e ágil para manter a atenção",
    pitchFactor: 1.22,
    rateFactor: 1.06,
  },
  {
    id: "narrador-grave",
    label: "Narrador Grave",
    description: "Timbre mais profundo estilo audiolivro",
    pitchFactor: 0.82,
    rateFactor: 0.95,
  },
  {
    id: "firme-objetiva",
    label: "Firme e Objetiva",
    description: "Tom sério e estável para documentos técnicos",
    pitchFactor: 0.9,
    rateFactor: 1.0,
  },
  {
    id: "leve-aguda",
    label: "Leve Aguda",
    description: "Voz mais aguda e cristalina para diferenciação clara",
    pitchFactor: 1.28,
    rateFactor: 1.0,
  },
  {
    id: "locucao-serena",
    label: "Locução Serena",
    description: "Tom levemente grave com ritmo calmo de leitura longa",
    pitchFactor: 0.88,
    rateFactor: 0.92,
  },
];

export function normalizeVoiceLang(lang: string): string {
  return (lang || "").replace(/_/g, "-").trim().toLowerCase();
}

export function isPortugueseBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  const norm = normalizeVoiceLang(voice.lang);
  return norm === "pt" || norm.startsWith("pt-");
}

export function isGoogleBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  const name = (voice.name || "").toLowerCase();
  const uri = (voice.voiceURI || "").toLowerCase();
  return name.includes("google") || uri.includes("com.google.android.tts");
}

export function isNaturalOnlineBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  const name = (voice.name || "").toLowerCase();
  return (
    name.includes("natural") ||
    name.includes("neural") ||
    name.includes("online") ||
    !voice.localService
  );
}

export function scoreBrowserVoiceNaturalness(voice: SpeechSynthesisVoice): number {
  const name = (voice.name || "").toLowerCase();
  const lang = normalizeVoiceLang(voice.lang);
  let score = 0;
  if (lang.startsWith("pt-br")) score += 120;
  else if (lang.startsWith("pt")) score += 60;

  if (isGoogleBrowserVoice(voice)) score += 60;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) score += 50;
  if (
    name.includes("microsoft") ||
    name.includes("francisca") ||
    name.includes("antonio") ||
    name.includes("thalita") ||
    name.includes("luciana") ||
    name.includes("felipe")
  ) {
    score += 30;
  }
  if (!voice.localService) score += 15;
  if (name.includes("espeak") || name.includes("festival")) score -= 60;
  return score;
}

export interface ReadingToneDefinition {
  id: ReadingTone;
  label: string;
  description: string;
  browserPitch: number;
  browserRateFactor: number;
}

export const READING_TONE_OPTIONS: ReadingToneDefinition[] = [
  {
    id: "calmo",
    label: "Calmo",
    description: "Acolhedor e tranquilo para leitura confortável",
    browserPitch: 1.0,
    browserRateFactor: 0.96,
  },
  {
    id: "animado",
    label: "Animado",
    description: "Energia positiva e vibrante para manter o foco",
    browserPitch: 1.12,
    browserRateFactor: 1.08,
  },
  {
    id: "serio",
    label: "Sério",
    description: "Firme, objetivo e formal para textos técnicos",
    browserPitch: 0.9,
    browserRateFactor: 0.98,
  },
  {
    id: "divertido",
    label: "Divertido",
    description: "Leve, expressivo e descontraído para histórias",
    browserPitch: 1.18,
    browserRateFactor: 1.05,
  },
  {
    id: "pausado",
    label: "Pausado",
    description: "Ritmo bem devagar para absorver cada detalhe",
    browserPitch: 0.98,
    browserRateFactor: 0.82,
  },
];

export interface HighlightColorDefinition {
  id: HighlightColor;
  label: string;
  meaning: string;
  swatchHex: string;
  lightBg: string;
  lightText: string;
  lightBorder: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
}

export const HIGHLIGHT_COLOR_OPTIONS: HighlightColorDefinition[] = [
  {
    id: "amarelo",
    label: "Amarelo",
    meaning: "Essencial / Ideia principal",
    swatchHex: "#FACC15",
    lightBg: "#FEF08A",
    lightText: "#422006",
    lightBorder: "#EAB308",
    darkBg: "#854D0E",
    darkText: "#FEF9C3",
    darkBorder: "#FACC15",
  },
  {
    id: "verde",
    label: "Verde",
    meaning: "Entendi / Dominado",
    swatchHex: "#34D399",
    lightBg: "#BBF7D0",
    lightText: "#064E3B",
    lightBorder: "#10B981",
    darkBg: "#065F46",
    darkText: "#D1FAE5",
    darkBorder: "#34D399",
  },
  {
    id: "azul",
    label: "Azul",
    meaning: "Exemplo / Dado importante",
    swatchHex: "#38BDF8",
    lightBg: "#BAE6FD",
    lightText: "#0C4A6E",
    lightBorder: "#0284C7",
    darkBg: "#075985",
    darkText: "#E0F2FE",
    darkBorder: "#38BDF8",
  },
  {
    id: "rosa",
    label: "Rosa",
    meaning: "Dúvida (?) / Revisar depois",
    swatchHex: "#F472B6",
    lightBg: "#FBCFE8",
    lightText: "#831843",
    lightBorder: "#DB2777",
    darkBg: "#831843",
    darkText: "#FCE7F3",
    darkBorder: "#F472B6",
  },
  {
    id: "roxo",
    label: "Roxo",
    meaning: "Conceito / Palavra-chave",
    swatchHex: "#A78BFA",
    lightBg: "#DDD6FE",
    lightText: "#4C1D95",
    lightBorder: "#7C3AED",
    darkBg: "#5B21B6",
    darkText: "#EDE9FE",
    darkBorder: "#A78BFA",
  },
];

export function getHighlightColorDef(color: HighlightColor): HighlightColorDefinition {
  return (
    HIGHLIGHT_COLOR_OPTIONS.find((c) => c.id === color) ||
    HIGHLIGHT_COLOR_OPTIONS[0]
  );
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_READER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    const merged = { ...DEFAULT_READER_SETTINGS, ...parsed };
    if (!parsed.viewMode) {
      merged.viewMode = parsed.guidedBlockMode ? "block" : "page";
    }
    if (typeof parsed.blockDivisionEnabled !== "boolean") {
      merged.blockDivisionEnabled = true;
    }
    if (!merged.blockDivisionEnabled && merged.viewMode === "block") {
      merged.viewMode = "page";
      merged.guidedBlockMode = false;
    }
    if (
      typeof merged.browserVoicePitch !== "number" ||
      !Number.isFinite(merged.browserVoicePitch)
    ) {
      merged.browserVoicePitch = 1.0;
    }
    if (
      typeof merged.readingChunkGoal !== "number" ||
      !Number.isFinite(merged.readingChunkGoal) ||
      merged.readingChunkGoal < 0
    ) {
      merged.readingChunkGoal = 8;
    }
    if (!merged.colorLensOverlay) {
      merged.colorLensOverlay = "none";
    }
    return merged;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function resetReaderSettings(): ReaderSettings {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore
  }
  return { ...DEFAULT_READER_SETTINGS };
}

export function resolveThemeColors(settings: ReaderSettings): ThemePaletteDefinition {
  if (settings.themePreset === "personalizado") {
    const isDark = isColorDark(settings.customBgColor);
    return {
      id: "papel-suave",
      name: "Personalizado",
      description: "Cores escolhidas por você",
      bg: settings.customBgColor,
      surface: isDark ? "#1F2937" : "#FFFFFF",
      border: isDark ? "#374151" : "#CBD5E1",
      text: settings.customTextColor,
      muted: isDark ? "#CBD5E1" : "#475569",
      highlightSentenceBg: isDark ? "#1E3A8A" : "#E0F2FE",
      highlightWordBg: isDark ? "#0EA5E9" : "#BAE6FD",
      highlightWordText: isDark ? "#FFFFFF" : "#0C4A6E",
      isDark,
    };
  }
  return (
    READING_THEMES.find((t) => t.id === settings.themePreset) ||
    READING_THEMES[0]
  );
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
