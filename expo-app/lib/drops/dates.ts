function formatter(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}
export function wallInZone(instant: string | Date, timezone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid consumption date.');
  const parts = Object.fromEntries(formatter(timezone).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function dayInZone(instant: string | Date, timezone: string): string { return wallInZone(instant, timezone).slice(0, 10); }
export function addDays(day: string, count: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(count)) throw new Error('Invalid civil day.');
  const date = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Invalid civil day.');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function wallTimeToInstant(wall: string, timezone: string): string {
  formatter(timezone); // Validate IANA timezone even for an explicit offset.
  const normalized = wall.replace(' ', 'T');
  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)) {
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid consumption date.');
    // An offset must correspond to the selected zone, including repeated hours.
    if (!/[zZ]$/.test(normalized) && wallInZone(date, timezone) !== (normalized.slice(0,16) + ':' + (normalized.match(/T\d{2}:\d{2}:(\d{2})/)?.[1] ?? '00'))) throw new Error('Timestamp offset does not match the selected timezone.');
    return date.toISOString();
  }
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Enter a valid local date and time.');
  const wanted = `${match[1]}T${match[2]}:${match[3] ?? '00'}`;
  const base = Date.parse(`${wanted}Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 19) !== wanted) throw new Error('Invalid consumption date.');
  const candidates = new Set<string>();
  // Sampling offsets around the date covers DST transitions and fractional-hour zones.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(base + hours * 3600000);
    const localAsUtc = Date.parse(`${wallInZone(sample, timezone)}Z`);
    const candidate = new Date(base - (localAsUtc - sample.getTime()));
    if (wallInZone(candidate, timezone) === wanted) candidates.add(candidate.toISOString());
  }
  if (!candidates.size) throw new Error('This local time does not exist because the clock moves forward.');
  if (candidates.size > 1) throw new Error('This local time occurs twice. Specify an explicit UTC offset.');
  return [...candidates][0];
}
