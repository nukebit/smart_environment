import { useEffect, useState, type FormEvent } from 'react';
import { Plus, TriangleAlert, X } from 'lucide-react';
import AppHeader from './AppHeader';
import { useDarkMode } from './useDarkMode';

// One account as the backend sends it (GET /api/users).
type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
};

// The logged-in user (GET /api/auth/me).
type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

// The fields in the add/edit form.
type FormState = {
  fullName: string;
  email: string;
  role: string;
  password: string;
};

const emptyForm: FormState = { fullName: '', email: '', role: 'Docent', password: '' };

// Sends a request that changes data (POST, PUT, DELETE).
// The backend requires a fresh CSRF token in the X-CSRF-TOKEN header for these requests.
async function sendWithCsrf(url: string, method: string, body?: unknown) {
  const csrf = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!csrf.ok) throw new Error('CSRF token ophalen mislukt');
  const { token } = await csrf.json();

  return fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Reads the error messages from a 400 response of the backend.
async function readErrors(response: Response): Promise<string> {
  if (response.status === 403) return 'Je hebt geen rechten voor deze actie.';
  try {
    const data = await response.json();
    if (data.errors) {
      return Object.values(data.errors as Record<string, string[]>).flat().join(' ');
    }
    if (data.message) return data.message;
  } catch {
    // No JSON in the response; use the general message below.
  }
  return 'Er ging iets mis. Probeer het opnieuw.';
}

// The backend stores times in UTC. Show them in Dutch time, like "Vandaag, 13:32".
function formatLastLogin(value: string | null) {
  if (!value) return 'Nog niet ingelogd';

  // SQLite returns the time without "Z", so add it to tell the browser this is UTC.
  const hasTimeZone = /Z$|[+-]\d\d:\d\d$/.test(value);
  const iso = (hasTimeZone ? value : value + 'Z').replace(/(\.\d{3})\d+/, '$1');
  const date = new Date(iso);

  const zone = { timeZone: 'Europe/Amsterdam' } as const;
  const day = (d: Date) => d.toLocaleDateString('nl-NL', zone);
  const time = date.toLocaleTimeString('nl-NL', { ...zone, hour: '2-digit', minute: '2-digit' });

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  if (day(date) === day(today)) return `Vandaag, ${time}`;
  if (day(date) === day(yesterday)) return `Gisteren, ${time}`;
  return `${date.toLocaleDateString('nl-NL', { ...zone, day: 'numeric', month: 'short' })}, ${time}`;
}

