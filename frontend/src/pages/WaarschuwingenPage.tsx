import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Download, Trash2 } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import FormDialog from '../components/FormDialog';
import { useDarkMode } from '../hooks/useDarkMode';
import { api } from '../lib/api';

type Warning = { id: number; lokaalId: number; room: string; building: string; title: string; kind: string;
  advice: string; value: number | null; limit: number | null; unit: string; createdAt: string; measuredAt: string; isRead: boolean };
type WarningResponse = { items: Warning[]; lastSuccessAt: string | null; error: string | null };
const time = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString('nl-NL');

// Kleur per soort melding: te hoog = rood, te laag = blauw, overig (sensorproblemen) = amber.
const tone = (kind: string) => {
  if (kind.startsWith('temperature')) return 'temperature';
  if (kind.startsWith('humidity')) return 'humidity';
  if (kind.startsWith('pressure')) return 'pressure';
  return 'other';
};

// Categorie van een melding, afgeleid van de soort: 'temperature-high' wordt 'temperature'.
const category = (kind: string) => kind.split('-')[0];

// De sensorfilter toont alleen ontbrekende recente data; ongeldige meetwaarden blijven bij hun meetcategorie.
const isSensorWarning = (kind: string) => kind === 'stale';

const toneStyles = {
  temperature: {
    label: 'Temperatuur',
    border: 'border-l-red-600 dark:border-l-red-400',
    unread: 'bg-red-50 dark:bg-red-950/40',
    dot: 'bg-red-600 dark:bg-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  },
  humidity: {
    label: 'Luchtvochtigheid',
    border: 'border-l-blue-600 dark:border-l-blue-400',
    unread: 'bg-blue-50 dark:bg-blue-950/40',
    dot: 'bg-blue-600 dark:bg-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  },
  pressure: {
    label: 'Luchtdruk',
    border: 'border-l-green-600 dark:border-l-green-400',
    unread: 'bg-green-50 dark:bg-green-950/40',
    dot: 'bg-green-600 dark:bg-green-400',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  },
  other: {
    label: 'Sensor',
    border: 'border-l-amber-500 dark:border-l-amber-400',
    unread: 'bg-amber-50 dark:bg-amber-950/40',
    dot: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
} as const;

export default function WaarschuwingenPage() {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [data, setData] = useState<WarningResponse | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [room, setRoom] = useState('');
  const [tab, setTab] = useState<'all' | 'temperature' | 'humidity' | 'pressure' | 'sensor'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Warning | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCount, setExportCount] = useState('100');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const exporting = useRef(false);
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
  // Alleen een beheerder mag een gelezen melding definitief verwijderen (ook uit de database).
  async function remove(warning: Warning) {
    if (mutating.current || !warning.isRead || user?.role !== 'Beheerder') return;
    mutating.current = true; revision.current++; setBusy(warning.id); setActionError('');
    try {
      await api(`/api/warnings/${warning.id}`, 'DELETE', undefined);
      setData(previous => previous && { ...previous, items: previous.items.filter(w => w.id !== warning.id) });
      setExpanded(current => (current === warning.id ? null : current));
      setTeVerwijderen(null);
    } catch (e) { setActionError((e as Error).message); }
    finally { revision.current++; mutating.current = false; setBusy(null); }
  }
  const isBeheerder = user?.role === 'Beheerder';
  const items = data?.items ?? [];
  const rooms = [...new Map(items.map(w => [w.lokaalId, `${w.building} · ${w.room}`])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const inRoom = items.filter(w => !room || String(w.lokaalId) === room);
  const visible = inRoom.filter(w => tab === 'all' || (tab === 'sensor' ? isSensorWarning(w.kind) : category(w.kind) === tab));
  const count = Number(exportCount);
  const validExportCount = Number.isInteger(count) && count >= 1 && count <= visible.length;
  const exportCategory = { all: 'Alle', temperature: 'Temperatuur', humidity: 'Luchtvochtigheid', pressure: 'Luchtdruk', sensor: 'Sensor' }[tab];
  const exportRoom = rooms.find(([id]) => String(id) === room)?.[1] ?? 'Alle lokalen';

  async function downloadPdf() {
    if (!validExportCount || exporting.current) return;
    exporting.current = true; setExportBusy(true); setExportError('');
    try {
      const { createWarningsPdf } = await import('../lib/warningsPdf');
      const pdf = createWarningsPdf(visible, count, exportCategory, exportRoom);
      await pdf.save(`waarschuwingen-${new Date().toISOString().slice(0, 10)}.pdf`, { returnPromise: true });
      setExportOpen(false);
    } catch {
      setExportError('PDF downloaden mislukt. Probeer het opnieuw.');
    } finally { exporting.current = false; setExportBusy(false); }
  }
  if (!user) return <main className="p-6"><p role={error ? 'alert' : 'status'}>{error || 'Sessie controleren…'}</p></main>;
  return <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <AppHeader activePage="Waarschuwingen" role={user.role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="mb-2 text-xs font-bold tracking-wider text-brand dark:text-emerald-400">MELDINGEN</p>
      <h1 className="text-3xl font-semibold">Waarschuwingen</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bekijk afwijkingen en advies per lokaal. Open een melding om deze als gelezen te markeren.</p>
      <div className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2" aria-label="Categorie">{([
          ['all', 'Alle', inRoom.length],
          ['temperature', 'Temperatuur', inRoom.filter(w => category(w.kind) === 'temperature').length],
          ['humidity', 'Luchtvochtigheid', inRoom.filter(w => category(w.kind) === 'humidity').length],
          ['pressure', 'Luchtdruk', inRoom.filter(w => category(w.kind) === 'pressure').length],
          ['sensor', 'Sensor', inRoom.filter(w => isSensorWarning(w.kind)).length],
        ] as const).map(([id, label, count]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setExpanded(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-brand text-white' : 'border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'}`}>{label} ({count})</button>)}</div>
        <div className="ml-auto flex flex-col items-end gap-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">{visible.length} meldingen</span>
            <button type="button" aria-haspopup="dialog" disabled={!visible.length || busy !== null} onClick={() => {
              setExportCount(String(Math.min(100, visible.length))); setExportError(''); setExportOpen(true);
            }} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} aria-hidden="true" /> PDF downloaden
            </button>
          </div>
        <label className="text-sm font-semibold">Lokaal
          <select value={room} onChange={e => { setRoom(e.target.value); setExpanded(null); }} className="ml-3 rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
            <option value="">Alle lokalen</option>{rooms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        </div>
      </div>
      {(error || actionError || data?.error) && <p role="alert" className="mb-4 rounded-lg border border-amber-400 p-3 text-sm">{actionError || error || data?.error}</p>}
      <section aria-label="Meldingen" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {!data ? <p role="status" className="p-8">{error ? 'Meldingen zijn nog niet beschikbaar. We proberen het opnieuw.' : 'Meldingen laden…'}</p>
          : !visible.length ? <div className="p-10 text-center"><Bell className="mx-auto mb-3 text-slate-400" /><p>{items.length ? 'Geen meldingen voor deze selectie.' : 'Nog geen meldingen.'}</p><p className="mt-2 text-sm text-slate-500">Nieuwe meldingen verschijnen hier zodra ze worden vastgesteld.</p></div>
          : visible.map(w => {
            const t = toneStyles[tone(w.kind)];
            return (
              <article key={w.id} className={`border-b border-l-4 border-slate-200 last:border-b-0 dark:border-slate-700 ${t.border} ${
                w.isRead
                  ? 'bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400'
                  : `${t.unread} text-slate-950 dark:text-slate-50`}`}>
                <div className="flex items-start">
                <button aria-label={`${w.title}, ${w.room}, ${w.isRead ? 'gelezen' : 'ongelezen'}`} disabled={busy !== null} aria-expanded={expanded === w.id} aria-controls={`warning-${w.id}`} onClick={() => {
                  if (expanded === w.id) setExpanded(null); else { setExpanded(w.id); void mark(w, true); }
                }} className="flex min-w-0 flex-1 items-start gap-3 p-5 text-left hover:bg-slate-100/60 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-slate-700/40">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${w.isRead ? 'bg-transparent' : t.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={w.isRead ? 'font-medium' : 'font-bold'}>{w.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.badge}`}>{t.label}</span>
                    </div>
                    <p className="mt-1 text-sm">{w.building} · {w.room}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{time(w.createdAt)}{w.value !== null && ` · ${w.value.toLocaleString('nl-NL', { maximumSignificantDigits: 21 })} ${w.unit}`}</p>
                    <p className="mt-2 text-sm"><strong>Advies:</strong> {w.advice}</p>
                  </div>
                  <ChevronDown size={18} className={`mt-1 shrink-0 ${expanded === w.id ? 'rotate-180' : ''}`} />
                </button>
                {isBeheerder && w.isRead && (
                  <button type="button" aria-label={`Verwijder melding ${w.title}, ${w.room}`} aria-haspopup="dialog" title="Verwijderen" disabled={busy !== null} onClick={() => { setTeVerwijderen(w); setActionError(''); }}
                    className="m-4 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400">
                    <Trash2 size={18} />
                  </button>
                )}
                </div>
                {expanded === w.id && <div id={`warning-${w.id}`} className="border-t border-slate-200 px-10 py-4 text-sm dark:border-slate-700">
                  {w.limit !== null && <p>{w.kind.endsWith('-high') ? 'Bovengrens' : 'Ondergrens'} bij melding: {w.limit.toLocaleString('nl-NL')} {w.unit}</p>}
                  <p className="mt-1">Laatst geregistreerde meting bij deze melding: {time(w.measuredAt)}</p>
                </div>}
              </article>
            );
          })}
      </section>
      <p role="status" className="mt-4 text-xs text-slate-500 dark:text-slate-400">{data?.lastSuccessAt ? `Laatste geslaagde sensorcontrole: ${time(data.lastSuccessAt)}. ` : 'Nog geen geslaagde sensorcontrole. '}De lijst wordt elke 30 seconden opgehaald.</p>
      {exportOpen && (
        <FormDialog title="Waarschuwingen exporteren" titleId="export-heading" busy={exportBusy} onClose={() => setExportOpen(false)}>
          <form onSubmit={event => { event.preventDefault(); void downloadPdf(); }}>
            <p className="text-sm text-slate-600 dark:text-slate-300">{exportCategory} · {exportRoom}</p>
            <p id="export-count-help" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{visible.length} meldingen beschikbaar. De nieuwste meldingen worden eerst geëxporteerd.</p>
            <label htmlFor="export-count" className="mt-5 block text-sm font-semibold">Aantal meldingen</label>
            <input id="export-count" type="number" min={1} max={visible.length} step={1} required autoFocus disabled={exportBusy} value={exportCount}
              onChange={event => setExportCount(event.target.value)} aria-invalid={!validExportCount} aria-describedby="export-count-help export-count-validation"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" />
            <p id="export-count-validation" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{visible.length ? `Vul een geheel getal in van 1 tot en met ${visible.length}.` : 'Geen meldingen beschikbaar voor deze selectie.'}</p>
            {exportError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{exportError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={exportBusy} onClick={() => setExportOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700">Annuleren</button>
              <button type="submit" disabled={exportBusy || !validExportCount} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{exportBusy ? 'PDF maken…' : 'PDF downloaden'}</button>
            </div>
          </form>
        </FormDialog>
      )}
      {isBeheerder && teVerwijderen && (
        <FormDialog title="Melding verwijderen?" titleId="melding-verwijderen-heading" busy={busy !== null} onClose={() => setTeVerwijderen(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Weet je zeker dat je de melding "{teVerwijderen.title}" voor lokaal {teVerwijderen.room} in {teVerwijderen.building} definitief wilt verwijderen?</p>
          {actionError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{actionError}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" autoFocus disabled={busy !== null} onClick={() => setTeVerwijderen(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700">Annuleren</button>
            <button type="button" disabled={busy !== null} onClick={() => void remove(teVerwijderen)} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy !== null ? 'Verwijderen…' : 'Melding verwijderen'}</button>
          </div>
        </FormDialog>
      )}
    </main>
  </div>;
}
