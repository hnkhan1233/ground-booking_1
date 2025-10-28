import { apiRequest } from './api';

export async function fetchGrounds(category = null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest(`/api/grounds${query}`);
}

export async function fetchGroundById(id) {
  return apiRequest(`/api/grounds/${id}`);
}

export async function fetchGroundAvailability(groundId, date) {
  return apiRequest(`/api/grounds/${groundId}/availability?date=${date}`);
}

// Admin endpoints
export async function fetchAdminGrounds() {
  return apiRequest('/api/admin/grounds');
}

export async function createGround(formData) {
  return apiRequest('/api/admin/grounds', {
    method: 'POST',
    body: formData,
  });
}

export async function updateGround(groundId, formData) {
  return apiRequest(`/api/admin/grounds/${groundId}`, {
    method: 'PUT',
    body: formData,
  });
}

export async function deleteGround(groundId) {
  return apiRequest(`/api/admin/grounds/${groundId}`, {
    method: 'DELETE',
  });
}

// Ground images
export async function addGroundImage(groundId, formData) {
  return apiRequest(`/api/admin/grounds/${groundId}/images`, {
    method: 'POST',
    body: formData,
  });
}

export async function reorderGroundImages(groundId, order) {
  return apiRequest(`/api/admin/grounds/${groundId}/images/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
}

export async function deleteGroundImage(groundId, imageId) {
  return apiRequest(`/api/admin/grounds/${groundId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

// Ground features
export async function addGroundFeature(groundId, feature) {
  return apiRequest(`/api/admin/grounds/${groundId}/features`, {
    method: 'POST',
    body: JSON.stringify(feature),
  });
}

export async function deleteGroundFeature(groundId, featureId) {
  return apiRequest(`/api/admin/grounds/${groundId}/features/${featureId}`, {
    method: 'DELETE',
  });
}
