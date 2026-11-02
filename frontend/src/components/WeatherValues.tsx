import { Thermometer, Droplets, Gauge, Wind } from 'lucide-react';
import type { WeatherReading } from '../hooks/useWeather';

export function weatherTime(time: string) {
  return new Date(time).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit',
  });
}

export default function WeatherValues({ weather, includeWind = false }: { weather: WeatherReading; includeWind?: boolean }) {
  const values = [
    { label: 'Temperatuur', value: weather.temperature, unit: '°C', icon: Thermometer, color: 'text-orange-500' },
    { label: 'Luchtvochtigheid', value: weather.humidity, unit: '%', icon: Droplets, color: 'text-blue-500' },
    { label: 'Luchtdruk', value: weather.pressure, unit: 'hPa', icon: Gauge, color: 'text-violet-500' },
    ...(includeWind ? [{ label: 'Wind', value: weather.windSpeed, unit: 'km/u', icon: Wind, color: 'text-teal-500' }] : []),
  ];
  return <div className={`grid gap-x-4 gap-y-3 ${includeWind ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
    {values.map(({ label, value, unit, icon: Icon, color }) => (
      <div key={label} className="flex min-w-0 items-center gap-2">
        <Icon size={18} className={`shrink-0 ${color}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-words text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white">{value.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} {unit}</p>
        </div>
      </div>
    ))}
  </div>;
}
