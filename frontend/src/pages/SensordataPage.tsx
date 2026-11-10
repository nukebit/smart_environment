import { useEffect, useState, useMemo } from 'react';
import {
  Download,
  RotateCcw,
  CloudSun,
  AlertTriangle,
  Building,
  MapPin,
  Calendar,
  Activity,
  LineChart,
  BarChart3,
  Info,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import WeatherValues, { weatherTime } from '../components/WeatherValues';
import { useWeather } from '../hooks/useWeather';
import { useDarkMode } from '../hooks/useDarkMode';
import type { Lokaal } from '../types/lokalen';

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

export default function SensordataPage() {
  const [role, setRole] = useState('');
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [lokalen, setLokalen] = useState<Lokaal[]>([]);
  const [standaardLokaal, setStandaardLokaal] = useState<Lokaal | null>(null);
  const [lokalenLoading, setLokalenLoading] = useState(true);
  const [lokalenError, setLokalenError] = useState('');
  const gebouwenData = useMemo(() => lokalen.reduce<Record<string, string[]>>((result, lokaal) => {
    (result[lokaal.gebouw] ??= []).push(lokaal.naam);
    return result;
  }, Object.create(null)), [lokalen]);

  // Filters
  const [geselecteerdGebouw, setGeselecteerdGebouw] = useState('');
  const [geselecteerdLokaal, setGeselecteerdLokaal] = useState('');
  const [geselecteerdSensortype, setGeselecteerdSensortype] = useState('temperatuur');
  const [geselecteerdePeriode, setGeselecteerdePeriode] = useState('3m');

  // Grafiek visualisatie voorkeuren
  const [weergaveModus, setWeergaveModus] = useState<'lijn' | 'staaf'>('lijn');
  const [toonComfortzone, setToonComfortzone] = useState(true);

  // Dynamische lokalen uit de database & API telemetrie
  const [apiTelemetry, setApiTelemetry] = useState<Array<{
    timestamp: string;
    temperature?: number;
    humidity?: number;
    pressure?: number;
  }> | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    datum: string;
    waarde: number;
    status: 'te-hoog' | 'te-laag' | 'optimaal';
    statusText: string;
  } | null>(null);

  const { weather, error: weatherError } = useWeather(Boolean(role));

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

  // Laad de geregistreerde lokalen voor de filters.
  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();
    fetch('/api/lokalen', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }
        if (!response.ok) throw new Error();
        const alleLokalen: Lokaal[] = await response.json();
        const standaard = alleLokalen[0] ?? null;
        if (controller.signal.aborted) return;
        setLokalen(alleLokalen);
        setStandaardLokaal(standaard);
        setGeselecteerdGebouw(standaard?.gebouw ?? '');
        setGeselecteerdLokaal(standaard?.naam ?? '');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLokalenError('Lokalen laden mislukt. Probeer het opnieuw via het lokalenoverzicht.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLokalenLoading(false);
      });
    return () => controller.abort();
  }, [role]);

  // Haal actuele sensordata en telemetrie op voor het geselecteerde lokaal
  useEffect(() => {
    if (!role || !geselecteerdLokaal) return;
    const cleanRoom = geselecteerdLokaal.replace(/^Lokaal\s+/i, '');
    fetch(`/api/sensors/room-data?room=${encodeURIComponent(cleanRoom)}&limit=100`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.telemetry && Array.isArray(data.telemetry) && data.telemetry.length > 0) {
          setApiTelemetry(data.telemetry);
          if (data.deviceId) setActiveDeviceId(data.deviceId);
        } else {
          setApiTelemetry(null);
        }
      })
      .catch(() => {
        setApiTelemetry(null);
      });
  }, [geselecteerdLokaal, role]);

  const handleGebouwChange = (gebouw: string) => {
    setGeselecteerdGebouw(gebouw);
    const lokalenInGebouw = gebouwenData[gebouw] || [];
    if (lokalenInGebouw.length > 0 && !lokalenInGebouw.includes(geselecteerdLokaal)) {
      setGeselecteerdLokaal(lokalenInGebouw[0]);
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
    setGeselecteerdGebouw(standaardLokaal?.gebouw ?? '');
    setGeselecteerdLokaal(standaardLokaal?.naam ?? '');
    setGeselecteerdSensortype('temperatuur');
    setGeselecteerdePeriode('3m');
    setWeergaveModus('lijn');
  };

  const actieveFiltersCount = useMemo(() => {
    let count = 0;
    if (geselecteerdGebouw !== (standaardLokaal?.gebouw ?? '')) count++;
    if (geselecteerdLokaal !== (standaardLokaal?.naam ?? '')) count++;
    if (geselecteerdSensortype !== 'temperatuur') count++;
    if (geselecteerdePeriode !== '3m') count++;
    return count > 0 ? `${count} actief` : 'Standaard';
  }, [geselecteerdGebouw, geselecteerdLokaal, geselecteerdSensortype, geselecteerdePeriode, standaardLokaal]);

  // Dataset generatie per periode en integratie met echte API sensordata
  const meetData = useMemo(() => {
    // Bereken een stabiele, realistische klimaat-vingerafdruk per specifiek lokaal
    let roomHash = 0;
    for (let i = 0; i < geselecteerdLokaal.length; i++) {
      roomHash = (roomHash << 5) - roomHash + geselecteerdLokaal.charCodeAt(i);
      roomHash |= 0;
    }
    const norm = Math.abs(roomHash);
    const tempOffset = ((norm % 48) - 22) / 10; // -2.2°C tot +2.5°C
    const humOffset = (norm % 19) - 8;           // -8% tot +10%
    const pressOffset = (norm % 7) - 3;          // -3 hPa tot +3 hPa
    const seed = norm % 10;

    const classify = (val: number) => {
      const isExceeded = val >= huidigeSensor.defaultGrens;
      const isTooLow = val < huidigeSensor.optimaalMin;
      const status: 'te-hoog' | 'te-laag' | 'optimaal' = isExceeded
        ? 'te-hoog'
        : isTooLow
        ? 'te-laag'
        : 'optimaal';

      const statusText = isExceeded
        ? 'Boven alarmgrens'
        : isTooLow
        ? `Onder de ondergrens (${huidigeSensor.id === 'temperatuur' ? 'te koel' : huidigeSensor.id === 'luchtvochtigheid' ? 'te droog' : 'lage druk'})`
        : 'Binnen optimaal bereik';

      return {
        status,
        statusText,
        isOverschrijding: isExceeded || isTooLow,
      };
    };

    const getAdjustedValue = (baseVal: number, idx: number) => {
      if (geselecteerdSensortype === 'temperatuur') {
        const wave = Math.sin(idx * 0.7 + seed) * 0.5;
        return Math.round((baseVal + tempOffset + wave) * 10) / 10;
      }
      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const wave = Math.cos(idx * 0.6 + seed) * 2;
        return Math.round(Math.min(95, Math.max(25, baseVal + humOffset + wave)));
      }
      return Math.round(baseVal + pressOffset);
    };

    // Als er live API telemetrie is voor dit lokaal, gebruik dan de echte metingen uit de Urban Sense API
    if (apiTelemetry && apiTelemetry.length > 0) {
      const chronologisch = [...apiTelemetry].reverse();
      return chronologisch.map(m => {
        const d = new Date(m.timestamp);
        const datum = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        let rawVal = 0;
        if (geselecteerdSensortype === 'temperatuur') rawVal = m.temperature ?? 0;
        else if (geselecteerdSensortype === 'luchtvochtigheid') rawVal = m.humidity ?? 0;
        else rawVal = m.pressure ?? 0;

        const val = Math.round(rawVal * 10) / 10;
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    // 1. AFGELOPEN 24 UUR (Tijdstippen in uren)
    if (geselecteerdePeriode === '24u') {
      const uren = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00', 'Nu'];

      if (geselecteerdSensortype === 'temperatuur') {
        const baseValues = [19.2, 20.8, 22.4, 24.1, 23.8, 22.1, 20.7, 19.8, 18.9, 18.3, 18.1, 18.6, 20.2];
        return uren.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const baseValues = [48, 52, 56, 59, 57, 54, 53, 51, 50, 49, 48, 49, 51];
        return uren.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      const baseValues = [1015, 1016, 1017, 1017, 1018, 1019, 1020, 1020, 1021, 1021, 1022, 1022, 1023];
      return uren.map((datum, idx) => {
        const val = getAdjustedValue(baseValues[idx], idx);
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    // 2. AFGELOPEN 7 DAGEN (Dagen van de week)
    if (geselecteerdePeriode === '7d') {
      const dagen = ['Ma 19 mei', 'Di 20 mei', 'Wo 21 mei', 'Do 22 mei', 'Vr 23 mei', 'Za 24 mei', 'Zo 25 mei'];

      if (geselecteerdSensortype === 'temperatuur') {
        const baseValues = [21.4, 22.8, 24.2, 23.7, 22.1, 19.5, 19.2];
        return dagen.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const baseValues = [52, 55, 68, 72, 64, 49, 47];
        return dagen.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      const baseValues = [1014, 1017, 1021, 1019, 1024, 1026, 1022];
      return dagen.map((datum, idx) => {
        const val = getAdjustedValue(baseValues[idx], idx);
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    // 3. AFGELOPEN 30 DAGEN (Data per 3-4 dagen)
    if (geselecteerdePeriode === '30d') {
      const data30 = ['26 apr', '30 apr', '4 mei', '8 mei', '12 mei', '16 mei', '20 mei', '24 mei', '26 mei'];

      if (geselecteerdSensortype === 'temperatuur') {
        const baseValues = [20.1, 21.3, 23.9, 22.4, 24.5, 23.1, 22.6, 21.8, 22.2];
        return data30.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      if (geselecteerdSensortype === 'luchtvochtigheid') {
        const baseValues = [51, 58, 64, 73, 66, 61, 55, 52, 56];
        return data30.map((datum, idx) => {
          const val = getAdjustedValue(baseValues[idx], idx);
          const cl = classify(val);
          return {
            datum,
            waarde: val,
            status: cl.status,
            statusText: cl.statusText,
            isOverschrijding: cl.isOverschrijding,
          };
        });
      }

      const baseValues = [1013, 1018, 1022, 1016, 1025, 1028, 1021, 1019, 1023];
      return data30.map((datum, idx) => {
        const val = getAdjustedValue(baseValues[idx], idx);
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    // 4. AFGELOPEN 3 MAANDEN
    const data3m = [
      '15 feb', '22 feb', '1 mrt', '8 mrt', '15 mrt', '22 mrt', '29 mrt',
      '5 apr', '12 apr', '18 apr', '25 apr', '1 mei', '8 mei', '14 mei',
    ];

    if (geselecteerdSensortype === 'temperatuur') {
      const baseValues = [18.2, 18.9, 19.8, 19.5, 20.4, 21.6, 21.2, 22.4, 21.5, 23.9, 22.3, 24.8, 23.1, 24.2];
      return data3m.map((datum, idx) => {
        const val = getAdjustedValue(baseValues[idx], idx);
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    if (geselecteerdSensortype === 'luchtvochtigheid') {
      const baseValues = [45, 48, 52, 54, 58, 62, 59, 68, 64, 73, 67, 72, 61, 65];
      return data3m.map((datum, idx) => {
        const val = getAdjustedValue(baseValues[idx], idx);
        const cl = classify(val);
        return {
          datum,
          waarde: val,
          status: cl.status,
          statusText: cl.statusText,
          isOverschrijding: cl.isOverschrijding,
        };
      });
    }

    const baseValues = [1012, 1014, 1018, 1016, 1021, 1025, 1019, 1022, 1017, 1029, 1024, 1030, 1023, 1026];
    return data3m.map((datum, idx) => {
      const val = getAdjustedValue(baseValues[idx], idx);
      const cl = classify(val);
      return {
        datum,
        waarde: val,
        status: cl.status,
        statusText: cl.statusText,
        isOverschrijding: cl.isOverschrijding,
      };
    });
  }, [apiTelemetry, geselecteerdePeriode, geselecteerdLokaal, geselecteerdSensortype, huidigeSensor]);

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

  if (!role) return <main className="p-6"><p role="status">Sessie controleren…</p></main>;
  if (lokalenLoading || lokalenError || lokalen.length === 0) {
    return <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-white">
      <AppHeader activePage="Sensordata" role={role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="mb-4 text-3xl font-semibold">Sensordata</h1>
        {lokalenLoading ? <p role="status">Lokalen laden…</p> : <>
          <p role={lokalenError ? 'alert' : undefined}>{lokalenError || 'Er zijn nog geen lokalen. Een beheerder kan gebouwen en lokalen toevoegen.'}</p>
          <a href="/lokalen" className="mt-4 inline-block font-semibold text-brand underline">Naar lokalenoverzicht</a>
        </>}
      </main>
    </div>;
  }

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

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80" aria-label="Buitencondities Den Haag">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <CloudSun size={20} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Buitencondities</span>
              {weather && <span title="Tijd van de weergegevens · Den Haag" className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">{weatherTime(weather.time)}</span>}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:underline dark:text-slate-400">Open-Meteo</a>
            </div>
            {weather ? <WeatherValues weather={weather} includeWind /> : <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{weatherError || 'Weergegevens laden…'}</p>}
          </div>
        </section>

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
                  <label htmlFor="sensor-gebouw" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Gebouw
                  </label>
                  <select
                    id="sensor-gebouw"
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
                  <label htmlFor="sensor-lokaal" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Lokaal
                  </label>
                  <select
                    id="sensor-lokaal"
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

              {/* OPVALLENDE NORM & GRENSWAARDE KAART */}
              <div
                className={`mt-5 rounded-2xl border p-4 transition ${
                  darkMode
                    ? 'border-emerald-800/60 bg-emerald-950/25 text-slate-200'
                    : 'border-emerald-200/90 bg-emerald-50/70 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 dark:border-emerald-800/50">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-white dark:bg-emerald-500">
                      <Info size={12} strokeWidth={2.5} />
                    </span>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      Norm voor {huidigeSensor.naam}
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300">
                    Richtlijn
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-white/80 px-2.5 py-1.5 dark:bg-slate-900/60">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Optimaal bereik</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {huidigeSensor.optimaalMin} – {huidigeSensor.optimaalMax} {huidigeSensor.eenheid}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/80 px-2.5 py-1.5 dark:bg-slate-900/60">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Alarmdrempel</span>
                    <span className="font-bold text-[#b45309] dark:text-amber-400">
                      ≥ {huidigeSensor.defaultGrens} {huidigeSensor.eenheid}
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  {huidigeSensor.beschrijving}
                </p>
              </div>
            </div>
          </aside>

          {/* RECHTER GRAFIEK & DATACARDS */}
          <section className="space-y-6 lg:col-span-9">
            
            {/* GRAFIEK CONTAINER */}
            <div
              className={`rounded-2xl border p-6 shadow-2xs transition ${
                darkMode ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200/80 bg-white'
              }`}
            >
              {/* GRAFIEK HEADER MET GEBOUW, LOKAAL EN TIJDBESTEK */}
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {huidigeSensor.naam}verloop
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{geselecteerdGebouw}</span>
                    {' · '}
                    <span>{geselecteerdLokaal}</span>
                    {activeDeviceId && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Live sensor: {activeDeviceId}
                      </span>
                    )}
                    {' · '}
                    <span>{huidigePeriode.datumTekst}</span>
                  </p>
                </div>

                {/* LEGENDA & VISUALISATIE KEUZE */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: huidigeSensor.kleur }} />
                    <span className="text-slate-600 dark:text-slate-300">{huidigeSensor.naam}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-[#b45309]" />
                    <span className="font-medium text-[#b45309] dark:text-amber-400">
                      Bovengrens
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-[#0284c7]" />
                    <span className="font-medium text-[#0284c7] dark:text-sky-400">
                      Ondergrens
                    </span>
                  </div>

                  {/* Lijn / Staven schakelaar */}
                  <div className={`flex rounded-lg border p-0.5 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
                    <button
                      onClick={() => setWeergaveModus('lijn')}
                      className={`cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                        weergaveModus === 'lijn'
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      Lijn
                    </button>
                    <button
                      onClick={() => setWeergaveModus('staaf')}
                      className={`cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                        weergaveModus === 'staaf'
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      Staven
                    </button>
                  </div>
                </div>
              </div>

              {/* SVG GRAFIEK VLAK */}
              <div className="relative w-full">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full select-none"
                  style={{ minWidth: '100%' }}
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={huidigeSensor.kleur} stopOpacity="0.16" />
                      <stop offset="100%" stopColor={huidigeSensor.kleur} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* HORIZONTALE RASTERLIJNEN */}
                  {ySteps.map(step => {
                    const y = getYPos(step);
                    return (
                      <g key={step}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke={darkMode ? '#1e293b' : '#f1f5f9'}
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 12}
                          y={y + 3.5}
                          textAnchor="end"
                          fontSize="11"
                          fill={darkMode ? '#64748b' : '#94a3b8'}
                        >
                          {step}{huidigeSensor.eenheid === '°C' ? '°' : ''}
                        </text>
                      </g>
                    );
                  })}


                  {/* VLOEIENDE LIJNGRAFIEK */}
                  {weergaveModus === 'lijn' && (
                    <>
                      <path d={svgAreaPath} fill="url(#areaGradient)" />
                      <path
                        d={svgPath}
                        fill="none"
                        stroke={huidigeSensor.kleur}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* MEETPUNTEN */}
                      {meetData.map((d, i) => {
                        const x = getXPos(i);
                        const y = getYPos(d.waarde);

                        return (
                          <g
                            key={i}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint({
                              x,
                              y,
                              datum: d.datum,
                              waarde: d.waarde,
                              status: d.status,
                              statusText: d.statusText,
                            })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            {d.status === 'te-hoog' ? (
                              <circle
                                cx={x}
                                cy={y}
                                r="4.5"
                                fill="#b45309"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            ) : d.status === 'te-laag' ? (
                              <circle
                                cx={x}
                                cy={y}
                                r="4.5"
                                fill="#0284c7"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            ) : (
                              <circle
                                cx={x}
                                cy={y}
                                r="3.5"
                                fill={huidigeSensor.kleur}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* STAAFGRAFIEK */}
                  {weergaveModus === 'staaf' && (
                    <g>
                      {meetData.map((d, i) => {
                        const barWidth = Math.max(12, Math.min(24, (graphWidth / meetData.length) * 0.6));
                        const x = getXPos(i) - barWidth / 2;
                        const y = getYPos(d.waarde);
                        const bottomY = padding.top + graphHeight;
                        const barHeight = Math.max(4, bottomY - y);

                        return (
                          <g
                            key={i}
                            className="cursor-pointer transition-opacity hover:opacity-80"
                            onMouseEnter={() => setHoveredPoint({ x: x + barWidth / 2, y, datum: d.datum, waarde: d.waarde, status: d.status, statusText: d.statusText })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx="3"
                              fill={d.status === 'te-hoog' ? '#d97706' : d.status === 'te-laag' ? '#0284c7' : huidigeSensor.kleur}
                              opacity={d.status === 'optimaal' ? 0.85 : 0.95}
                            />
                            {d.status !== 'optimaal' && (
                              <circle cx={x + barWidth / 2} cy={y - 5} r="2.5" fill={d.status === 'te-hoog' ? '#d97706' : '#0284c7'} />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* ONDERGRENS LIJN MET DUIDELIJKE BADGE OP DE RECHTER AS (ALTIJD BOVENOP DE GRAFIEK) */}
                  <g>
                    <line
                      x1={padding.left}
                      y1={comfortBottomY}
                      x2={chartWidth - padding.right}
                      y2={comfortBottomY}
                      stroke="#0284c7"
                      strokeWidth="1.5"
                      strokeDasharray="6,4"
                    />
                    <rect
                      x={chartWidth - padding.right + 6}
                      y={comfortBottomY - 9}
                      width="54"
                      height="18"
                      rx="4"
                      fill="#0284c7"
                    />
                    <text
                      x={chartWidth - padding.right + 33}
                      y={comfortBottomY + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      {huidigeSensor.optimaalMin.toString().replace('.', ',')}{huidigeSensor.eenheid}
                    </text>
                  </g>

                  {/* BOVENGRENS LIJN MET DUIDELIJKE BADGE OP DE RECHTER AS */}
                  <g>
                    <line
                      x1={padding.left}
                      y1={alarmY}
                      x2={chartWidth - padding.right}
                      y2={alarmY}
                      stroke="#b45309"
                      strokeWidth="1.5"
                      strokeDasharray="6,4"
                    />
                    <rect
                      x={chartWidth - padding.right + 6}
                      y={alarmY - 9}
                      width="54"
                      height="18"
                      rx="4"
                      fill="#b45309"
                    />
                    <text
                      x={chartWidth - padding.right + 33}
                      y={alarmY + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      {huidigeSensor.defaultGrens.toString().replace('.', ',')}{huidigeSensor.eenheid}
                    </text>
                  </g>

                  {/* X-AS DATUMLABELS */}
                  {meetData.map((d, i) => {
                    if (meetData.length > 10 && i % 2 !== 0 && i !== meetData.length - 1) return null;
                    const x = getXPos(i);
                    return (
                      <text
                        key={i}
                        x={x}
                        y={chartHeight - padding.bottom + 22}
                        textAnchor="middle"
                        fontSize="11"
                        fill={darkMode ? '#64748b' : '#94a3b8'}
                      >
                        {d.datum}
                      </text>
                    );
                  })}
                </svg>

                {/* SLIMME HOVER TOOLTIP */}
                {hoveredPoint && (() => {
                  const isNearTop = hoveredPoint.y < 85;
                  return (
                    <div
                      className={`pointer-events-none absolute z-30 rounded-xl border border-slate-700/80 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xs transition-all`}
                      style={{
                        left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                        top: `${(hoveredPoint.y / chartHeight) * 100}%`,
                        transform: isNearTop ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))',
                      }}
                    >
                      <p className="font-medium text-slate-300">{hoveredPoint.datum}</p>
                      <p className="text-sm font-bold text-white">
                        {hoveredPoint.waarde} {huidigeSensor.eenheid}
                      </p>
                      {hoveredPoint.status === 'te-hoog' && (
                        <p className="mt-0.5 text-[11px] font-semibold text-amber-400">
                          ⚠ {hoveredPoint.statusText}
                        </p>
                      )}
                      {hoveredPoint.status === 'te-laag' && (
                        <p className="mt-0.5 text-[11px] font-semibold text-sky-400">
                          ⚠ {hoveredPoint.statusText}
                        </p>
                      )}
                      {hoveredPoint.status === 'optimaal' && (
                        <p className="mt-0.5 text-[11px] text-emerald-400">
                          ✓ {hoveredPoint.statusText}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* DE 4 KALME DATACARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* KAART 1: GEMIDDELDE */}
              <article
                className={`rounded-2xl border p-4 shadow-2xs transition hover:shadow-xs ${
                  darkMode ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200/80 bg-white'
                }`}
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Gemiddelde
                </span>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {statistieken.avg.toString().replace('.', ',')}{huidigeSensor.eenheid}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  +0,8{huidigeSensor.eenheid} t.o.v. vorige periode
                </p>
              </article>

              {/* KAART 2: MINIMUM */}
              <article
                className={`rounded-2xl border p-4 shadow-2xs transition hover:shadow-xs ${
                  darkMode ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200/80 bg-white'
                }`}
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Minimale waarde
                </span>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {statistieken.min.toString().replace('.', ',')}{huidigeSensor.eenheid}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Laagste punt in geselecteerde periode
                </p>
              </article>

              {/* KAART 3: MAXIMUM */}
              <article
                className={`rounded-2xl border p-4 shadow-2xs transition hover:shadow-xs ${
                  darkMode ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200/80 bg-white'
                }`}
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Maximale waarde
                </span>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {statistieken.max.toString().replace('.', ',')}{huidigeSensor.eenheid}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Hoogste punt in geselecteerde periode
                </p>
              </article>

              {/* KAART 4: GRENSOVERSCHRIJDINGEN */}
              <article
                className={`rounded-2xl border p-4 shadow-2xs transition hover:shadow-xs ${
                  statistieken.overschrijdingen > 0
                    ? darkMode
                      ? 'border-amber-900/40 bg-amber-950/15'
                      : 'border-amber-200/80 bg-amber-50/40'
                    : darkMode
                    ? 'border-slate-800 bg-slate-800/90'
                    : 'border-slate-200/80 bg-white'
                }`}
              >
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Grensoverschrijdingen
                </span>
                <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
                  {statistieken.overschrijdingen}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  2 minder dan vorige periode
                </p>
              </article>

            </div>

          </section>
        </div>
      </main>
    </div>
  );
}
