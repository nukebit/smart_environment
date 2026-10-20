import { useEffect, useState, useMemo } from 'react';
import {
  Download,
  RotateCcw,
  CloudSun,
  Droplets,
  Wind,
  AlertTriangle,
  Building,
  MapPin,
  Calendar,
  Activity,
  LineChart,
  BarChart3,
  RefreshCw,
  Info,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useDarkMode } from '../hooks/useDarkMode';

// Gebouwen met bijbehorende lokalen
const gebouwenData: Record<string, string[]> = {
  Hoofdgebouw: ['Lokaal 2.14', 'Lokaal 1.02', 'Lokaal 3.05', 'Aula A'],
  'Gebouw A': ['Lokaal A1.01', 'Lokaal A1.04', 'Lokaal A2.08'],
  'Gebouw B': ['Lokaal B0.12', 'Lokaal B1.15', 'Lokaal B2.03'],
  Techniekvleugel: ['Werkplaats T1', 'Practicumruimte T2', 'Computerlab T3'],
};

// Sensortypen met richtlijnen
const sensorTypen = [
  {
    id: 'temperatuur',
    label: 'Temperatuur °C',
    naam: 'Temperatuur',
    eenheid: '°C',
    defaultGrens: 23.5,
    optimaalMin: 19.0,
    optimaalMax: 22.0,
    standaardWeergave: 'lijn' as const,
    kleur: '#059669',
    beschrijving: 'Aanbevolen binnentemperatuur voor een optimaal leercomfort in lokalen.',
  },
  {
    id: 'co2',
    label: 'CO₂ ppm',
    naam: 'CO₂',
    eenheid: 'ppm',
    defaultGrens: 1000,
    optimaalMin: 400,
    optimaalMax: 800,
    standaardWeergave: 'staaf' as const,
    kleur: '#2563eb',
    beschrijving: 'Ventilatienorm conform de Frisse Scholen richtlijn (Klasse B).',
  },
  {
    id: 'luchtvochtigheid',
    label: 'Luchtvochtigheid %',
    naam: 'Luchtvochtigheid',
    eenheid: '%',
    defaultGrens: 70,
    optimaalMin: 40,
    optimaalMax: 60,
    standaardWeergave: 'lijn' as const,
    kleur: '#0284c7',
    beschrijving: 'Gezonde relatieve luchtvochtigheid voor een comfortabel binnenklimaat.',
  },
  {
    id: 'luchtdruk',
    label: 'Luchtdruk hPa',
    naam: 'Luchtdruk',
    eenheid: 'hPa',
    defaultGrens: 1028,
    optimaalMin: 1008,
    optimaalMax: 1025,
    standaardWeergave: 'lijn' as const,
    kleur: '#4f46e5',
    beschrijving: 'Barometrische luchtdrukmetingen binnen het schoolgebouw.',
  },
];

const periodes = [
  { id: '24u', label: 'Afgelopen 24 uur', datumTekst: 'Laatste 24 uur (uurgemiddelden)' },
  { id: '7d', label: 'Afgelopen 7 dagen', datumTekst: '19 mei – 25 mei 2025' },
  { id: '30d', label: 'Afgelopen 30 dagen', datumTekst: '26 april – 26 mei 2025' },
  { id: '3m', label: 'Afgelopen 3 maanden', datumTekst: '15 februari – 14 mei 2025' },
];

type WeatherData = {
  temp: number;
  humidity: number;
  windSpeed: number;
  isRealApi: boolean;
  timestamp: string;
};

