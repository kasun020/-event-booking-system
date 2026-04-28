import { apiFetch, SERVICES } from './client';

export const authApi = {
  register: (data) =>
    apiFetch(`${SERVICES.identity}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data) =>
    apiFetch(`${SERVICES.identity}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUsers: () => apiFetch(`${SERVICES.identity}/users`),

  getUser: (id) => apiFetch(`${SERVICES.identity}/users/${id}`),
};
