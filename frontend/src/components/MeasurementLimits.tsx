import { useEffect, useState } from 'react';
import { api, type MeasurementLimit } from '../lib/api';
const labels: Record<string, string> = { temperature: 'Temperatuur (°C)', humidity: 'Luchtvochtigheid (%)', pressure: 'Luchtdruk (hPa)' };
export default function MeasurementLimits({ limits, canEdit, onSaved }: {
  limits: MeasurementLimit[]; canEdit: boolean; onSaved: (limits: MeasurementLimit[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, { minimum: string; maximum: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setDraft(Object.fromEntries(limits.map(l => [l.id, { minimum: String(l.minimum), maximum: String(l.maximum) }]))); }, [limits]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const next = limits.map(l => ({ id: l.id, minimum: Number(draft[l.id].minimum), maximum: Number(draft[l.id].maximum) }));
      if (next.some(l => !draft[l.id].minimum.trim() || !draft[l.id].maximum.trim() || !Number.isFinite(l.minimum) || !Number.isFinite(l.maximum) || l.minimum >= l.maximum))
        throw new Error('Vul beide grenzen in. De ondergrens moet lager zijn dan de bovengrens.');
      onSaved(await api<MeasurementLimit[]>('/api/measurement-limits', 'PUT', next));
      setMessage('Grenswaarden opgeslagen voor alle lokalen. Nieuwe metingen worden hiermee beoordeeld.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!canEdit) return null;
  return <section className="my-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800" aria-labelledby="limits-title">
    <h2 id="limits-title" className="text-lg font-semibold">Grenswaarden voor meldingen</h2>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Voor alle lokalen. Alleen waarden onder de ondergrens of boven de bovengrens veroorzaken een melding. Dit zijn projectinstellingen, geen vastgestelde gezondheidsnormen.</p>
    <form onSubmit={save}>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{limits.map(l => <fieldset key={l.id} disabled={!canEdit || busy} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
        <legend className="px-1 text-sm font-semibold">{labels[l.id]}</legend>
        <div className="grid grid-cols-2 gap-3">{(['minimum', 'maximum'] as const).map(field => <label key={field} className="text-sm">
          {field === 'minimum' ? 'Ondergrens' : 'Bovengrens'}
          <input type="number" step="any" required value={draft[l.id]?.[field] ?? ''}
            onChange={e => setDraft({ ...draft, [l.id]: { ...draft[l.id], [field]: e.target.value } })}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900 disabled:opacity-80 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        </label>)}</div>
      </fieldset>)}</div>
      {canEdit ? <button disabled={busy || !limits.length} className="mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Opslaan…' : 'Grenswaarden opslaan'}</button>
        : <p className="mt-3 text-sm text-slate-500">Alleen een beheerder kan deze grenzen wijzigen.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
    </form>
  </section>;
}
