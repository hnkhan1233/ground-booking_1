import { apiRequest } from './api';

export async function fetchUserProfile() {
  return apiRequest('/api/auth/me');
}

export async function fetchProfile() {
  return apiRequest('/api/profile');
}

export async function updateProfile(name, phone) {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ name, phone }),
  });
}
