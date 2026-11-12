export async function api<T>(url: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'include', signal });
    if (!csrf.ok) throw new Error('Beveiligingstoken ophalen mislukt.');
    headers['X-CSRF-TOKEN'] = (await csrf.json()).token;
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, { method, headers, credentials: 'include', cache: 'no-store', signal,
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401) { window.location.replace('/login'); throw new Error('Log opnieuw in.'); }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? (response.status === 403 ? 'Je hebt geen rechten voor deze actie.' : 'Ophalen of opslaan mislukt. Probeer opnieuw.'));
  }
  return response.status === 204 ? undefined as T : response.json();
}
export type MeasurementLimit = { id: string; minimum: number; maximum: number };
