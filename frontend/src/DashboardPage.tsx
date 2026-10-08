import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { window.location.replace('/login'); return; }
        if (!response.ok) throw new Error();
        const user = await response.json();
        setEmail(user.email);
      })
      .catch(() => setError('Sessie controleren mislukt. Vernieuw de pagina.'));
  }, []);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const csrf = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!csrf.ok) throw new Error();
      const { token } = await csrf.json();
      const response = await fetch('/api/auth/logout', {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-TOKEN': token },
      });
      if (!response.ok && response.status !== 401) throw new Error();
      window.location.replace('/login');
    } catch {
      setError('Uitloggen mislukt. Probeer opnieuw.');
      setBusy(false);
    }
  }

  return (
    <main className="p-4">
      <h1 className="mb-2 font-bold">Dashboard</h1>
      {email && <>
        <p className="mb-2">Ingelogd als {email}</p>
        <button onClick={handleLogout} disabled={busy} className="border px-2 py-1">Uitloggen</button>
      </>}
      {!email && !error && <p role="status">Sessie controleren…</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
