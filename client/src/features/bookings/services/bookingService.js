import { apiRequest } from './api';

export async function createBooking(groundId, date, slot) {
  return apiRequest('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ groundId, date, slot }),
  });
}

export async function cancelBooking(bookingId) {
  return apiRequest(`/api/bookings/${bookingId}`, {
    method: 'DELETE',
  });
}

export async function fetchAllBookings() {
  return apiRequest('/api/bookings');
}
