import { apiFetch, SERVICES } from './client';

export const eventsApi = {
  getAll: () => apiFetch(`${SERVICES.event}/events`),

  getById: (id) => apiFetch(`${SERVICES.event}/events/${id}`),

  create: (data) =>
    apiFetch(`${SERVICES.event}/api/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    apiFetch(`${SERVICES.event}/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