export default function BeheerPage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Form (modal) for adding and editing.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null); // null = new account
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Donker thema, dezelfde keuze als op het dashboard.
  const [darkMode, toggleDarkMode] = useDarkMode();

  // 1. On page load: check who is logged in, then load the accounts.
  useEffect(() => {
    start();
  }, []);

  async function start() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (!response.ok) throw new Error();

      const user: CurrentUser = await response.json();
      setMe(user);

      // A Docent does not get the list. The backend would also refuse it with 403.
      if (user.role !== 'Beheerder') {
        setLoading(false);
        return;
      }
      await loadUsers();
    } catch {
      setPageError('Sessie controleren mislukt. Vernieuw de pagina.');
      setLoading(false);
    }
  }

  // READ: get all accounts from GET /api/users.
  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch('/api/users', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (!response.ok) throw new Error();
      setUsers(await response.json());
      setPageError('');
    } catch {
      setPageError('Accounts laden mislukt. Vernieuw de pagina.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({ fullName: user.fullName, email: user.email, role: user.role || 'Docent', password: '' });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  // CREATE (POST /api/users) or UPDATE (PUT /api/users/{id}).
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');

    try {
      const response = editing
        ? await sendWithCsrf(`/api/users/${editing.id}`, 'PUT', {
            fullName: form.fullName,
            email: form.email,
            role: form.role,
          })
        : await sendWithCsrf('/api/users', 'POST', form);

      if (!response.ok) {
        setFormError(await readErrors(response));
        return;
      }

      closeForm();
      await loadUsers();
    } catch {
      setFormError('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  // DELETE: DELETE /api/users/{id}, after a confirmation.
  async function handleDelete(user: User) {
    const name = user.fullName || user.email;
    if (!window.confirm(`Weet je zeker dat je het account van ${name} wilt verwijderen?`)) return;

    try {
      const response = await sendWithCsrf(`/api/users/${user.id}`, 'DELETE');
      if (!response.ok) {
        setPageError(await readErrors(response));
        return;
      }
      await loadUsers();
    } catch {
      setPageError('Verwijderen mislukt. Probeer het opnieuw.');
    }
  }

  // ----- Screens -----

  if (!me) {
    return (
      <main className="p-6">
        {pageError ? (
          <p role="alert" className="text-red-600">{pageError}</p>
        ) : (
          <p role="status">Sessie controleren…</p>
        )}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-white">
      {/* NAVIGATIEBALK (dezelfde als op het dashboard, zie AppHeader.tsx) */}
      <AppHeader activePage="Beheer" role={me.role} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />

      <main className="mx-auto max-w-7xl px-5 py-10">
        {/* TITEL */}
        <section className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Beheeromgeving</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Beheer</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-300">Beheer de accounts van docenten en beheerders.</p>
        </section>

        {/* GEEN TOEGANG VOOR DOCENTEN */}
        {me.role !== 'Beheerder' ? (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            <p>Je hebt geen toegang tot deze pagina. Alleen een beheerder kan accounts beheren.</p>
          </div>
        ) : (
          <>
            {pageError && (
              <div role="alert" className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
                <p>{pageError}</p>
              </div>
            )}

            {/* KAART MET TABEL */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6 dark:border-slate-700">
                <div>
                  <h2 className="text-xl font-medium">Docenten- en gebruikersbeheer</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {users.length} {users.length === 1 ? 'actief account' : 'actieve accounts'} · beheer rollen en toegang
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
                >
                  <Plus size={16} />
                  Nieuwe docent toevoegen
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Naam</th>
                      <th className="px-6 py-4">E-mailadres</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Laatst actief</th>
                      <th className="px-6 py-4">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {loading && (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 text-slate-500 dark:text-slate-300">Accounts laden…</td>
                      </tr>
                    )}

                    {!loading && users.map(user => {
                      const isMe = user.id === me.id;
                      return (
                        <tr key={user.id}>
                          <td className="px-6 py-5 font-semibold">
                            {user.fullName || '—'}
                            {isMe && <span className="ml-2 text-xs font-normal text-slate-400">(jij)</span>}
                          </td>
                          <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{user.email}</td>
                          <td className="px-6 py-5">
                            <span
                              className={
                                user.role === 'Beheerder'
                                  ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800'
                                  : 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                              }
                            >
                              {user.role || 'Geen rol'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{formatLastLogin(user.lastLoginAt)}</td>
                          <td className="px-6 py-5">
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => openEdit(user)}
                                className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                              >
                                Bewerken
                              </button>
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(user)}
                                  className="font-semibold text-red-700 hover:underline dark:text-red-400"
                                >
                                  Verwijderen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* FORMULIER: TOEVOEGEN OF BEWERKEN */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
        >
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="form-title" className="text-xl font-semibold">
                {editing ? 'Account bewerken' : 'Nieuwe docent toevoegen'}
              </h2>
              <button type="button" onClick={closeForm} aria-label="Sluiten" className="text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <p>{formError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-semibold">Naam</label>
                <input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-semibold">E-mailadres</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>

              <div>
                <label htmlFor="role" className="mb-1 block text-sm font-semibold">Rol</label>
                <select
                  id="role"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="Docent">Docent</option>
                  <option value="Beheerder">Beheerder</option>
                </select>
              </div>

              {/* Only for a new account. Editing does not change the password. */}
              {!editing && (
                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-semibold">Wachtwoord</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Geef dit wachtwoord persoonlijk door aan de docent.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {busy ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}