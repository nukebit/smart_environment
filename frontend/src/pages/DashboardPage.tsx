import { useEffect, useState } from 'react';
import {
  Bell,
  ChartNoAxesCombined,
  Building2,
  Settings,
  ArrowUpRight,
  ArrowRight,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useDarkMode } from '../hooks/useDarkMode';

// Tijdelijke voorbeeldgegevens.
// Later vervangen we deze door gegevens uit de backend.
const sensorData = {
  lokaal: '2.14',
  temperatuur: '24,8°C',
  luchtvochtigheid: '48%',
  luchtdruk: '1013',
};

export default function DashboardPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [darkMode, toggleDarkMode] = useDarkMode(); // Wordt onthouden tussen pagina's.
  const [activePage, setActivePage] = useState('Dashboard');

  // Controleer of de gebruiker is ingelogd.
  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async response => {
        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }

        if (!response.ok) throw new Error();

        const user = await response.json();
        setEmail(user.email);
        setRole(user.role);
      })
      .catch(() =>
        setError('Sessie controleren mislukt. Vernieuw de pagina.')
      );
  }, []);

  // Navigatie. Beheer is een eigen pagina (/beheer); de rest is nog tijdelijk.
  function handleNavigation(page: string) {
    if (page === 'Beheer') {
      window.location.assign('/beheer');
      return;
    }
    setActivePage(page);
  }

  const isBeheerder = role === 'Beheerder';

  const kaarten = [
    {
      titel: 'Sensordata & Historie',
      beschrijving: `Live metingen uit Lokaal ${sensorData.lokaal}`,
      detail: (
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
          <div className="p-3">
            <p className="font-bold">{sensorData.temperatuur}</p>
            <p className="text-xs text-slate-500">Temperatuur</p>
          </div>
          <div className="p-3">
            <p className="font-bold">{sensorData.luchtvochtigheid}</p>
            <p className="text-xs text-slate-500">RV</p>
          </div>
          <div className="p-3">
            <p className="font-bold">{sensorData.luchtdruk}</p>
            <p className="text-xs text-slate-500">hPa</p>
          </div>
        </div>
      ),
      icon: ChartNoAxesCombined,
      kleur: 'emerald',
      pagina: 'Sensordata',
    },
    {
      titel: 'Lokalen Overzicht',
      beschrijving: 'Actuele klimaatstatus per ruimte',
      detail: (
        <div className="rounded-lg border-l-2 border-blue-600 bg-slate-50 p-3">
          <p className="font-semibold">12 lokalen gekoppeld</p>
          <p className="mt-1 text-xs text-slate-500">
            1 te warm · Lokaal 2.14
          </p>
        </div>
      ),
      icon: Building2,
      kleur: 'blue',
      pagina: 'Lokalen',
    },
    {
      titel: 'Waarschuwingen',
      beschrijving: 'Meldingen die aandacht vereisen',
      detail: (
        <div className="rounded-lg border-l-2 border-amber-500 bg-slate-50 p-3">
          <p className="font-semibold">2 actieve meldingen</p>
          <p className="mt-1 text-xs text-slate-500">
            1 grenswaarde · 1 sensor offline
          </p>
        </div>
      ),
      icon: Bell,
      kleur: 'amber',
      pagina: 'Waarschuwingen',
    },
    {
      titel: 'Beheer',
      beschrijving: 'Beheer de Smart Environment omgeving',
      detail: (
        <div className="rounded-lg border-l-2 border-green-600 bg-slate-50 p-3">
          <p className="font-semibold">Accounts beheren</p>
          <p className="mt-1 text-xs text-slate-500">
            Docenten- en beheerdersaccounts
          </p>
        </div>
      ),
      icon: Settings,
      kleur: 'green',
      pagina: 'Beheer',
    },
  ];

  // Een Docent ziet de kaart "Beheer" niet (de backend weigert hem ook zelf).
  const zichtbareKaarten = kaarten.filter(
    kaart => isBeheerder || kaart.pagina !== 'Beheer'
  );

  const iconKleuren: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
  };

  // Toon geen dashboard zolang de sessie niet is gecontroleerd.
  if (!email) {
    return (
      <main className="p-6">
        {error ? (
          <p role="alert" className="text-red-600">{error}</p>
        ) : (
          <p role="status">Sessie controleren…</p>
        )}
      </main>
    );
  }

  return (
    <div className={darkMode ? 'min-h-screen bg-slate-900 text-white' : 'min-h-screen bg-slate-50 text-slate-900'}>

      {/* NAVIGATIEBALK (gedeeld met de Beheer-pagina, zie AppHeader.tsx) */}
      <AppHeader
        activePage={activePage}
        role={role}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigate={handleNavigation}
      />

      {/* DASHBOARDINHOUD */}
      <main className="mx-auto max-w-7xl px-5 py-10">

        {/* WELKOMST */}
        <section className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Smart Environment
          </p>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">
                Welkom terug
              </h1>
              <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                Kies een onderdeel om het binnenklimaat van je school te bekijken.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Ingelogd als {email}{role && ` · ${role}`}
              </p>
            </div>

            <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-700">
              ⚠ 1 lokaal vereist aandacht
            </span>
          </div>
        </section>

        {/* SNEL NAAR */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">Snel naar</h2>
              <p className={`mt-1 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                Alle onderdelen van je Smart Environment dashboard
              </p>
            </div>
            <span className="hidden items-center gap-2 text-xs sm:flex">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Systeemstatus: demo
            </span>
          </div>

          {/* DASHBOARDKAARTEN (een Docent ziet er drie, een Beheerder vier) */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {zichtbareKaarten.map(kaart => {
              const Icon = kaart.icon;

              return (
                <article
                  key={kaart.titel}
                  className={`rounded-xl border p-6 shadow-sm transition hover:shadow-md ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${iconKleuren[kaart.kleur]}`}>
                      <Icon size={22} />
                    </div>

                    <ArrowUpRight size={19} className="text-slate-400" />
                  </div>

                  <h3 className="mb-2 text-lg font-semibold">
                    {kaart.titel}
                  </h3>

                  <p className={`mb-5 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                    {kaart.beschrijving}
                  </p>

                  <div className="mb-5 text-slate-900">
                    {kaart.detail}
                  </div>

                  <button
                    onClick={() => handleNavigation(kaart.pagina)}
                    className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    Bekijk <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {error && (
          <p role="alert" className="mt-6 text-red-600">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}