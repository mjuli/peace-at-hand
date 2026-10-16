// Definições e avaliação pura das conquistas.
import { checksBefore } from "./journey";
import { totalMinutes } from "./extra-time";
import { dayKey, streaks, type SessionRow } from "./stats";

export interface CheckRow {
  fase: number;
  check_numero: number;
}

export interface AchievementDef {
  codigo: string;
  nome: string;
  descricao: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { codigo: "primeira_sessao", nome: "Broto", descricao: "Conclua sua primeira sessão" },
  { codigo: "primeira_fase", nome: "Primeiro nó", descricao: "Conclua a primeira fase da jornada" },
  { codigo: "min_10", nome: "Colmo", descricao: "Chegue às sessões de 10 minutos" },
  { codigo: "min_15", nome: "Caule firme", descricao: "Chegue às sessões de 15 minutos" },
  { codigo: "min_20", nome: "Folhagem", descricao: "Chegue às sessões de 20 minutos" },
  { codigo: "min_25", nome: "Copa alta", descricao: "Chegue às sessões de 25 minutos" },
  { codigo: "metade", nome: "Meio caminho", descricao: "Alcance 231 checks, metade da jornada" },
  { codigo: "jornada", nome: "Bambuzal", descricao: "Complete a jornada inteira" },
  { codigo: "seq_3", nome: "Raiz", descricao: "Pratique 3 dias seguidos" },
  { codigo: "seq_7", nome: "Rizoma", descricao: "Pratique 7 dias seguidos" },
  { codigo: "seq_30", nome: "Enraizado", descricao: "Pratique 30 dias seguidos" },
  { codigo: "seq_100", nome: "Raízes profundas", descricao: "Pratique 100 dias seguidos" },
  { codigo: "seq_365", nome: "Floresta antiga", descricao: "Pratique 365 dias seguidos" },
  { codigo: "horas_1", nome: "Primeira hora", descricao: "Medite 1 hora no total" },
  { codigo: "horas_10", nome: "Seiva", descricao: "Medite 10 horas no total" },
  { codigo: "horas_50", nome: "Bosque", descricao: "Medite 50 horas no total" },
  { codigo: "horas_100", nome: "Cem horas de silêncio", descricao: "Medite 100 horas no total" },
  { codigo: "sessoes_10", nome: "Dez brotos", descricao: "Conclua 10 sessões" },
  { codigo: "sessoes_50", nome: "Touceira", descricao: "Conclua 50 sessões" },
  { codigo: "sessoes_100", nome: "Cem colmos", descricao: "Conclua 100 sessões" },
  { codigo: "sessoes_250", nome: "Mata de bambu", descricao: "Conclua 250 sessões" },
  { codigo: "primeira_nota", nome: "Folha escrita", descricao: "Escreva sua primeira nota após uma sessão" },
];

/** Códigos merecidos dado o histórico completo (sessões e todos os checks, inclusive resetados). */
export function earnedCodes(sessions: SessionRow[], checks: CheckRow[], today = new Date()): Set<string> {
  const out = new Set<string>();
  const add = (cond: boolean, c: string) => cond && out.add(c);
  const n = sessions.length;
  const minutes = sessions.reduce((s, x) => s + totalMinutes(x), 0);
  const maxPhase = checks.reduce((m, c) => Math.max(m, c.fase), 0);
  const maxOrdinal = checks.reduce((m, c) => Math.max(m, checksBefore(c.fase) + c.check_numero), 0);
  const longest = streaks(new Set(sessions.map((s) => dayKey(new Date(s.concluida_em)))), today).longest;

  add(n >= 1, "primeira_sessao");
  add(checks.some((c) => c.check_numero === c.fase), "primeira_fase");
  for (const m of [10, 15, 20, 25]) add(maxPhase >= m, `min_${m}`);
  add(maxOrdinal >= 231, "metade");
  add(maxOrdinal >= 462, "jornada");
  for (const d of [3, 7, 30, 100, 365]) add(longest >= d, `seq_${d}`);
  for (const h of [1, 10, 50, 100]) add(minutes >= h * 60, `horas_${h}`);
  for (const s of [10, 50, 100, 250]) add(n >= s, `sessoes_${s}`);
  add(sessions.some((s) => !!s.nota?.trim()), "primeira_nota");
  return out;
}
