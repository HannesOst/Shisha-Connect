const timeFormat = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });
const longDayFormat = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTime(date: Date | string): string {
  return timeFormat.format(new Date(date));
}

/** "Heute", "Morgen", "Fr., 17.10." */
export function formatDay(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return 'Heute';
  if (sameDay(d, tomorrow)) return 'Morgen';
  return dayFormat.format(d);
}

export function formatLongDay(date: Date | string): string {
  const d = new Date(date);
  const label = formatDay(d);
  return label === 'Heute' || label === 'Morgen' ? `${label}, ${longDayFormat.format(d)}` : longDayFormat.format(d);
}

/** "Heute, 20:00 Uhr" */
export function formatWhen(date: Date | string): string {
  return `${formatDay(date)}, ${formatTime(date)} Uhr`;
}

export function formatRelative(date: string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return formatDay(date);
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Quick picks for the meetup time. */
export function quickTimes(now = new Date()) {
  const inFifteen = new Date(now.getTime() + 15 * 60 * 1000);
  inFifteen.setMinutes(Math.ceil(inFifteen.getMinutes() / 15) * 15, 0, 0);

  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  // Later than 19:30 already → "Heute Abend" means the next full half hour.
  if (tonight.getTime() - now.getTime() < 30 * 60 * 1000) {
    tonight.setTime(now.getTime() + 60 * 60 * 1000);
    tonight.setMinutes(tonight.getMinutes() < 30 ? 30 : 60, 0, 0);
  }
  return { now: inFifteen, tonight };
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
