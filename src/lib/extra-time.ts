export const MAX_EXTRA_SECONDS = 60 * 60;

export function elapsedExtra(endAt: number, now: number): number {
  return Math.min(MAX_EXTRA_SECONDS, Math.max(0, Math.floor((now - endAt) / 1000)));
}

export function addedExtra(seconds: number, add = true): number {
  return add && seconds >= 60 ? Math.min(MAX_EXTRA_SECONDS, Math.floor(seconds)) : 0;
}

export function totalMinutes(session: { duracao_min: number; planned_minutes?: number | null; extra_seconds?: number }): number {
  return session.planned_minutes == null ? session.duracao_min : session.planned_minutes + (session.extra_seconds ?? 0) / 60;
}

export function formatMinutes(minutes: number): string {
  return minutes.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}