import { apiFetch, SERVICES } from './client';

export const ticketsApi = {
  getAll: () => apiFetch(`${SERVICES.ticket}/inventory`),

  getByEvent: (eventId) =>
    apiFetch(`${SERVICES.ticket}/inventory/event/${eventId}`),

  create: (data) =>
    apiFetch(`${SERVICES.ticket}/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
