import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { TabShell } from "@/components/TabShell";
import { ResetActions } from "@/components/ResetActions";
import { activeChecksQuery } from "@/lib/journey-data";
import { progressFromCount } from "@/lib/journey";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · Bambu" }, { name: "description", content: "Ajustes e resets da jornada." }] }),
  component: Ajustes,
});

function Ajustes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(activeChecksQuery);
  const progress = progressFromCount(data?.length ?? 0);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <TabShell>
      <div className="px-6 pt-14 animate-fade-slow">
        <h1 className="font-display text-4xl font-light">Ajustes</h1>
        <p className="mt-10 mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Progresso da jornada</p>
        <ResetActions currentPhase={progress.phase} />
        <p className="mt-3 px-1 text-xs text-muted-foreground">Os resets nunca apagam suas sessões registradas.</p>
        <button
          onClick={signOut}
          className="mt-12 flex w-full items-center justify-center gap-3 rounded-2xl bg-card py-5 text-[15px] text-destructive"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.4} />
          Sair
        </button>
      </div>
    </TabShell>
  );
}
