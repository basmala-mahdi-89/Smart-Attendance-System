import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem('lang');
      return stored === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });

  const apply = useCallback((next) => {
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('lang', next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    apply(lang);
  }, [lang, apply]);

  const setLang = useCallback((next) => {
    setLangState(next);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);