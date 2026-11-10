import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useDarkMode } from '../hooks/useDarkMode';

// Voorbeeldgegevens voor het ontwerp; nog niet gekoppeld aan sensoren.
const warnings = [
  { label: 'GRENSWAARDE', location: 'Lokaal 2.14', measurement: 'Temperatuur · 24,8°C', detail: 'Streefwaarde 20,5°C', advice: 'Te warm: ventileren aub', action: 'Afhandelen', offline: false },
  { label: 'OFFLINE (>5 MIN)', location: 'Lokaal 1.08', measurement: 'Luchtdruk · Geen signaal', detail: 'Ontvangen sinds 13:10', advice: 'Controleer voeding en verbinding.', action: 'Controleren', offline: true },
];

export default function WaarschuwingenPage() {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [darkMode, toggleDarkMode] = useDarkMode();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }
        if (!response.ok) throw new Error();
        setUser(await response.json());
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Sessie controleren mislukt. Vernieuw de pagina.');
      });
    return () => controller.abort();
  }, []);

  if (!user) return <main className="p-6"><p role={error ? 'alert' : 'status'}>{error || 'Sessie controleren…'}</p></main>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <AppHeader activePage="Waarschuwingen" role={user.role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <section className="mb-8">
          <p className="mb-2 text-xs font-bold tracking-wider text-brand dark:text-emerald-400">MELDINGEN</p>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-semibold">Waarschuwingen &amp; sensorstatus</h1>
              <p className="mt-2 text-sm text-[#697879] dark:text-slate-400">Bekijk afwijkingen en onderneem direct actie.</p>
            </div>
            <button onClick={() => setNotice('Meldingsinstellingen zijn nog niet beschikbaar in deze demo.')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">Meldingsinstellingen</button>
          </div>
        </section>

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#afe1d5] bg-[#e0f4ed] px-4 py-4 text-[#075e51] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <Info size={20} className="shrink-0" aria-hidden="true" />
          <p className="text-sm"><strong>Systeemregel:</strong> Een sensor krijgt status ‘Offline’ na 5 minuten zonder inkomende data.</p>
        </div>

        <section aria-label="Overzicht meldingen" className="mb-6 grid gap-5 md:grid-cols-3">
          {[
            { label: 'Openstaand', value: '2', detail: 'Vereist aandacht' },
            { label: 'Vandaag afgehandeld', value: '4', detail: 'Binnen gemiddeld 12 min' },
            { label: 'Sensoren online', value: '11/12', detail: '91,7% beschikbaar' },
          ].map(stat => (
            <article key={stat.label} className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-[#697879] dark:text-slate-400">{stat.label}</h2>
              <p className="my-2 text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm text-[#697879] dark:text-slate-400">{stat.detail}</p>
            </article>
          ))}
        </section>

        <section id="actieve-waarschuwingen" aria-labelledby="warnings-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div>
              <h2 id="warnings-heading" className="text-xl font-semibold">Actieve waarschuwingen</h2>
            </div>
            <span title="Voorbeeldweergave; nog geen live vernieuwing" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold tracking-wide text-[#697879] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">AUTOMATISCH VERNIEUWD</span>
          </div>
          {warnings.map(warning => (
            <article key={warning.label} className="relative grid items-center gap-5 border-b border-slate-200 px-5 py-5 text-sm last:border-b-0 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_1.5fr_1.8fr_auto] dark:border-slate-700">
              <span aria-hidden="true" className={`absolute bottom-4 left-0 top-4 w-1 rounded-r ${warning.offline ? 'bg-red-700' : 'bg-amber-600'}`} />
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide text-[#697879] ${warning.offline ? 'bg-[#fcebec]' : 'bg-[#fbefdb]'}`}>{warning.label}</span>
                <p className="mt-3 text-sm text-[#697879] dark:text-slate-400">Vandaag, 13:15</p>
              </div>
              <div><p className="mb-2 text-sm text-[#697879] dark:text-slate-400">Locatie</p><p className="font-semibold">{warning.location}</p></div>
              <div><p className="mb-2 text-sm text-[#697879] dark:text-slate-400">Meting</p><p className="font-semibold">{warning.measurement}</p><p className="mt-2 text-sm text-[#697879] dark:text-slate-400">{warning.detail}</p></div>
              <div><p className="mb-2 text-sm text-[#697879] dark:text-slate-400">Advies</p><p className="font-semibold">{warning.advice}</p></div>
              <button onClick={() => setNotice(`${warning.location}: dit is een voorbeeldmelding. Acties zijn beschikbaar zodra sensoren zijn gekoppeld.`)} className={`justify-self-start rounded-lg px-4 py-2 text-sm font-semibold xl:justify-self-end ${warning.offline ? 'border border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700' : 'bg-brand text-white shadow-md hover:bg-brand-dark'}`}>{warning.action}</button>
            </article>
          ))}
        </section>
        <p role="status" className="mt-4 text-sm text-slate-500 dark:text-slate-400">{notice || 'Voorbeeldgegevens · sensoren nog niet gekoppeld.'}</p>
      </main>
    </div>
  );
}
