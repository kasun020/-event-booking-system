import { apiFetch, SERVICES } from './client';

export const bookingsApi = {
  getAll: () => apiFetch(`${SERVICES.booking}/bookings`),

  getById: (id) => apiFetch(`${SERVICES.booking}/bookings/${id}`),

  create: (data) =>
    apiFetch(`${SERVICES.booking}/bookings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
