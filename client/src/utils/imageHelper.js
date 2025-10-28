import { API_BASE_URL } from '../config';

export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  return `${API_BASE_URL}${imageUrl}`;
}
