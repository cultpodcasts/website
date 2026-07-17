// Static language-name table baked in at build time (no runtime Intl.DisplayNames).
// Codes mirror the backend curator allow-list (LanguagesPublisher.LanguageNames in
// RedditPodcastPoster, 51 languages), which covers every non-English code observed
// in live search facets. Names were generated once from Intl.DisplayNames at
// development time and checked in as static data.

export interface LanguageNames {
  english: string;
  local: string;
}

export const LANGUAGES: Readonly<Record<string, LanguageNames>> = {
  "en": { english: "English", local: "English" },
  "fr": { english: "French", local: "Français" },
  "es": { english: "Spanish", local: "Español" },
  "de": { english: "German", local: "Deutsch" },
  "pt": { english: "Portuguese", local: "Português" },
  "tr": { english: "Turkish", local: "Türkçe" },
  "nl": { english: "Dutch", local: "Nederlands" },
  "it": { english: "Italian", local: "Italiano" },
  "ja": { english: "Japanese", local: "日本語" },
  "zh": { english: "Chinese", local: "中文" },
  "ko": { english: "Korean", local: "한국어" },
  "hi": { english: "Hindi", local: "हिन्दी" },
  "ru": { english: "Russian", local: "Русский" },
  "he": { english: "Hebrew", local: "עברית" },
  "ar": { english: "Arabic", local: "العربية" },
  "bn": { english: "Bangla", local: "বাংলা" },
  "id": { english: "Indonesian", local: "Indonesia" },
  "fil": { english: "Filipino", local: "Filipino" },
  "ur": { english: "Urdu", local: "اردو" },
  "sw": { english: "Swahili", local: "Kiswahili" },
  "vi": { english: "Vietnamese", local: "Tiếng Việt" },
  "sk": { english: "Slovak", local: "Slovenčina" },
  "cs": { english: "Czech", local: "Čeština" },
  "te": { english: "Telugu", local: "తెలుగు" },
  "af": { english: "Afrikaans", local: "Afrikaans" },
  "fa": { english: "Persian", local: "فارسی" },
  "ms": { english: "Malay", local: "Melayu" },
  "no": { english: "Norwegian", local: "Norsk" },
  "pl": { english: "Polish", local: "Polski" },
  "pa": { english: "Punjabi", local: "ਪੰਜਾਬੀ" },
  "th": { english: "Thai", local: "ไทย" },
  "uk": { english: "Ukrainian", local: "Українська" },
  "mr": { english: "Marathi", local: "मराठी" },
  "fi": { english: "Finnish", local: "Suomi" },
  "da": { english: "Danish", local: "Dansk" },
  "el": { english: "Greek", local: "Ελληνικά" },
  "hu": { english: "Hungarian", local: "Magyar" },
  "sv": { english: "Swedish", local: "Svenska" },
  "bg": { english: "Bulgarian", local: "Български" },
  "sr": { english: "Serbian", local: "Српски" },
  "hr": { english: "Croatian", local: "Hrvatski" },
  "lt": { english: "Lithuanian", local: "Lietuvių" },
  "lv": { english: "Latvian", local: "Latviešu" },
  "sl": { english: "Slovenian", local: "Slovenščina" },
  "bs": { english: "Bosnian", local: "Bosanski" },
  "mk": { english: "Macedonian", local: "Македонски" },
  "sq": { english: "Albanian", local: "Shqip" },
  "et": { english: "Estonian", local: "Eesti" },
  "ca": { english: "Catalan", local: "Català" },
  "si": { english: "Sinhala", local: "සිංහල" },
  "yi": { english: "Yiddish", local: "ייִדיש" }
};
