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
  const [role] = useState('Beheerder');
  const [darkMode, toggleDarkMode] = useDarkMode();

  function handleNavigation(page: string) {
    if (page === 'Dashboard') window.location.assign('/dashboard');
    if (page === 'Beheer') window.location.assign('/beheer');
  }

  return (
    <div className={darkMode ? 'min-h-screen bg-slate-900 text-slate-100' : 'min-h-screen bg-slate-50 text-slate-800'}>
      <AppHeader
        activePage="Sensordata"
        role={role}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigate={handleNavigation}
      />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="text-2xl font-bold">Sensordata</h1>
      </main>
    </div>
  );
}
