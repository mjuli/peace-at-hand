import { createFileRoute } from "@tanstack/react-router";
import { TabShell, SoonScreen } from "@/components/TabShell";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico · Bambu" }, { name: "description", content: "Seu histórico de práticas." }] }),
  component: () => (
    <TabShell>
      <SoonScreen title="Histórico" />
    </TabShell>
  ),
});
