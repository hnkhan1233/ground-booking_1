import { apiRequest } from './api';

export async function fetchAdminStats() {
  return apiRequest('/api/admin/stats');
}
