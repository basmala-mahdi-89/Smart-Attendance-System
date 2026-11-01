import { createContext, useContext, useState, useCallback } from 'react';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      document.documentElement.lang = next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
