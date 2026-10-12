import { createFileRoute } from "@tanstack/react-router";
import { TabShell, SoonScreen } from "@/components/TabShell";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({ meta: [{ title: "Conquistas · Bambu" }, { name: "description", content: "Suas conquistas na jornada." }] }),
  component: () => (
    <TabShell>
      <SoonScreen title="Conquistas" />
    </TabShell>
  ),
});
