const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004';

const SERVICES = {
  // In Azure, only booking-service is public. These are proxied via booking-service.
  identity: `${API_BASE_URL}/api/identity`,
  event: `${API_BASE_URL}/api/event`,
  ticket: `${API_BASE_URL}/api/ticket`,
  booking: API_BASE_URL,
};

export { SERVICES };

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object'
        ? body.message || body.error || JSON.stringify(body)
        : body || `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}
