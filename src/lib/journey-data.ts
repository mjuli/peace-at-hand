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

/** Registra uma sessão. Para 'jornada', marca o próximo check; para 'manual', só se countCheck. */
export async function recordSession(opts: {
  tipo: "jornada" | "livre" | "manual";
  durationMin: number;
  concluidaEm?: string;
  countCheck?: boolean;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  const counts = opts.tipo === "jornada" || (opts.tipo === "manual" && !!opts.countCheck);
  const next = counts ? nextCheck(await countActive()) : null;
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: u.user.id,
      tipo: opts.tipo,
      duracao_min: opts.durationMin,
      concluida_em: opts.concluidaEm ?? new Date().toISOString(),
      fase: opts.tipo === "jornada" ? (next?.phase ?? 30) : (next?.phase ?? null),
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
  return { sessionId: session.id, next };
}

export async function saveReflection(sessionId: string, humor: number | null, nota: string | null) {
  const { error } = await supabase.from("sessions").update({ humor, nota }).eq("id", sessionId);
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
  return resetFromPhase(3);
}
