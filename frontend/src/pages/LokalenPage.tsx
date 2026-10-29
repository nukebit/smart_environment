import { useEffect, useState, type FormEvent } from 'react';
import { Check, DoorOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useDarkMode } from '../hooks/useDarkMode';

type CurrentUser = { role: string };
type Lokaal = { id: number; naam: string; gebouw: string };

const leegFormulier = { naam: '', gebouw: '' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900';
const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50';
const secondaryClass = 'rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700';

async function readError(response: Response) {
  if (response.status === 401) {
    window.location.replace('/login');
    return 'Je sessie is verlopen. Log opnieuw in.';
  }
  if (response.status === 403) return 'Alleen beheerders kunnen lokalen beheren.';
  if (response.status === 404) return 'Dit lokaal bestaat niet meer. Vernieuw het overzicht.';
  const data = await response.json().catch(() => null);
  if (data?.errors) return Object.values(data.errors as Record<string, string[]>).flat().join(' ');
  return data?.message ?? 'De actie is mislukt. Probeer het opnieuw.';
}

async function sendWithCsrf(url: string, method: string, body?: unknown) {
  const csrf = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!csrf.ok) throw new Error(await readError(csrf));
  const { token } = await csrf.json();
  return fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export default function LokalenPage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [lokalen, setLokalen] = useState<Lokaal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lokaal | null>(null);
  const [form, setForm] = useState(leegFormulier);
  const [formError, setFormError] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<Lokaal | null>(null);
  const [darkMode, toggleDarkMode] = useDarkMode();

  useEffect(() => {
    start();
  }, []);

  async function start() {
    setPageError('');
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (!response.ok) throw new Error();
      const user: CurrentUser = await response.json();
      setMe(user);
      if (user.role === 'Beheerder') await laadLokalen();
    } catch {
      setPageError('Sessie controleren mislukt. Probeer het opnieuw.');
    }
  }

  async function laadLokalen() {
    setPageError('');
    setLoading(true);
    setLoaded(false);
    try {
      const response = await fetch('/api/lokalen', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response));
      setLokalen(await response.json());
      setLoaded(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Lokalen laden mislukt. Controleer of de backend draait.');
    } finally {
      setLoading(false);
    }
  }

  function openForm(lokaal: Lokaal | null) {
    setEditing(lokaal);
    setForm(lokaal ? { naam: lokaal.naam, gebouw: lokaal.gebouw } : leegFormulier);
    setFormError('');
    setSuccess('');
    setTeVerwijderen(null);
    setFormOpen(true);
  }

  async function saveLokaal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError('');
    const naam = form.naam.trim();
    const gebouw = form.gebouw.trim();
    if (!naam || !gebouw) {
      setFormError('Vul een lokaalnaam en een gebouw in.');
      return;
    }
    if (naam.length > 100 || gebouw.length > 100) {
      setFormError('De lokaalnaam en het gebouw mogen maximaal 100 tekens bevatten.');
      return;
    }
    setBusy(true);
    try {
      const response = await sendWithCsrf(editing ? `/api/lokalen/${editing.id}` : '/api/lokalen', editing ? 'PUT' : 'POST', { naam, gebouw });
      if (!response.ok) throw new Error(await readError(response));
      const lokaal: Lokaal = await response.json();
      setLokalen(current => editing
        ? current.map(item => item.id === editing.id ? lokaal : item)
        : [...current, lokaal]);
      setPageError('');
      setFormOpen(false);
      setSuccess(`Lokaal ${naam} is ${editing ? 'gewijzigd' : 'toegevoegd'}.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteLokaal() {
    if (!teVerwijderen || busy) return;
    setBusy(true);
    try {
      const response = await sendWithCsrf(`/api/lokalen/${teVerwijderen.id}`, 'DELETE');
      if (!response.ok) throw new Error(await readError(response));
      setLokalen(current => current.filter(lokaal => lokaal.id !== teVerwijderen.id));
      setPageError('');
      setSuccess(`Lokaal ${teVerwijderen.naam} is verwijderd.`);
      setTeVerwijderen(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Verwijderen mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  const gesorteerdeLokalen = [...lokalen].sort((a, b) =>
    a.gebouw.localeCompare(b.gebouw, 'nl') || a.naam.localeCompare(b.naam, 'nl', { numeric: true }));

  if (!me) {
    return (
      <main className="p-6">
        {pageError ? <><p role="alert">{pageError}</p><button onClick={start} className="mt-3 underline">Opnieuw proberen</button></>
          : <p role="status">Sessie controleren…</p>}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-white">
      <AppHeader activePage="Lokalen" role={me.role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />

      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Smart Environment</p>
            <h1 className="text-3xl font-semibold">Lokalen</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bekijk en beheer de lokalen.</p>
          </div>
          {me.role === 'Beheerder' && (
            <button disabled={!loaded || loading || busy} className={primaryClass} onClick={() => openForm(null)}>
              <Plus size={18} aria-hidden="true" /> Lokaal toevoegen
            </button>
          )}
        </div>

        {me.role !== 'Beheerder' ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Alleen beheerders kunnen lokalen beheren.
            <a href="/dashboard" className="mt-3 block font-semibold underline">Terug naar dashboard</a>
          </div>
        ) : (
          <>
            {pageError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {pageError}
              <button disabled={loading || busy} onClick={laadLokalen} className="ml-2 font-semibold underline">Overzicht vernieuwen</button>
            </div>}
            {success && <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Check size={18} className="shrink-0" aria-hidden="true" />{success}
            </p>}

            {formOpen && (
              <section aria-labelledby="lokaal-heading" className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 id="lokaal-heading" className="text-lg font-semibold">{editing ? 'Lokaal wijzigen' : 'Lokaal toevoegen'}</h2>
                  <button type="button" disabled={busy} onClick={() => setFormOpen(false)} aria-label="Formulier sluiten" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={19} /></button>
                </div>
                <form onSubmit={saveLokaal}>
                  <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="lokaal-naam" className="mb-1.5 block text-sm font-medium">Lokaalnaam</label>
                      <input autoFocus id="lokaal-naam" required maxLength={100} value={form.naam} onChange={event => setForm({ ...form, naam: event.target.value })} className={inputClass} placeholder="Bijvoorbeeld 2.14" />
                    </div>
                    <div>
                      <label htmlFor="lokaal-gebouw" className="mb-1.5 block text-sm font-medium">Gebouw</label>
                      <input id="lokaal-gebouw" required maxLength={100} value={form.gebouw} onChange={event => setForm({ ...form, gebouw: event.target.value })} className={inputClass} placeholder="Bijvoorbeeld Onderwijsgebouw" />
                    </div>
                  </fieldset>
                  {formError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{formError}</p>}
                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <button type="button" disabled={busy} onClick={() => setFormOpen(false)} className={secondaryClass}>Annuleren</button>
                    <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Opslaan…' : 'Lokaal opslaan'}</button>
                  </div>
                </form>
              </section>
            )}

            {teVerwijderen && (
              <section aria-label="Verwijderen bevestigen" className="mb-6 rounded-xl border border-red-200 bg-white p-5 dark:border-red-900 dark:bg-slate-800">
                <h2 className="font-semibold">Lokaal verwijderen?</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Weet je zeker dat je lokaal {teVerwijderen.naam} in {teVerwijderen.gebouw} wilt verwijderen?</p>
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button disabled={busy} onClick={() => setTeVerwijderen(null)} className={secondaryClass}>Annuleren</button>
                  <button disabled={busy} onClick={deleteLokaal} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800">Verwijderen</button>
                </div>
              </section>
            )}

            <section aria-label="Lokalenoverzicht" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 p-5 dark:border-slate-700">
                <h2 className="font-semibold">Alle lokalen</h2>
                {loaded && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{lokalen.length} {lokalen.length === 1 ? 'lokaal' : 'lokalen'}</p>}
              </div>
              {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Lokalen laden…</p>
                : !loaded ? <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Het overzicht is niet beschikbaar.</p>
                : lokalen.length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <DoorOpen size={36} className="mx-auto mb-4 text-slate-400" aria-hidden="true" />
                    <h3 className="font-semibold">Nog geen lokalen</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Voeg je eerste lokaal toe om te beginnen.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                        <tr><th scope="col" className="px-5 py-3 font-medium">Lokaal</th><th scope="col" className="px-5 py-3 font-medium">Gebouw</th><th scope="col" className="px-5 py-3 text-right font-medium">Acties</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {gesorteerdeLokalen.map(lokaal => (
                          <tr key={lokaal.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <th scope="row" className="px-5 py-4 font-semibold">{lokaal.naam}</th>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{lokaal.gebouw}</td>
                            <td className="px-5 py-4"><div className="flex justify-end gap-2">
                              <button disabled={busy} onClick={() => openForm(lokaal)} aria-label={`Wijzig lokaal ${lokaal.naam}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><Pencil size={17} aria-hidden="true" /></button>
                              <button disabled={busy} onClick={() => { setTeVerwijderen(lokaal); setFormOpen(false); setSuccess(''); }} aria-label={`Verwijder lokaal ${lokaal.naam}`} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={17} aria-hidden="true" /></button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
