/**
 * Utilities for formatting and parsing Date Sent with Day and Time
 * Example display: "9/9/2026 3:07 AM"
 */

export function formatDateTimeSent(val?: string | null): string {
  if (!val || val.trim() === '') return '';
  const trimmed = val.trim();

  // If already formatted like "9/9/2026 3:07 AM" or "09/09/2026 03:07 AM"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(trimmed)) {
    return trimmed;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return trimmed;
  }

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

export function toDateTimeLocalString(val?: string | null): string {
  if (!val || val.trim() === '') return '';
  const trimmed = val.trim();

  // Check if matches "M/D/YYYY H:mm AM/PM"
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const [, monthStr, dayStr, yearStr, hourStr, minStr, ampmStr] = match;
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);
    const isPM = ampmStr.toUpperCase() === 'PM';
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${yearStr}-${pad(parseInt(monthStr, 10))}-${pad(parseInt(dayStr, 10))}T${pad(hour)}:${pad(minute)}`;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocalString(isoStr?: string | null): string {
  if (!isoStr || isoStr.trim() === '') return '';
  const parts = isoStr.split('T');
  if (parts.length !== 2) return formatDateTimeSent(isoStr);

  const [datePart, timePart] = parts;
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const [hourStr, minStr] = timePart.split(':');

  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;

  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const minutes = minStr ? minStr.padStart(2, '0') : '00';

  return `${month}/${day}/${yearStr} ${hour}:${minutes} ${ampm}`;
}
