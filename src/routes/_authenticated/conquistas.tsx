import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Award, Lock } from "lucide-react";
import { TabShell } from "@/components/TabShell";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { achievementsQuery, syncAchievements } from "@/lib/history-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({ meta: [{ title: "Conquistas · Bambu" }, { name: "description", content: "Suas conquistas na jornada." }, { property: "og:title", content: "Conquistas · Bambu" }, { property: "og:description", content: "Suas conquistas na jornada." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Conquistas,
});

function Conquistas() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(achievementsQuery);
  useEffect(() => {
    void syncAchievements(qc)
      .then((list) => list.forEach((a) => toast(`Conquista desbloqueada: ${a.nome}`, { description: a.descricao })))
      .catch(() => {});
  }, [qc]);
  const got = new Map(data.map((a) => [a.codigo, a.desbloqueada_em]));
  const n = ACHIEVEMENTS.filter((a) => got.has(a.codigo)).length;

  return (
    <TabShell>
      <div className="px-6 pt-10 animate-fade-slow">
        <h1 className="font-display text-4xl font-light">Conquistas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="text-sage">{n}</span> de {ACHIEVEMENTS.length}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const at = got.get(a.codigo);
            return (
              <div key={a.codigo} className={cn("rounded-2xl border p-4 transition-opacity", at ? "border-sage/50" : "border-border opacity-45")}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border", at ? "border-sage text-sage glow-sage" : "border-border text-muted-foreground")}>
                  {at ? <Award className="h-5 w-5" strokeWidth={1.4} /> : <Lock className="h-4 w-4" strokeWidth={1.4} />}
                </div>
                <p className="mt-3 font-display text-xl font-light leading-tight">{a.nome}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.descricao}</p>
                {at && <p className="mt-2 text-[11px] text-sage">{new Date(at).toLocaleDateString("pt-BR")}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </TabShell>
  );
}
