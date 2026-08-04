import { api } from './client';

export function reportLocation({ userId, name, lat, lng }) {
  return api.post('/api/locations', { userId, name, lat, lng });
}

export function getOtherLocations(userId) {
  return api.get(`/api/locations?userId=${userId}`);
}
