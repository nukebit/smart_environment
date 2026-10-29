import { useEffect, useState } from 'react';

export type WeatherReading = {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  time: string;
};

export function useWeather(enabled: boolean) {
  const [weather, setWeather] = useState<WeatherReading | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/weather/current', {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data: WeatherReading = await response.json();
        if (!controller.signal.aborted) {
          setWeather(data);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setWeather(null);
          setError('Weergegevens tijdelijk niet beschikbaar.');
        }
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [enabled]);

  return { weather, error };
}
