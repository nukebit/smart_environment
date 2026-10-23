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

  // Dataset generatie per periode
  const meetData = useMemo(() => {
    // 1. AFGELOPEN 24 UUR (Tijdstippen in uren)
    if (geselecteerdePeriode === '24u') {
      const uren = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00', 'Nu'];

      if (geselecteerdSensortype === 'temperatuur') {
        const values = [19.2, 20.8, 22.4, 24.1, 23.8, 22.1, 20.7, 19.8, 18.9, 18.3, 18.1, 18.6, 20.2];
        return uren.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Warmtepiek in lesuur' : 'Normaal',
        }));
      }

      if (geselecteerdSensortype === 'co2') {
        const values = [520, 850, 1080, 1150, 920, 610, 500, 480, 440, 430, 420, 430, 510];
        return uren.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Onvoldoende ventilatie' : 'Goed geventileerd',
        }));
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const values = [48, 52, 56, 59, 57, 54, 53, 51, 50, 49, 48, 49, 51];
        return uren.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= 70 ? 'Te vochtig' : 'Ideaal vochtgehalte',
        }));
      }

      const values = [1015, 1016, 1017, 1017, 1018, 1019, 1020, 1020, 1021, 1021, 1022, 1022, 1023];
      return uren.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: 'Stabiele barometer',
      }));
    }

    // 2. AFGELOPEN 7 DAGEN (Dagen van de week)
    if (geselecteerdePeriode === '7d') {
      const dagen = ['Ma 19 mei', 'Di 20 mei', 'Wo 21 mei', 'Do 22 mei', 'Vr 23 mei', 'Za 24 mei', 'Zo 25 mei'];

      if (geselecteerdSensortype === 'temperatuur') {
        const values = [21.4, 22.8, 24.2, 23.7, 22.1, 19.5, 19.2];
        return dagen.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Grensoverschrijding' : 'Normaal',
        }));
      }

      if (geselecteerdSensortype === 'co2') {
        const values = [880, 1050, 1120, 940, 890, 460, 440];
        return dagen.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Te hoog CO₂' : 'Frisse lucht',
        }));
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const values = [52, 55, 68, 72, 64, 49, 47];
        return dagen.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= 70 ? 'Vochtig' : 'Ideaal',
        }));
      }

      const values = [1014, 1017, 1021, 1019, 1024, 1026, 1022];
      return dagen.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: 'Normale luchtdruk',
      }));
    }

    // 3. AFGELOPEN 30 DAGEN (Data per 3-4 dagen)
    if (geselecteerdePeriode === '30d') {
      const data30 = ['26 apr', '30 apr', '4 mei', '8 mei', '12 mei', '16 mei', '20 mei', '24 mei', '26 mei'];

      if (geselecteerdSensortype === 'temperatuur') {
        const values = [20.1, 21.3, 23.9, 22.4, 24.5, 23.1, 22.6, 21.8, 22.2];
        return data30.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Warme lesdag' : 'Comfortabel',
        }));
      }

      if (geselecteerdSensortype === 'co2') {
        const values = [810, 950, 1140, 880, 1080, 910, 860, 520, 840];
        return data30.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= 1000 ? 'Ventilatieadvies' : 'Voldoende',
        }));
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const values = [51, 58, 64, 73, 66, 61, 55, 52, 56];
        return data30.map((datum, idx) => ({
          datum,
          waarde: values[idx],
          isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
          statusText: values[idx] >= 70 ? 'Te vochtig' : 'Goed',
        }));
      }

      const values = [1013, 1018, 1022, 1016, 1025, 1028, 1021, 1019, 1023];
      return data30.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: 'Stabiel',
      }));
    }

    // 4. AFGELOPEN 3 MAANDEN
    const data3m = [
      '15 feb', '22 feb', '1 mrt', '8 mrt', '15 mrt', '22 mrt', '29 mrt',
      '5 apr', '12 apr', '18 apr', '25 apr', '1 mei', '8 mei', '14 mei',
    ];

    if (geselecteerdSensortype === 'temperatuur') {
      const values = [18.2, 18.9, 19.8, 19.5, 20.4, 21.6, 21.2, 22.4, 21.5, 23.9, 22.3, 24.8, 23.1, 24.2];
      return data3m.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: values[idx] >= huidigeSensor.defaultGrens ? 'Grensoverschrijding' : 'Normaal',
      }));
    }

    if (geselecteerdSensortype === 'co2') {
      const values = [580, 640, 720, 810, 750, 920, 880, 1050, 940, 1180, 990, 1120, 890, 1040];
      return data3m.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: values[idx] >= 1000 ? 'Grensoverschrijding' : 'Goed geventileerd',
      }));
    }

    if (geselecteerdSensortype === 'luchtvochtigheid') {
      const values = [45, 48, 52, 54, 58, 62, 59, 68, 64, 73, 67, 72, 61, 65];
      return data3m.map((datum, idx) => ({
        datum,
        waarde: values[idx],
        isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
        statusText: values[idx] >= 70 ? 'Hoge luchtvochtigheid' : 'Ideale luchtvochtigheid',
      }));
    }

    const values = [1012, 1014, 1018, 1016, 1021, 1025, 1019, 1022, 1017, 1029, 1024, 1030, 1023, 1026];
    return data3m.map((datum, idx) => ({
      datum,
      waarde: values[idx],
      isOverschrijding: values[idx] >= huidigeSensor.defaultGrens,
      statusText: 'Normale luchtdruk',
    }));
  }, [geselecteerdePeriode, geselecteerdSensortype, huidigeSensor]);

  // Statistische calculaties
  const statistieken = useMemo(() => {
    const waarden = meetData.map(d => d.waarde);
    const min = Math.min(...waarden);
    const max = Math.max(...waarden);
    const avg = Math.round((waarden.reduce((acc, curr) => acc + curr, 0) / waarden.length) * 10) / 10;
    const overschrijdingen = meetData.filter(d => d.isOverschrijding).length;
    return { min, max, avg, overschrijdingen };
  }, [meetData]);

  // CSV export
  const handleExportCsv = () => {
    const headers = ['Gebouw', 'Lokaal', 'Sensortype', 'Periode', 'Tijd_Datum', 'Waarde', 'Eenheid', 'Alarmgrens', 'Status'];
    const rows = meetData.map(d => [
      geselecteerdGebouw,
      geselecteerdLokaal,
      huidigeSensor.label,
      huidigePeriode.label,
      d.datum,
      d.waarde.toString().replace('.', ','),
      huidigeSensor.eenheid,
      huidigeSensor.defaultGrens.toString().replace('.', ','),
      d.isOverschrijding ? 'Grensoverschrijding' : 'Normaal',
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sensordata_${geselecteerdGebouw}_${geselecteerdLokaal}_${geselecteerdSensortype}_${geselecteerdePeriode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNavigation = (page: string) => {
    if (page === 'Dashboard') window.location.assign('/dashboard');
    else if (page === 'Beheer') window.location.assign('/beheer');
  };

  // Y-as bereik & schaling
  const { yMin, yMax, ySteps } = useMemo(() => {
    if (geselecteerdSensortype === 'temperatuur') {
      return { yMin: 16, yMax: 26, ySteps: [16, 18, 20, 22, 24, 26] };
    }
    if (geselecteerdSensortype === 'co2') {
      return { yMin: 400, yMax: 1300, ySteps: [400, 600, 800, 1000, 1200] };
    }
    if (geselecteerdSensortype === 'luchtvochtigheid') {
      return { yMin: 30, yMax: 80, ySteps: [30, 40, 50, 60, 70, 80] };
    }
    return { yMin: 1005, yMax: 1035, ySteps: [1005, 1010, 1015, 1020, 1025, 1030, 1035] };
  }, [geselecteerdSensortype]);

  const chartWidth = 800;
  const chartHeight = 280;
  const padding = { top: 40, right: 75, bottom: 45, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const getYPos = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    const ratio = (clamped - yMin) / (yMax - yMin);
    return padding.top + (1 - ratio) * graphHeight;
  };

  const getXPos = (index: number) => {
    if (meetData.length <= 1) return padding.left + graphWidth / 2;
    if (weergaveModus === 'staaf') {
      const slotWidth = graphWidth / meetData.length;
      return padding.left + (index + 0.5) * slotWidth;
    }
    return padding.left + (index / (meetData.length - 1)) * graphWidth;
  };

  // Vloeiende bezier curve
  const svgPath = useMemo(() => {
    if (meetData.length === 0) return '';
    const points = meetData.map((d, i) => ({ x: getXPos(i), y: getYPos(d.waarde) }));
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  }, [meetData, yMin, yMax, weergaveModus]);

  const svgAreaPath = useMemo(() => {
    if (!svgPath || meetData.length === 0) return '';
    const lastX = getXPos(meetData.length - 1);
    const firstX = getXPos(0);
    const bottomY = padding.top + graphHeight;
    return `${svgPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [svgPath, meetData.length, weergaveModus]);

  const alarmY = getYPos(huidigeSensor.defaultGrens);
  const comfortTopY = getYPos(huidigeSensor.optimaalMax);
  const comfortBottomY = getYPos(huidigeSensor.optimaalMin);

  return (
    <div className={darkMode ? 'min-h-screen bg-slate-900 text-slate-100' : 'min-h-screen bg-slate-50 text-slate-800'}>
      {/* HEADER */}
      <AppHeader
        activePage="Sensordata"
        role={role}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigate={handleNavigation}
      />

      <main className="mx-auto max-w-7xl px-5 py-8">
        {/* TITELBALK */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Analyse
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Sensordata
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Bekijk en vergelijk historische klimaatmetingen.
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
              darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700 shadow-2xs'
            }`}
          >
            <Download size={15} />
            Data exporteren
          </button>
        </div>

        {/* OPEN-METEO WEERBALK: RUSTIG, WIJDER EN MET DUIDELIJKE AANWEZIGHEID */}
        {weather && (
          <section
            className={`mb-6 rounded-2xl border px-5 py-3.5 shadow-2xs transition ${
              darkMode
                ? 'border-slate-800 bg-slate-800/80 text-slate-200'
                : 'border-slate-200/90 bg-white text-slate-700'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Linkerzijde: titel en bron */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
                  <CloudSun size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      Buitencondities
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      Meting {weather.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Klimaatcontext buiten t.o.v. binnen in {geselecteerdGebouw}
                  </p>
                </div>
              </div>

              {/* Rechterzijde: duidelijk afleesbare buitenwaarden */}
              <div className="flex flex-wrap items-center gap-5 sm:gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Buitentemperatuur:</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {weather.temp}°C
                  </span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Binnen {statistieken.avg > weather.temp ? `+${(statistieken.avg - weather.temp).toFixed(1)}°C warmer` : `${(statistieken.avg - weather.temp).toFixed(1)}°C`}
                  </span>
                </div>

                <div className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-700" />

                <div className="flex items-center gap-2">
                  <Droplets size={16} className="text-blue-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Luchtvochtigheid:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{weather.humidity}% RV</span>
                </div>

                <div className="hidden h-4 w-px bg-slate-200 md:block dark:bg-slate-700" />

                <div className="hidden items-center gap-2 md:flex">
                  <Wind size={16} className="text-teal-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Wind:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{weather.windSpeed} km/u</span>
                </div>

                <button
                  onClick={fetchOpenMeteo}
                  title="Ververs actuele weerdata via Open-Meteo"
                  className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-slate-300 hover:text-emerald-600 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-emerald-400"
                >
                  <RefreshCw size={13} className={weatherLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* HOOFDINDELING */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* LINKER FILTERPANEEL */}
          <aside className="lg:col-span-3">
            <div
              className={`rounded-2xl border p-5 shadow-2xs ${
                darkMode ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200/80 bg-white'
              }`}
            >
              <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-slate-700/60">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Filters</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {actieveFiltersCount}
                </span>
              </div>

              <div className="space-y-4">
                {/* 1. FILTER: GEBOUW */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Gebouw
                  </label>
                  <select
                    value={geselecteerdGebouw}
                    onChange={e => handleGebouwChange(e.target.value)}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50/50 text-slate-900'
                    }`}
                  >
                    {Object.keys(gebouwenData).map(gebouw => (
                      <option key={gebouw} value={gebouw}>
                        {gebouw}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. FILTER: LOKAAL */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Lokaal
                  </label>
                  <select
                    value={geselecteerdLokaal}
                    onChange={e => setGeselecteerdLokaal(e.target.value)}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50/50 text-slate-900'
                    }`}
                  >
                    {(gebouwenData[geselecteerdGebouw] || []).map(lokaal => (
                      <option key={lokaal} value={lokaal}>
                        {lokaal}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. FILTER: SENSORTYPE */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Sensortype
                  </label>
                  <select
                    value={geselecteerdSensortype}
                    onChange={e => setGeselecteerdSensortype(e.target.value)}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50/50 text-slate-900'
                    }`}
                  >
                    {sensorTypen.map(sensor => (
                      <option key={sensor.id} value={sensor.id}>
                        {sensor.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. FILTER: PERIODE */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Periode
                  </label>
                  <select
                    value={geselecteerdePeriode}
                    onChange={e => setGeselecteerdePeriode(e.target.value)}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50/50 text-slate-900'
                    }`}
                  >
                    {periodes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-1">
                  <button
                    onClick={resetFilters}
                    className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700`}
                  >
                    <RotateCcw size={12} />
                    Filters wissen
                  </button>
                </div>
              </div>

            </div>
          </aside>

          <section className="space-y-6 lg:col-span-9">
            <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              Grafiekweergave voor {geselecteerdGebouw} · {geselecteerdLokaal}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
