import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');

    try {
      const csrf = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!csrf.ok) throw new Error();
      const { token } = await csrf.json();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({
          email: String(form.get('email')).trim(),
          password: String(form.get('password')),
        }),
      });
      if (!response.ok) throw new Error();
      window.location.replace('/dashboard');
    } catch {
      setError('Login failed. Check your email and password and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6faf8] bg-[linear-gradient(to_right,#e8efec_1px,transparent_1px),linear-gradient(to_bottom,#e8efec_1px,transparent_1px)] bg-[size:32px_32px] px-4 py-10">
      {/* Decoratieve cirkels */}
      <div aria-hidden className="absolute -right-32 -top-48 h-[26rem] w-[26rem] rounded-full bg-emerald-100/80" />
      <div aria-hidden className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-lime-100/80" />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="mb-8 text-center">
          <img src="/SmartEnvironmentLgoAlleenDeS.png" alt="Smart Environment logo" className="mx-auto mb-6 h-30 w-auto" />
          <h1 className="text-3xl font-medium text-slate-900">Smart Environment</h1>
          <p className="mt-2 text-base text-slate-500">Log in op je account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
            >
              <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-900">
              E-mailadres
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-900">
              Wachtwoord
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3.5 pr-12 text-base text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="rememberEmail" className="h-4 w-4 rounded accent-brand" />
              E-mail onthouden
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="stayLoggedIn" className="h-4 w-4 rounded accent-brand" />
              Ingelogd blijven (30 dagen)
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Bezig met inloggen...' : 'Inloggen'}
          </button>

          <a
            href="/wachtwoord-vergeten"
            className="block text-center text-sm font-semibold text-brand hover:underline"
          >
            Wachtwoord vergeten?
          </a>
        </form>

        <p className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          Hulp nodig? Neem contact op met je schoolbeheerder.
        </p>
      </div>
    </main>
  );
}
