/** SQLite stores local wall time; Supabase returns ISO timestamps with an offset. */
export function entryDate(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T'));
}
export function localDay(value: Date | string): string {
  const date = typeof value === 'string' ? entryDate(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
