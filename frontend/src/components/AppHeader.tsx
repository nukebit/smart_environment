import { useState } from 'react';
import { Leaf, LogOut, Menu, Moon, Sun, X } from 'lucide-react';

// De navigatiebalk bovenaan elke pagina na het inloggen (dashboard en beheer).
// Zo staat de navigatie maar op één plek in de code.

const navigatie = ['Dashboard', 'Sensordata', 'Lokalen', 'Waarschuwingen', 'Beheer'];

// Pagina's die alleen een Beheerder mag zien.
const alleenBeheerder = ['Beheer'];

type Props = {
  activePage: string;                   // Welk tabblad groen is, bijvoorbeeld 'Beheer'.
  role: string;                         // 'Beheerder' of 'Docent'.
  darkMode?: boolean;                   // Staat het donkere thema aan?
  onToggleDarkMode?: () => void;        // Zonder deze functie wordt de knop niet getoond.
  onNavigate?: (page: string) => void;  // Voor tabbladen binnen het dashboard.
};

export default function AppHeader({ activePage, role, darkMode = false, onToggleDarkMode, onNavigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Een Docent ziet het tabblad "Beheer" niet.
  // Let op: dit is alleen voor het gemak. De backend weigert een Docent ook zelf (403).
  const zichtbareNavigatie = navigatie.filter(
    page => role === 'Beheerder' || !alleenBeheerder.includes(page)
  );

  function handleNavigation(page: string) {
    setMenuOpen(false);

    if (page === 'Waarschuwingen') {
      if (activePage !== page) window.location.assign('/waarschuwingen');
      return;
    }

    // Beheer is een eigen pagina.
    if (page === 'Beheer') {
      if (activePage !== 'Beheer') window.location.assign('/beheer');
      return;
    }

    // Op het dashboard regelt het dashboard zelf de andere tabbladen.
    if (onNavigate) {
      onNavigate(page);
      return;
    }

    // Vanaf een andere pagina (zoals Beheer) terug naar het dashboard.
    window.location.assign('/dashboard');
  }

  // Uitloggen: CSRF-token ophalen, dan POST /api/auth/logout.
  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const csrf = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!csrf.ok) throw new Error();
      const { token } = await csrf.json();

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': token },
      });

      if (!response.ok && response.status !== 401) throw new Error();

      window.location.replace('/login');
    } catch {
      setError('Uitloggen mislukt. Probeer opnieuw.');
      setBusy(false);
    }
  }

  return (
    <header className={`border-b ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-700 p-2 text-white">
            <Leaf size={20} />
          </div>
          <span className="font-bold">Smart Environment</span>
        </div>

        <nav className="hidden items-center gap-7 lg:flex">
          {zichtbareNavigatie.map(page => (
            <button
              key={page}
              onClick={() => handleNavigation(page)}
              aria-current={activePage === page ? 'page' : undefined}
              className={`cursor-pointer text-sm transition hover:text-emerald-600 ${
                activePage === page
                  ? darkMode ? 'font-semibold text-emerald-400' : 'font-semibold text-emerald-700'
                  : darkMode ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {page}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {onToggleDarkMode && (
            <button
              aria-label="Wissel kleurthema"
              onClick={onToggleDarkMode}
              className="cursor-pointer rounded-lg border border-slate-200 p-2"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          <button
            onClick={handleLogout}
            disabled={busy}
            className="hidden cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed sm:flex"
          >
            <LogOut size={16} />
            Uitloggen
          </button>

          <button
            className="cursor-pointer lg:hidden"
            aria-label="Open navigatiemenu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-2 border-t border-slate-200 p-4 lg:hidden">
          {zichtbareNavigatie.map(page => (
            <button
              key={page}
              onClick={() => handleNavigation(page)}
              className="cursor-pointer rounded-lg p-2 text-left hover:bg-emerald-100 hover:text-slate-900"
            >
              {page}
            </button>
          ))}
          <button onClick={handleLogout} disabled={busy} className="cursor-pointer p-2 text-left">
            Uitloggen
          </button>
        </nav>
      )}

      {error && (
        <p role="alert" className="mx-auto max-w-7xl px-5 pb-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </header>
  );
}