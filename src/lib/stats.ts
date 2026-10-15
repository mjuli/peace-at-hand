// Métricas puras do Histórico. Datas são agrupadas pelo fuso local do aparelho.
import { TOTAL_CHECKS } from "./journey";

export interface SessionRow {
  id: string;
  tipo: string;
  duracao_min: number;
  concluida_em: string;
  fase: number | null;
  check_numero: number | null;
  humor: number | null;
  nota: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
function parseKey(k: string): Date {
  const [y = 0, mo = 1, da = 1] = k.split("-").map(Number);
  return new Date(y, mo - 1, da);
}
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function minutesByDay(sessions: SessionRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.concluida_em));
    m.set(k, (m.get(k) ?? 0) + s.duracao_min);
  }
  return m;
}

/** 0 = sem prática; 1–4 por minutos no dia. */
export function heatLevel(min: number): 0 | 1 | 2 | 3 | 4 {
  if (min <= 0) return 0;
  if (min <= 10) return 1;
  if (min <= 20) return 2;
  if (min <= 30) return 3;
  return 4;
}

export function streaks(days: Set<string>, today: Date) {
  // atual: conta a partir de hoje, ou de ontem se hoje ainda não praticou
  let cur = 0;
  let d = days.has(dayKey(today)) ? today : addDays(today, -1);
  while (days.has(dayKey(d))) {
    cur++;
    d = addDays(d, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const dt = parseKey(k);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = dt;
  }
  return { current: cur, longest: best };
}

export function avgDaysPerWeek(days: Set<string>, today: Date): number {
  if (days.size === 0) return 0;
  const first = parseKey([...days].sort()[0] ?? dayKey(today));
  const span = Math.round((addDays(today, 0).getTime() - first.getTime()) / 86400000) + 1;
  const weeks = Math.max(1, span / 7);
  return Math.min(7, days.size / weeks);
}

export type DayPeriod = "madrugada" | "manhã" | "tarde" | "noite";
export function favoritePeriod(sessions: SessionRow[]): DayPeriod | null {
  if (!sessions.length) return null;
  const c: Record<DayPeriod, number> = { madrugada: 0, manhã: 0, tarde: 0, noite: 0 };
  for (const s of sessions) {
    const h = new Date(s.concluida_em).getHours();
    c[h < 6 ? "madrugada" : h < 12 ? "manhã" : h < 18 ? "tarde" : "noite"]++;
  }
  return (Object.keys(c) as DayPeriod[]).reduce((a, b) => (c[b] > c[a] ? b : a));
}

/** Estimativa da data de chegar aos 30 min (fim da jornada) pela média de checks/dia dos últimos 30 dias. */
export function journeyEstimate(activeCheckDates: string[], today: Date): Date | null {
  const done = activeCheckDates.length;
  if (done >= TOTAL_CHECKS) return null;
  const since = addDays(today, -29);
  const recent = activeCheckDates.map((d) => new Date(d)).filter((d) => d >= since);
  const distinct = new Set(recent.map(dayKey));
  if (distinct.size < 3) return null;
  const rate = recent.length / 30;
  return addDays(today, Math.ceil((TOTAL_CHECKS - done) / rate));
}
