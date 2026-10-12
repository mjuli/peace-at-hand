// Regras da jornada Bambu: fase N = N minutos e N checks, de 3 a 30.
export const FIRST_PHASE = 3;
export const LAST_PHASE = 30;
export const PHASES = Array.from({ length: LAST_PHASE - FIRST_PHASE + 1 }, (_, i) => i + FIRST_PHASE);
export const TOTAL_CHECKS = PHASES.reduce((s, p) => s + p, 0); // 462

/** Checks acumulados antes do início da fase. */
export function checksBefore(phase: number): number {
  let s = 0;
  for (let p = FIRST_PHASE; p < phase; p++) s += p;
  return s;
}

export interface Progress {
  /** fase atual (30 quando completo) */
  phase: number;
  /** checks feitos na fase atual */
  done: number;
  complete: boolean;
  totalDone: number;
  percent: number;
}

export function progressFromCount(count: number): Progress {
  const totalDone = Math.max(0, Math.min(count, TOTAL_CHECKS));
  const percent = Math.round((totalDone / TOTAL_CHECKS) * 100);
  if (totalDone >= TOTAL_CHECKS) {
    return { phase: LAST_PHASE, done: LAST_PHASE, complete: true, totalDone, percent: 100 };
  }
  let remaining = totalDone;
  for (const p of PHASES) {
    if (remaining < p) return { phase: p, done: remaining, complete: false, totalDone, percent };
    remaining -= p;
  }
  return { phase: LAST_PHASE, done: LAST_PHASE, complete: true, totalDone, percent: 100 };
}

/** Próximo check a ser marcado, ou null em modo manutenção. */
export function nextCheck(count: number): { phase: number; number: number } | null {
  const p = progressFromCount(count);
  if (p.complete) return null;
  return { phase: p.phase, number: p.done + 1 };
}

/** Duração (min) da próxima sessão. Em manutenção: 30. */
export function nextDuration(count: number): number {
  return nextCheck(count)?.phase ?? LAST_PHASE;
}
