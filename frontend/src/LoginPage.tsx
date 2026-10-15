import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <main className="p-4">
      <h1 className="mb-2 font-bold">Login</h1>
      <form onSubmit={handleLogin}>
        <div className="mb-2">
          <label htmlFor="email" className="block">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required className="border p-1" />
        </div>
        <div className="mb-2">
          <label htmlFor="password" className="block">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="border p-1" />
        </div>
        <button disabled={busy} className="border px-2 py-1">Log in</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
