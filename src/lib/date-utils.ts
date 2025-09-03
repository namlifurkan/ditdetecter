// Utility functions for consistent date formatting across client and server
export function formatTimeForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Use a consistent format that doesn't depend on locale
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

export function formatDateTimeForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${month}/${day} ${hours}:${minutes}`;
}