/**
 * Local-time YYYY-MM-DD key derived from a millisecond timestamp.
 *
 * Uses local Date getters intentionally so two records taken on the same
 * calendar day (in the user's timezone) share a key, regardless of UTC offset.
 * Do not switch to `toISOString().slice(0, 10)` — that would shift days near
 * midnight for non-UTC users.
 */
export function dateKeyFromRecordedAt(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
