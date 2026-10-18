import { useEffect, useState } from 'react';

// Onthoudt of het donkere thema aan staat, ook als je naar een andere pagina gaat.
// De keuze staat in de localStorage van de browser (alleen een voorkeur, geen belangrijke gegevens).
export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // De class "dark" op <html> zet alle Tailwind dark:-classes aan (zie index.css).
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('darkMode', String(darkMode));
    } catch {
      // Opslaan mislukt (bijvoorbeeld privévenster): het thema werkt dan alleen op deze pagina.
    }
  }, [darkMode]);

  function toggleDarkMode() {
    setDarkMode(current => !current);
  }

  return [darkMode, toggleDarkMode] as const;
}