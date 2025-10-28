import { API_BASE_URL } from '../config';
import { auth } from '../firebase';

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

export async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't add Content-Type for FormData
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.error || 'Request failed',
      data,
    };
  }

  return data;
}
