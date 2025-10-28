export function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function getTodayPKT() {
  const now = new Date();
  const pktOffset = 5 * 60; // PKT is UTC+5
  const pktTime = new Date(now.getTime() + (pktOffset + now.getTimezoneOffset()) * 60000);
  const year = pktTime.getFullYear();
  const month = String(pktTime.getMonth() + 1).padStart(2, '0');
  const day = String(pktTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getInitialDate() {
  return getTodayPKT();
}
