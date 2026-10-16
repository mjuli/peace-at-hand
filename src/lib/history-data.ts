import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SessionRow } from "./stats";
import { ACHIEVEMENTS, earnedCodes, type AchievementDef, type CheckRow } from "./achievements";

async function fetchSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, tipo, duracao_min, planned_minutes, extra_seconds, concluida_em, fase, check_numero, humor, nota")
    .order("concluida_em", { ascending: true })
    .range(0, 9999);
  if (error) throw error;
  return data ?? [];
}

export const allSessionsQuery = queryOptions({ queryKey: ["sessions", "all"], queryFn: fetchSessions });

export const achievementsQuery = queryOptions({
  queryKey: ["achievements"],
  queryFn: async () => {
    const { data, error } = await supabase.from("achievements").select("codigo, desbloqueada_em");
    if (error) throw error;
    return data ?? [];
  },
});

/** Calcula conquistas a partir do histórico e grava as novas. Retorna as recém-desbloqueadas. */
export async function syncAchievements(qc?: QueryClient): Promise<AchievementDef[]> {
  const [sessions, checksRes, have] = await Promise.all([
    fetchSessions(),
    supabase.from("checks").select("fase, check_numero").range(0, 9999),
    supabase.from("achievements").select("codigo"),
  ]);
  if (checksRes.error) throw checksRes.error;
  if (have.error) throw have.error;
  const owned = new Set((have.data ?? []).map((a) => a.codigo));
  const earned = earnedCodes(sessions, (checksRes.data ?? []) as CheckRow[]);
  const fresh = ACHIEVEMENTS.filter((a) => earned.has(a.codigo) && !owned.has(a.codigo));
  if (fresh.length) {
    const { error } = await supabase
      .from("achievements")
      .upsert(fresh.map((a) => ({ codigo: a.codigo })), { onConflict: "user_id,codigo", ignoreDuplicates: true });
    if (error) throw error;
    await qc?.invalidateQueries({ queryKey: ["achievements"] });
  }
  return fresh;
}
