import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useDarkMode } from '../hooks/useDarkMode';
import { api } from '../lib/api';

type Warning = { id: number; lokaalId: number; room: string; building: string; title: string; kind: string;
  advice: string; value: number | null; limit: number | null; unit: string; createdAt: string; measuredAt: string; isRead: boolean };
type WarningResponse = { items: Warning[]; lastSuccessAt: string | null; error: string | null };
const time = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString('nl-NL');

export default function WaarschuwingenPage() {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [data, setData] = useState<WarningResponse | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [room, setRoom] = useState('');
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const revision = useRef(0);
  const mutating = useRef(false);
  const [darkMode, toggleDarkMode] = useDarkMode();
  useEffect(() => {
    const controller = new AbortController();
    api<{ role: string }>('/api/auth/me', 'GET', undefined, controller.signal).then(setUser)
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const version = revision.current;
      try {
        const response = await api<WarningResponse>('/api/warnings', 'GET', undefined, controller.signal);
        if (!controller.signal.aborted && version === revision.current && !mutating.current) { setData(response); setError(''); }
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 30000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [user]);
  async function mark(warning: Warning, isRead: boolean) {
    if (mutating.current || warning.isRead === isRead) return;
    mutating.current = true; revision.current++; setBusy(warning.id); setActionError('');
    try {
      await api(`/api/warnings/${warning.id}/read`, 'PUT', { isRead });
      setData(previous => previous && { ...previous, items: previous.items.map(w => w.id === warning.id ? { ...w, isRead } : w) });
    } catch (e) { setActionError((e as Error).message); }
    finally { revision.current++; mutating.current = false; setBusy(null); }
  }
  const items = data?.items ?? [];
  const rooms = [...new Map(items.map(w => [w.lokaalId, `${w.building} · ${w.room}`])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const inRoom = items.filter(w => !room || String(w.lokaalId) === room);
  const visible = inRoom.filter(w => tab === 'all' || w.id === expanded || (tab === 'read' ? w.isRead : !w.isRead));
  if (!user) return <main className="p-6"><p role={error ? 'alert' : 'status'}>{error || 'Sessie controleren…'}</p></main>;
  return <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <AppHeader activePage="Waarschuwingen" role={user.role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="mb-2 text-xs font-bold tracking-wider text-brand dark:text-emerald-400">MELDINGEN</p>
      <h1 className="text-3xl font-semibold">Waarschuwingen</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bekijk afwijkingen en advies per lokaal. Open een melding om deze als gelezen te markeren.</p>
      <div className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2" aria-label="Leesstatus">{([
          ['all', 'Alle', inRoom.length], ['unread', 'Ongelezen', inRoom.filter(w => !w.isRead).length], ['read', 'Gelezen', inRoom.filter(w => w.isRead).length]
        ] as const).map(([id, label, count]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setExpanded(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-brand text-white' : 'border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'}`}>{label} ({count})</button>)}</div>
        <label className="text-sm font-semibold">Lokaal
          <select value={room} onChange={e => { setRoom(e.target.value); setExpanded(null); }} className="ml-3 rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
            <option value="">Alle lokalen</option>{rooms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      {(error || actionError || data?.error) && <p role="alert" className="mb-4 rounded-lg border border-amber-400 p-3 text-sm">{actionError || error || data?.error}</p>}
      <section aria-label="Meldingen" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {!data ? <p role="status" className="p-8">{error ? 'Meldingen zijn nog niet beschikbaar. We proberen het opnieuw.' : 'Meldingen laden…'}</p>
          : !visible.length ? <div className="p-10 text-center"><Bell className="mx-auto mb-3 text-slate-400" /><p>{items.length ? 'Geen meldingen voor deze selectie.' : 'Nog geen meldingen.'}</p><p className="mt-2 text-sm text-slate-500">Nieuwe meldingen verschijnen hier zodra ze worden vastgesteld.</p></div>
          : visible.map(w => <article key={w.id} className={`border-b border-slate-200 last:border-b-0 dark:border-slate-700 ${!w.isRead ? 'border-l-4 border-l-blue-600 bg-blue-50 text-slate-950 dark:border-l-blue-400 dark:bg-blue-950/40 dark:text-slate-50' : 'border-l-4 border-l-transparent bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400'}`}>
            <button aria-label={`${w.title}, ${w.room}, ${w.isRead ? 'gelezen' : 'ongelezen'}`} disabled={busy !== null} aria-expanded={expanded === w.id} aria-controls={`warning-${w.id}`} onClick={() => {
              if (expanded === w.id) setExpanded(null); else { setExpanded(w.id); void mark(w, true); }
            }} className="flex w-full items-start gap-3 p-5 text-left hover:bg-slate-100/60 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-slate-700/40">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${w.isRead ? 'bg-transparent' : 'bg-blue-600 dark:bg-blue-400'}`} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className={w.isRead ? "font-medium" : "font-bold"}>{w.title}</h2></div>
                <p className="mt-1 text-sm">{w.building} · {w.room}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{time(w.createdAt)}{w.value !== null && ` · ${w.value.toLocaleString('nl-NL')} ${w.unit}`}</p>
                <p className="mt-2 text-sm"><strong>Advies:</strong> {w.advice}</p>
              </div><ChevronDown size={18} className={`mt-1 shrink-0 ${expanded === w.id ? 'rotate-180' : ''}`} />
            </button>
            {expanded === w.id && <div id={`warning-${w.id}`} className="border-t border-slate-200 px-10 py-4 text-sm dark:border-slate-700">
              {w.limit !== null && <p>{w.kind.endsWith('-high') ? 'Bovengrens' : 'Ondergrens'} bij melding: {w.limit.toLocaleString('nl-NL')} {w.unit}</p>}
              <p className="mt-1">Meettijdstip: {time(w.measuredAt)}</p>
            </div>}
          </article>)}
      </section>
      <p role="status" className="mt-4 text-xs text-slate-500 dark:text-slate-400">{data?.lastSuccessAt ? `Laatste geslaagde sensorcontrole: ${time(data.lastSuccessAt)}. ` : 'Nog geen geslaagde sensorcontrole. '}De lijst wordt elke 30 seconden opgehaald.</p>
    </main>
  </div>;
}
