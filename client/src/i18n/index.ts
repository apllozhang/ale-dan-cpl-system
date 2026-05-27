import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

const LANG_KEY = "lang";

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    "zh-TW": { translation: zhTW },
    en: { translation: en },
    ja: { translation: ja },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: localStorage.getItem(LANG_KEY) || "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;
