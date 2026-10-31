import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, ChevronDown, ChevronLeft, ChevronRight, DoorOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import FormDialog from '../components/FormDialog';
import { useDarkMode } from '../hooks/useDarkMode';

type CurrentUser = { role: string };
type Gebouw = { id: number; naam: string };
type Lokaal = { id: number; naam: string; gebouwId: number; gebouw: string };

const sorteerOpties = {
  'gebouw-oplopend': 'Gebouwnaam (oplopend)',
  'gebouw-aflopend': 'Gebouwnaam (aflopend)',
  'lokaal-oplopend': 'Lokaalnaam (oplopend)',
  'lokaal-aflopend': 'Lokaalnaam (aflopend)',
};
type Sortering = keyof typeof sorteerOpties;

const leegFormulier = { naam: '', gebouwId: '' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900';
const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50';
const secondaryClass = 'rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700';
const filterChipClass = 'inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900';

async function readError(response: Response) {
  if (response.status === 401) {
    window.location.replace('/login');
    return 'Je sessie is verlopen. Log opnieuw in.';
  }
  if (response.status === 403) return 'Alleen beheerders kunnen lokalen beheren.';
  if (response.status === 404) return 'De gegevens bestaan niet meer. Vernieuw het overzicht.';
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
  const [gebouwen, setGebouwen] = useState<Gebouw[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lokaal | null>(null);
  const [form, setForm] = useState(leegFormulier);
  const [formError, setFormError] = useState('');
  const [gebouwFormOpen, setGebouwFormOpen] = useState(false);
  const [gebouwNaam, setGebouwNaam] = useState('');
  const [gebouwError, setGebouwError] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<Lokaal | null>(null);
  const [zoekterm, setZoekterm] = useState('');
  const [sortering, setSortering] = useState<Sortering>('gebouw-oplopend');
  const [perPagina, setPerPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
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
      const [lokalenResponse, gebouwenResponse] = await Promise.all([
        fetch('/api/lokalen', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/gebouwen', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!lokalenResponse.ok) throw new Error(await readError(lokalenResponse));
      if (!gebouwenResponse.ok) throw new Error(await readError(gebouwenResponse));
      setLokalen(await lokalenResponse.json());
      setGebouwen(await gebouwenResponse.json());
      setLoaded(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Lokalen laden mislukt. Controleer of de backend draait.');
    } finally {
      setLoading(false);
    }
  }

  function openForm(lokaal: Lokaal | null) {
    setEditing(lokaal);
    setForm(lokaal ? { naam: lokaal.naam, gebouwId: String(lokaal.gebouwId) }
      : { ...leegFormulier, gebouwId: gebouwen.length === 1 ? String(gebouwen[0].id) : '' });
    setFormError('');
    setSuccess('');
    setTeVerwijderen(null);
    setGebouwFormOpen(false);
    setFormOpen(true);
  }

  function openGebouwForm() {
    setGebouwNaam('');
    setGebouwError('');
    setSuccess('');
    setFormOpen(false);
    setTeVerwijderen(null);
    setGebouwFormOpen(true);
  }

  async function saveGebouw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setGebouwError('');
    const naam = gebouwNaam.trim();
    if (!naam || naam.length > 100) {
      setGebouwError('Vul een gebouwnaam van maximaal 100 tekens in.');
      return;
    }
    setBusy(true);
    try {
      const response = await sendWithCsrf('/api/gebouwen', 'POST', { naam });
      if (!response.ok) throw new Error(await readError(response));
      const gebouw: Gebouw = await response.json();
      setGebouwen(current => [...current, gebouw]);
      setPageError('');
      setGebouwFormOpen(false);
      setSuccess(`Gebouw ${gebouw.naam} is toegevoegd. Je kunt dit nu bij een lokaal selecteren.`);
    } catch (error) {
      setGebouwError(error instanceof Error ? error.message : 'Gebouw opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLokaal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError('');
    const naam = form.naam.trim();
    const gebouwId = Number(form.gebouwId);
    if (!naam || !gebouwen.some(gebouw => gebouw.id === gebouwId)) {
      setFormError('Vul een lokaalnaam in en selecteer een gebouw.');
      return;
    }
    if (naam.length > 100) {
      setFormError('De lokaalnaam mag maximaal 100 tekens bevatten.');
      return;
    }
    setBusy(true);
    try {
      const response = await sendWithCsrf(editing ? `/api/lokalen/${editing.id}` : '/api/lokalen', editing ? 'PUT' : 'POST', { naam, gebouwId });
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

  const gesorteerdeGebouwen = [...gebouwen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  const zoektekst = zoekterm.trim().toLocaleLowerCase('nl');
  const gefilterdeLokalen = lokalen.filter(lokaal =>
    lokaal.naam.toLocaleLowerCase('nl').includes(zoektekst)
      || lokaal.gebouw.toLocaleLowerCase('nl').includes(zoektekst))
    .sort((a, b) => {
      const gebouw = a.gebouw.localeCompare(b.gebouw, 'nl', { numeric: true, sensitivity: 'base' });
      const naam = a.naam.localeCompare(b.naam, 'nl', { numeric: true, sensitivity: 'base' });
      switch (sortering) {
        case 'lokaal-oplopend': return naam || gebouw || a.id - b.id;
        case 'lokaal-aflopend': return -naam || gebouw || a.id - b.id;
        case 'gebouw-aflopend': return -gebouw || naam || a.id - b.id;
        default: return gebouw || naam || a.id - b.id;
      }
    });
  const aantalPaginas = Math.max(1, Math.ceil(gefilterdeLokalen.length / perPagina));
  const huidigePagina = Math.min(pagina, aantalPaginas);
  const startIndex = (huidigePagina - 1) * perPagina;
  const zichtbareLokalen = gefilterdeLokalen.slice(startIndex, startIndex + perPagina);
  const filtersActief = zoekterm !== '' || sortering !== 'gebouw-oplopend';

  // Na verwijderen kan de laatste pagina vervallen. Blijf dan op een bestaande pagina.
  useEffect(() => {
    setPagina(current => Math.min(current, aantalPaginas));
  }, [aantalPaginas]);

  function wisFilters() {
    setZoekterm('');
    setSortering('gebouw-oplopend');
    setPagina(1);
  }

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
            <div className="flex flex-wrap gap-3">
              <button disabled={!loaded || loading || busy} className={`${secondaryClass} inline-flex items-center gap-2`} onClick={openGebouwForm}>
                <Building2 size={18} aria-hidden="true" /> Gebouw toevoegen
              </button>
              <button disabled={!loaded || loading || busy || gebouwen.length === 0} className={primaryClass} onClick={() => openForm(null)}>
                <Plus size={18} aria-hidden="true" /> Lokaal toevoegen
              </button>
            </div>
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

            {loaded && gebouwen.length === 0 && <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">Voeg eerst een gebouw toe. Daarna kun je er lokalen aan koppelen.</p>}

            {gebouwFormOpen && (
              <FormDialog title="Gebouw toevoegen" titleId="gebouw-heading" busy={busy} onClose={() => setGebouwFormOpen(false)}>
                <form onSubmit={saveGebouw}>
                  <label htmlFor="gebouw-naam" className="mb-1.5 block text-sm font-medium">Gebouwnaam</label>
                  <input autoFocus id="gebouw-naam" required maxLength={100} disabled={busy} value={gebouwNaam} onChange={event => setGebouwNaam(event.target.value)} className={inputClass} placeholder="Bijvoorbeeld Onderwijsgebouw" />
                  {gebouwError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{gebouwError}</p>}
                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <button type="button" disabled={busy} onClick={() => setGebouwFormOpen(false)} className={secondaryClass}>Annuleren</button>
                    <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Opslaan…' : 'Gebouw opslaan'}</button>
                  </div>
                </form>
              </FormDialog>
            )}

            {formOpen && (
              <FormDialog title={editing ? 'Lokaal wijzigen' : 'Lokaal toevoegen'} titleId="lokaal-heading" busy={busy} onClose={() => setFormOpen(false)}>
                <form onSubmit={saveLokaal}>
                  <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="lokaal-naam" className="mb-1.5 block text-sm font-medium">Lokaalnaam</label>
                      <input autoFocus id="lokaal-naam" required maxLength={100} value={form.naam} onChange={event => setForm({ ...form, naam: event.target.value })} className={inputClass} placeholder="Bijvoorbeeld 2.14" />
                    </div>
                    <div>
                      <label htmlFor="lokaal-gebouw" className="mb-1.5 block text-sm font-medium">Gebouw</label>
                      <div className="relative">
                        <select id="lokaal-gebouw" required value={form.gebouwId} onChange={event => setForm({ ...form, gebouwId: event.target.value })} className={`${inputClass} cursor-pointer appearance-none pr-10`}>
                          <option value="" disabled>Selecteer een gebouw</option>
                          {gesorteerdeGebouwen.map(gebouw => <option key={gebouw.id} value={gebouw.id}>{gebouw.naam}</option>)}
                        </select>
                        <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                      </div>
                    </div>
                  </fieldset>
                  {formError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{formError}</p>}
                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <button type="button" disabled={busy} onClick={() => setFormOpen(false)} className={secondaryClass}>Annuleren</button>
                    <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Opslaan…' : 'Lokaal opslaan'}</button>
                  </div>
                </form>
              </FormDialog>
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
                {loaded && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{gebouwen.length} {gebouwen.length === 1 ? 'gebouw' : 'gebouwen'} · {lokalen.length} {lokalen.length === 1 ? 'lokaal' : 'lokalen'}</p>}
                <div className="mt-5 flex flex-wrap items-end gap-4">
                  <div className="min-w-0 flex-1 basis-60">
                    <label htmlFor="lokalen-zoeken" className="mb-1.5 block text-sm font-medium">Zoek een lokaal</label>
                    <div className="relative">
                      <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input id="lokalen-zoeken" type="search" disabled={!loaded || loading || busy} value={zoekterm} onChange={event => { setZoekterm(event.target.value); setPagina(1); }} placeholder="Zoek op lokaal of gebouw" className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <label htmlFor="lokalen-sortering" className="mb-1.5 block text-sm font-medium">Sorteer op</label>
                    <div className="relative">
                      <select id="lokalen-sortering" disabled={!loaded || loading || busy} value={sortering} onChange={event => { setSortering(event.target.value as Sortering); setPagina(1); }} className={`${inputClass} cursor-pointer appearance-none pr-10`}>
                        {Object.entries(sorteerOpties).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                    </div>
                  </div>
                  <div className="w-40">
                    <label htmlFor="lokalen-per-pagina" className="mb-1.5 block text-sm font-medium">Lokalen per pagina</label>
                    <div className="relative">
                      <select id="lokalen-per-pagina" disabled={!loaded || loading || busy} value={perPagina} onChange={event => { setPerPagina(Number(event.target.value)); setPagina(1); }} className={`${inputClass} cursor-pointer appearance-none pr-10`}>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                      </select>
                      <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                    </div>
                  </div>
                  {filtersActief && <button type="button" disabled={loading || busy} onClick={wisFilters} className={secondaryClass}>Filters wissen</button>}
                </div>
                {filtersActief && (
                  <div role="group" aria-label="Actieve filters" className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Actief:</span>
                    {zoekterm !== '' && (
                      <button type="button" disabled={loading || busy} onClick={() => { setZoekterm(''); setPagina(1); }} aria-label="Zoekfilter verwijderen" className={filterChipClass}>
                        <span className="truncate">Zoeken: {zoekterm}</span><X size={14} aria-hidden="true" className="shrink-0" />
                      </button>
                    )}
                    {sortering !== 'gebouw-oplopend' && (
                      <button type="button" disabled={loading || busy} onClick={() => { setSortering('gebouw-oplopend'); setPagina(1); }} aria-label="Sortering herstellen" className={filterChipClass}>
                        <span className="truncate">{sorteerOpties[sortering]}</span><X size={14} aria-hidden="true" className="shrink-0" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Lokalen laden…</p>
                : !loaded ? <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Het overzicht is niet beschikbaar.</p>
                : lokalen.length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <DoorOpen size={36} className="mx-auto mb-4 text-slate-400" aria-hidden="true" />
                    <h3 className="font-semibold">Nog geen lokalen</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Voeg je eerste lokaal toe om te beginnen.</p>
                  </div>
                ) : gefilterdeLokalen.length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <Search size={36} className="mx-auto mb-4 text-slate-400" aria-hidden="true" />
                    <h3 className="font-semibold">Geen lokalen gevonden</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Probeer een andere lokaal- of gebouwnaam.</p>
                    {filtersActief && <button type="button" disabled={busy} onClick={wisFilters} className={`${secondaryClass} mt-5`}>Filters wissen</button>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                        <tr><th scope="col" className="px-5 py-3 font-medium">Lokaal</th><th scope="col" className="px-5 py-3 font-medium">Gebouw</th><th scope="col" className="px-5 py-3 text-right font-medium">Acties</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {zichtbareLokalen.map(lokaal => (
                          <tr key={lokaal.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <th scope="row" className="px-5 py-4 font-semibold">{lokaal.naam}</th>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{lokaal.gebouw}</td>
                            <td className="px-5 py-4"><div className="flex justify-end gap-2">
                              <button disabled={busy} onClick={() => openForm(lokaal)} aria-label={`Wijzig lokaal ${lokaal.naam}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><Pencil size={17} aria-hidden="true" /></button>
                              <button disabled={busy} onClick={() => { setTeVerwijderen(lokaal); setFormOpen(false); setGebouwFormOpen(false); setSuccess(''); }} aria-label={`Verwijder lokaal ${lokaal.naam}`} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={17} aria-hidden="true" /></button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {loaded && !loading && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                  <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
                    {gefilterdeLokalen.length === 0 ? '0 lokalen'
                      : `${startIndex + 1}–${startIndex + zichtbareLokalen.length} van ${gefilterdeLokalen.length} ${gefilterdeLokalen.length === 1 ? 'lokaal' : 'lokalen'}`}
                  </p>
                  <nav aria-label="Paginering lokalen" className="flex flex-wrap items-center gap-3">
                    <button type="button" aria-label="Vorige pagina" disabled={busy || huidigePagina === 1} onClick={() => setPagina(huidigePagina - 1)} className={`${secondaryClass} inline-flex items-center gap-1.5`}>
                      <ChevronLeft size={17} aria-hidden="true" /> Vorige
                    </button>
                    <span className="text-sm">Pagina {huidigePagina} van {aantalPaginas}</span>
                    <button type="button" aria-label="Volgende pagina" disabled={busy || huidigePagina === aantalPaginas} onClick={() => setPagina(huidigePagina + 1)} className={`${secondaryClass} inline-flex items-center gap-1.5`}>
                      Volgende <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
