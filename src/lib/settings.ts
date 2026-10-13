import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AmbientKind, BellKind } from "./bell";

export interface Settings {
  bell_start: BellKind;
  bell_end: BellKind;
  bell_volume: number;
  ambient: AmbientKind;
  ambient_volume: number;
  prep_seconds: number;
  return_days: number;
  return_dismissed_at: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  bell_start: "tigela",
  bell_end: "tigela",
  bell_volume: 0.7,
  ambient: "silencio",
  ambient_volume: 0.5,
  prep_seconds: 10,
  return_days: 7,
  return_dismissed_at: null,
};

export const PREP_OPTIONS = [0, 5, 10, 15, 30];

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<Settings> => {
    const { data, error } = await supabase.from("settings").select("*").maybeSingle();
    if (error) throw error;
    if (data) return { ...DEFAULT_SETTINGS, ...(data as Partial<Settings>) };
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("settings").insert({ user_id: u.user.id });
    return DEFAULT_SETTINGS;
  },
});

export async function saveSettings(patch: Partial<Settings>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: u.user.id, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}
