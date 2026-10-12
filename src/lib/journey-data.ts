import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextCheck } from "./journey";

export interface ActiveCheck {
  id: string;
  fase: number;
  check_numero: number;
  created_at: string;
}

export const activeChecksQuery = queryOptions({
  queryKey: ["checks", "active"],
  queryFn: async (): Promise<ActiveCheck[]> => {
    const { data, error } = await supabase
      .from("checks")
      .select("id, fase, check_numero, created_at")
      .is("reset_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

async function countActive(): Promise<number> {
  const { count, error } = await supabase
    .from("checks")
    .select("id", { count: "exact", head: true })
    .is("reset_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Registra uma sessão concluída e, se houver, o próximo check. */
export async function completeJourneySession(durationMin: number) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  const count = await countActive();
  const next = nextCheck(count);
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: u.user.id,
      tipo: "jornada",
      duracao_min: durationMin,
      fase: next?.phase ?? 30,
      check_numero: next?.number ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (next) {
    const { error: e2 } = await supabase.from("checks").insert({
      user_id: u.user.id,
      fase: next.phase,
      check_numero: next.number,
      session_id: session.id,
    });
    if (e2) throw e2;
  }
  return { next, countAfter: next ? count + 1 : count };
}

export async function undoLastCheck() {
  const { data, error } = await supabase
    .from("checks")
    .select("id")
    .is("reset_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.length) return;
  const { error: e2 } = await supabase
    .from("checks")
    .update({ reset_at: new Date().toISOString() })
    .eq("id", data[0].id);
  if (e2) throw e2;
}

export async function resetFromPhase(phase: number) {
  const { error } = await supabase
    .from("checks")
    .update({ reset_at: new Date().toISOString() })
    .is("reset_at", null)
    .gte("fase", phase);
  if (error) throw error;
}

export async function resetAll() {
  return resetFromPhase(3);
}
