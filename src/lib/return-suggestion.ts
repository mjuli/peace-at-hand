import { FIRST_PHASE } from "./journey";

const DAY = 86_400_000;

/** Mostra a sugestão de retorno após N dias sem prática, se ainda não dispensada desde a última prática. */
export function shouldSuggestReturn(opts: {
  lastPracticeAt: string | null;
  dismissedAt: string | null;
  returnDays: number;
  now?: number;
}): boolean {
  const { lastPracticeAt, dismissedAt, returnDays } = opts;
  if (!lastPracticeAt) return false;
  const now = opts.now ?? Date.now();
  const last = new Date(lastPracticeAt).getTime();
  if (now - last < returnDays * DAY) return false;
  if (dismissedAt && new Date(dismissedAt).getTime() > last) return false;
  return true;
}

/** Fase para onde "Voltar uma fase" leva. */
export function previousPhase(phase: number): number {
  return Math.max(FIRST_PHASE, phase - 1);
}
