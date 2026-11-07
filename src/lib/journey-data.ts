import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FIRST_PHASE } from "./journey";


export interface ActiveCheck {
  id: string;
  fase: number;
  check_numero: number;
  created_at: string;
  is_legacy_credit: boolean;
}

export const activeChecksQuery = queryOptions({
  queryKey: ["checks", "active"],
  queryFn: async (): Promise<ActiveCheck[]> => {
    const { data, error } = await supabase
      .from("checks")
      .select("id, fase, check_numero, created_at, is_legacy_credit")
      .is("reset_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

/** Registra uma sessão. Para 'jornada', marca o próximo check; para 'manual', só se countCheck. */
export async function recordSession(opts: {
  tipo: "jornada" | "livre" | "manual";
  durationMin: number;
  concluidaEm?: string;
  countCheck?: boolean;
  sessionId?: string;
}) {
  const { data, error } = await supabase.rpc("record_practice", {
    p_id: opts.sessionId ?? crypto.randomUUID(), p_tipo: opts.tipo,
    p_minutes: opts.durationMin, p_completed: opts.concluidaEm ?? new Date().toISOString(),
    p_count_check: opts.countCheck ?? false,
  });
  if (error) throw error;
  return data as { sessionId: string; next: { phase: number; number: number } | null };
}

export async function saveReflection(sessionId: string, humor: number | null, nota: string | null) {
  const { error } = await supabase.from("sessions").update({ humor, nota }).eq("id", sessionId);
  if (error) throw error;
}

export async function saveExtra(sessionId: string, planned: number, extraSeconds: number) {
  const { error } = await supabase.from("sessions")
    .update({ extra_seconds: extraSeconds, duracao_min: planned + Math.floor(extraSeconds / 60) })
    .eq("id", sessionId).neq("tipo", "manual");
  if (error) throw error;
}

export const lastPracticeQuery = queryOptions({
  queryKey: ["sessions", "last"],
  queryFn: async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from("sessions")
      .select("concluida_em")
      .order("concluida_em", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0]?.concluida_em ?? null;
  },
});

export async function undoLastCheck() {
  const { data, error } = await supabase
    .from("checks")
    .select("id")
    .is("reset_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0];
  if (!last) return;
  const { error: e2 } = await supabase
    .from("checks")
    .update({ reset_at: new Date().toISOString() })
    .eq("id", last.id);
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
  return resetFromPhase(FIRST_PHASE);
}
