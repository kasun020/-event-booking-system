const SERVICES = {
  identity: 'http://localhost:3001',
  event: 'http://localhost:3002',
  ticket: 'http://localhost:3003',
  booking: 'http://localhost:3004',
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
