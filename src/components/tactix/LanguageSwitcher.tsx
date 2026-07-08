import { LANGS, useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
        {t("language")}
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
        className="rounded border border-border bg-surface/60 px-1.5 py-0.5 font-mono text-[10px] uppercase"
        aria-label="Language"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
