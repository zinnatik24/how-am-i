import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Localization from 'expo-localization';
import { SupportedLanguage } from '../types';
import { TRANSLATIONS, TranslationKey } from './translations';
import { getStoredLanguage, saveStoredLanguage } from '../storage/checkInStorage';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ru',
  setLanguage: async () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('ru');

  useEffect(() => {
    async function initLanguage() {
      const stored = await getStoredLanguage();
      if (stored) {
        setLanguageState(stored);
      } else {
        const locales = Localization.getLocales();
        const primaryLocale = locales && locales[0]?.languageCode;
        if (primaryLocale === 'ru') {
          setLanguageState('ru');
        } else {
          setLanguageState('en');
        }
      }
    }
    initLanguage();
  }, []);

  const setLanguage = async (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    await saveStoredLanguage(newLang);
  };

  const t = (key: TranslationKey): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
