import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from './locales/en.json';
import jaTranslations from './locales/ja.json';
import viTranslations from './locales/vi.json';

const resources = {
  en: {
    translation: enTranslations
  },
  ja: {
    translation: jaTranslations
  },
  vi: {
    translation: viTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'yuuzone_language',
    },

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // Namespace and key separator
    keySeparator: '.',
    nsSeparator: ':',
  });

export default i18n;