export default function SensordataPage() {
  const [role, setRole] = useState('');
  const [darkMode, toggleDarkMode] = useDarkMode();

  // Filters
  const [geselecteerdGebouw, setGeselecteerdGebouw] = useState('Hoofdgebouw');
  const [geselecteerdLokaal, setGeselecteerdLokaal] = useState('Lokaal 2.14');
  const [geselecteerdSensortype, setGeselecteerdSensortype] = useState('temperatuur');
  const [geselecteerdePeriode, setGeselecteerdePeriode] = useState('3m');

  // Grafiek visualisatie voorkeuren
  const [weergaveModus, setWeergaveModus] = useState<'lijn' | 'staaf'>('lijn');
  const [toonComfortzone, setToonComfortzone] = useState(true);

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    datum: string;
    waarde: number;
    isOverschrijding: boolean;
    statusText: string;
  } | null>(null);

  // Open-Meteo actuele weerdata
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Sessie controle
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }
        if (!response.ok) throw new Error();
        const user = await response.json();
        setRole(user.role);
      })
      .catch(() => {
        window.location.replace('/login');
      });
  }, []);

  const handleGebouwChange = (gebouw: string) => {
    setGeselecteerdGebouw(gebouw);
    const lokalen = gebouwenData[gebouw] || [];
    if (lokalen.length > 0 && !lokalen.includes(geselecteerdLokaal)) {
      setGeselecteerdLokaal(lokalen[0]);
    }
  };

  const huidigeSensor = useMemo(() => {
    return sensorTypen.find(s => s.id === geselecteerdSensortype) || sensorTypen[0];
  }, [geselecteerdSensortype]);

  const huidigePeriode = useMemo(() => {
    return periodes.find(p => p.id === geselecteerdePeriode) || periodes[3];
  }, [geselecteerdePeriode]);

  // Pas standaardweergave aan per sensor
  useEffect(() => {
    setWeergaveModus(huidigeSensor.standaardWeergave);
  }, [huidigeSensor]);

  const resetFilters = () => {
    setGeselecteerdGebouw('Hoofdgebouw');
    setGeselecteerdLokaal('Lokaal 2.14');
    setGeselecteerdSensortype('temperatuur');
    setGeselecteerdePeriode('3m');
    setWeergaveModus('lijn');
  };

  const actieveFiltersCount = useMemo(() => {
    let count = 0;
    if (geselecteerdGebouw !== 'Hoofdgebouw') count++;
    if (geselecteerdLokaal !== 'Lokaal 2.14') count++;
    if (geselecteerdSensortype !== 'temperatuur') count++;
    if (geselecteerdePeriode !== '3m') count++;
    return count > 0 ? `${count} actief` : 'Standaard';
  }, [geselecteerdGebouw, geselecteerdLokaal, geselecteerdSensortype, geselecteerdePeriode]);

  // Open-Meteo call
  const fetchOpenMeteo = () => {
    setWeatherLoading(true);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=51.92&longitude=4.47&current=temperature_2m,relative_humidity_2m,wind_speed_10m')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data && data.current) {
          const nu = new Date();
          const tijdstr = nu.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
          setWeather({
            temp: Math.round(data.current.temperature_2m * 10) / 10,
            humidity: Math.round(data.current.relative_humidity_2m),
            windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
            isRealApi: true,
            timestamp: tijdstr,
          });
        }
      })
      .catch(() => {
        setWeather({
          temp: 14.8,
          humidity: 68,
          windSpeed: 12.5,
          isRealApi: false,
          timestamp: 'Historische norm',
        });
      })
      .finally(() => {
        setWeatherLoading(false);
      });
  };

  useEffect(() => {
    fetchOpenMeteo();
  }, []);


  function handleNavigation(page: string) {
    if (page === 'Dashboard') window.location.assign('/dashboard');
    if (page === 'Beheer') window.location.assign('/beheer');
  }

  return (
    <div className={darkMode ? 'min-h-screen bg-slate-900 text-slate-100' : 'min-h-screen bg-slate-50 text-slate-800'}>
      <AppHeader activePage="Sensordata" role={role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} onNavigate={handleNavigation} />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-emerald-600">Analyse</p>
          <h1 className="text-2xl font-bold">Sensordata</h1>
          <p className="text-xs text-slate-400">Actuele weerdata: {weather ? `${weather.temp}°C, ${weather.humidity}% RV` : 'Laden...'}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="rounded-2xl border p-5">Filters ({actieveFiltersCount})</div>
          </aside>
          <section className="lg:col-span-9">
            <div className="rounded-2xl border p-6">Klimaatverloop ({geselecteerdGebouw} · {geselecteerdLokaal})</div>
          </section>
        </div>
      </main>
    </div>
  );
}
