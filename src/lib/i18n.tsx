import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "es" | "fr" | "pt" | "ar";

export const LANGS: { code: Lang; label: string; native: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "es", label: "Spanish", native: "Español", dir: "ltr" },
  { code: "fr", label: "French", native: "Français", dir: "ltr" },
  { code: "pt", label: "Portuguese", native: "Português", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
];

// Static UI strings. Agent outputs are translated on the fly via /api/translate.
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    matchHub: "Match Hub",
    history: "History",
    aiChat: "AI Chat",
    liveDashboard: "Live Dashboard",
    aiCoach: "AI Coach",
    intelligence: "Intelligence",
    simulator: "Simulator",
    vision: "Vision",
    language: "Language",
    voice: "Voice",
    talkToTactix: "Talk to TACTIX",
    listening: "Listening…",
    transcribing: "Transcribing…",
    speaking: "Speaking…",
    stop: "Stop",
    send: "Send",
    thinking: "TACTIX is thinking…",
    beyond: "Beyond Scores. Understand Football.",
  },
  es: {
    matchHub: "Centro de Partido",
    history: "Historia",
    aiChat: "Chat IA",
    liveDashboard: "Panel en Vivo",
    aiCoach: "Entrenador IA",
    intelligence: "Inteligencia",
    simulator: "Simulador",
    vision: "Visión",
    language: "Idioma",
    voice: "Voz",
    talkToTactix: "Habla con TACTIX",
    listening: "Escuchando…",
    transcribing: "Transcribiendo…",
    speaking: "Hablando…",
    stop: "Detener",
    send: "Enviar",
    thinking: "TACTIX está pensando…",
    beyond: "Más allá del marcador. Entiende el fútbol.",
  },
  fr: {
    matchHub: "Match Hub",
    history: "Historique",
    aiChat: "Chat IA",
    liveDashboard: "Tableau en direct",
    aiCoach: "Coach IA",
    intelligence: "Intelligence",
    simulator: "Simulateur",
    vision: "Vision",
    language: "Langue",
    voice: "Voix",
    talkToTactix: "Parler à TACTIX",
    listening: "Écoute…",
    transcribing: "Transcription…",
    speaking: "Parle…",
    stop: "Arrêter",
    send: "Envoyer",
    thinking: "TACTIX réfléchit…",
    beyond: "Au-delà du score. Comprenez le football.",
  },
  pt: {
    matchHub: "Central da Partida",
    history: "Histórico",
    aiChat: "Chat IA",
    liveDashboard: "Painel ao Vivo",
    aiCoach: "Treinador IA",
    intelligence: "Inteligência",
    simulator: "Simulador",
    vision: "Visão",
    language: "Idioma",
    voice: "Voz",
    talkToTactix: "Fale com o TACTIX",
    listening: "Ouvindo…",
    transcribing: "Transcrevendo…",
    speaking: "Falando…",
    stop: "Parar",
    send: "Enviar",
    thinking: "TACTIX está pensando…",
    beyond: "Além do placar. Entenda o futebol.",
  },
  ar: {
    matchHub: "مركز المباراة",
    history: "السجل",
    aiChat: "الدردشة الذكية",
    liveDashboard: "اللوحة المباشرة",
    aiCoach: "المدرب الذكي",
    intelligence: "الاستخبارات",
    simulator: "المحاكي",
    vision: "الرؤية",
    language: "اللغة",
    voice: "الصوت",
    talkToTactix: "تحدث مع TACTIX",
    listening: "يستمع…",
    transcribing: "يفرغ الصوت…",
    speaking: "يتحدث…",
    stop: "إيقاف",
    send: "إرسال",
    thinking: "TACTIX يفكر…",
    beyond: "ما وراء النتيجة. افهم كرة القدم.",
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT.en) => string;
  translate: (text: string) => Promise<string>;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE = "tactix.lang";
const CACHE = new Map<string, string>();

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {}
  const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
  const found = LANGS.find((l) => l.code === nav);
  return found ? found.code : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = LANGS.find((l) => l.code === lang)!;
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE, l); } catch {}
  }, []);

  const t = useCallback(
    (key: keyof typeof DICT.en) => DICT[lang][key] ?? DICT.en[key] ?? String(key),
    [lang],
  );

  const translate = useCallback(
    async (text: string): Promise<string> => {
      if (lang === "en" || !text.trim()) return text;
      const cacheKey = `${lang}::${text}`;
      const cached = CACHE.get(cacheKey);
      if (cached) return cached;
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, target: lang }),
        });
        if (!res.ok) return text;
        const data = (await res.json()) as { translated?: string };
        const out = data.translated ?? text;
        CACHE.set(cacheKey, out);
        return out;
      } catch {
        return text;
      }
    },
    [lang],
  );

  const value = useMemo<Ctx>(() => ({ lang, setLang, t, translate }), [lang, setLang, t, translate]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
