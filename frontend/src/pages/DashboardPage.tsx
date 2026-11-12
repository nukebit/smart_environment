import { api } from '../lib/api';
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
import WeatherValues, { weatherTime } from '../components/WeatherValues';
import { useWeather, type WeatherReading } from '../hooks/useWeather';
import { useDarkMode } from '../hooks/useDarkMode';
import type { Lokaal, LokaalKeuze } from '../types/lokalen';

type BinnenMeting = Pick<WeatherReading, 'temperature' | 'humidity' | 'pressure'> & { timestamp: string };
type DashboardVoorkeur = {
  lokaal: Lokaal | null;
  meting: WeatherReading | null;
  melding: string;
};

export default function DashboardPage() {
  const [warningCounts, setWarningCounts] = useState<{ total: number; unread: number } | null>(null);
  const [warningsError, setWarningsError] = useState('');
  const [email, setEmail] = useState('');
  const { weather, error: weatherError } = useWeather(Boolean(email));
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [darkMode, toggleDarkMode] = useDarkMode(); // Wordt onthouden tussen pagina's.
  const [activePage, setActivePage] = useState('Dashboard');
  const [lokalen, setLokalen] = useState<Lokaal[] | null>(null);
  const [aantalGebouwen, setAantalGebouwen] = useState(0);
  const [lokalenError, setLokalenError] = useState('');
  const [voorkeur, setVoorkeur] = useState<DashboardVoorkeur>({
    lokaal: null, meting: null, melding: 'Voorkeurslokaal laden…',
  });

  useEffect(() => {
    if (!role) return;
    let controller: AbortController | undefined;

    async function laadVoorkeur() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      let lokaal: Lokaal | null = null;

      try {
        const keuze = await api<LokaalKeuze>('/api/lokalen/actief', 'GET', undefined, signal);
        if (signal.aborted) return;
        lokaal = keuze.lokaal;
        setVoorkeur({
          lokaal, meting: null, melding: lokaal ? 'Binnenmetingen laden…' : 'Kies een voorkeurslokaal op Lokalen.',
        });
        if (!lokaal) return;

        const naam = lokaal.naam.replace(/^Lokaal\s+/i, '');
        const { latest } = await api<{ latest: BinnenMeting | null }>(
          `/api/sensors/room-data?room=${encodeURIComponent(naam)}&limit=1`, 'GET', undefined, signal,
        );
        if (signal.aborted) return;

        if (latest && [latest.temperature, latest.humidity, latest.pressure].every(Number.isFinite)) {
          const { timestamp, ...waarden } = latest;
          setVoorkeur({ lokaal, meting: { ...waarden, time: timestamp, windSpeed: 0 }, melding: '' });
        } else {
          setVoorkeur({ lokaal, meting: null, melding: 'Geen binnenmetingen beschikbaar.' });
        }
      } catch {
        if (!signal.aborted) {
          setVoorkeur({
            lokaal, meting: null, melding: lokaal ? 'Binnenmetingen laden mislukt.' : 'Voorkeurslokaal laden mislukt.',
          });
        }
      }
    }

    function herlaadBijTerugkeer(event: PageTransitionEvent) {
      if (event.persisted) void laadVoorkeur();
    }

    void laadVoorkeur();
    window.addEventListener('pageshow', herlaadBijTerugkeer);
    return () => {
      controller?.abort();
      window.removeEventListener('pageshow', herlaadBijTerugkeer);
    };
  }, [role]);

  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await api<{ items: { isRead: boolean }[] }>('/api/warnings', 'GET', undefined, controller.signal);
        if (!controller.signal.aborted) { setWarningCounts({ total: response.items.length, unread: response.items.filter(w => !w.isRead).length }); setWarningsError(''); }
      } catch { if (!controller.signal.aborted) setWarningsError('Meldingen ophalen mislukt.'); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 30000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [role]);

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

  // De lokalenkaart gebruikt hetzelfde overzicht als de lokalenpagina.
  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();

    Promise.all([
      fetch('/api/lokalen', { credentials: 'include', cache: 'no-store', signal: controller.signal }),
      fetch('/api/gebouwen', { credentials: 'include', cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([lokalenResponse, gebouwenResponse]) => {
        if (lokalenResponse.status === 401 || gebouwenResponse.status === 401) {
          window.location.replace('/login');
          return;
        }
        if (!lokalenResponse.ok || !gebouwenResponse.ok) throw new Error();
        const gebouwen = await gebouwenResponse.json();
        setAantalGebouwen(gebouwen.length);
        setLokalen(await lokalenResponse.json());
      })
      .catch(() => {
        if (!controller.signal.aborted) setLokalenError('Lokalen laden mislukt. Open het overzicht om opnieuw te proberen.');
      });

    return () => controller.abort();
  }, [role]);

  // Open de gekozen pagina vanuit een dashboardkaart.
  function handleNavigation(page: string) {
    if (page === 'Lokalen') {
      window.location.assign('/lokalen');
      return;
    }
    if (page === 'Waarschuwingen') {
      window.location.assign('/waarschuwingen');
      return;
    }
    if (page === 'Beheer') {
      window.location.assign('/beheer');
      return;
    }
    if (page === 'Sensordata') {
      window.location.assign('/sensordata');
      return;
    }
    setActivePage(page);
  }

  const isBeheerder = role === 'Beheerder';

  const kaarten = [
    {
      titel: 'Sensordata & Historie',
      beschrijving: voorkeur.lokaal
        ? `Voorkeurslokaal ${voorkeur.lokaal.naam} · ${voorkeur.lokaal.gebouw}`
        : 'Bekijk klimaatmetingen per lokaal',
      detail: (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
            <p className="w-11 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200">Buiten</p>
            <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 dark:border-slate-600">
              {weather ? <WeatherValues weather={weather} /> : <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{weatherError || 'Weergegevens laden…'}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
            <p className="w-11 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200">Binnen</p>
            <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 dark:border-slate-600">
              {voorkeur.meting ? (
                <>
                  <WeatherValues weather={voorkeur.meting} />
                  <time dateTime={voorkeur.meting.time} className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {new Date(voorkeur.meting.time).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </>
              ) : <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{voorkeur.melding}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="hover:underline">Open-Meteo</a> · Den Haag{weather && ' · ' + weatherTime(weather.time)}
          </p>
        </div>
      ),
      icon: ChartNoAxesCombined,
      kleur: 'emerald',
      pagina: 'Sensordata',
    },
    {
      titel: 'Lokalenoverzicht',
      beschrijving: isBeheerder ? 'Beheer gebouwen en lokalen' : 'Bekijk alle lokalen',
      detail: (
        <div className="rounded-lg border-l-2 border-blue-600 bg-slate-50 p-3 dark:bg-slate-900/60 dark:text-slate-100">
          {lokalenError ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{lokalenError}</p>
            : lokalen === null ? <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Lokalen laden…</p>
            : <>
              <p className="font-semibold">
                {aantalGebouwen} {aantalGebouwen === 1 ? 'gebouw' : 'gebouwen'} · {lokalen.length} {lokalen.length === 1 ? 'lokaal' : 'lokalen'}
              </p>
              {lokalen.length === 0 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Er zijn nog geen lokalen.</p>}
            </>}
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
        <div className="rounded-lg border-l-2 border-amber-500 bg-slate-50 p-3 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100">
          <p className="font-semibold">
            {warningsError || (warningCounts ? `${warningCounts.unread} ongelezen meldingen` : 'Meldingen laden…')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {warningCounts ? `${warningCounts.total} meldingen in totaal` : 'Bekijk de meldingen per lokaal'}
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
        <div className="rounded-lg border-l-2 border-green-600 bg-slate-50 p-3 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100">
          <p className="font-semibold">
            Accounts beheren
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Docenten- en beheerdersaccounts
          </p>
        </div>
      ),

      icon: Settings,
      kleur: 'green',
      pagina: 'Beheer',
    },
  ];

  // Accountbeheer is alleen zichtbaar voor beheerders; het lokalenoverzicht is voor iedereen.
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

          {/* DASHBOARDKAARTEN */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {zichtbareKaarten.map(kaart => {
              const Icon = kaart.icon;

              return (
                <article
                  key={kaart.titel}
                  className={`flex flex-col rounded-xl border p-6 shadow-sm transition hover:shadow-md ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${iconKleuren[kaart.kleur]}`}>
                      <Icon size={22} />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNavigation(kaart.pagina)}
                      aria-label={`Ga naar ${kaart.titel}`}
                      className="flex cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-slate-700/20 hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                      <ArrowUpRight size={19} />
                    </button>
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
                    className="mt-auto flex cursor-pointer items-center gap-2 self-start text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    {kaart.pagina === 'Lokalen' ? (isBeheerder ? 'Lokalen beheren' : 'Lokalen bekijken') : 'Bekijk'} <ArrowRight size={16} />
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
