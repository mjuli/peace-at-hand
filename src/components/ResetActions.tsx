import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2, RotateCcw, RefreshCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PHASES } from "@/lib/journey";
import { resetAll, resetFromPhase, undoLastCheck } from "@/lib/journey-data";
import { cn } from "@/lib/utils";

type Kind = "undo" | "phase" | "all" | null;

export function ResetActions({ currentPhase, onDone }: { currentPhase: number; onDone?: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>(null);
  const [phase, setPhase] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if (kind === "undo") await undoLastCheck();
      if (kind === "phase" && phase) await resetFromPhase(phase);
      if (kind === "all") await resetAll();
      await qc.invalidateQueries({ queryKey: ["checks"] });
      toast("Progresso atualizado");
      setKind(null);
      setPhase(null);
      onDone?.();
    } catch {
      toast.error("Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const items = [
    { k: "undo" as const, icon: Undo2, label: "Desfazer o último check" },
    { k: "phase" as const, icon: RotateCcw, label: "Reiniciar a partir de uma fase" },
    { k: "all" as const, icon: RefreshCcw, label: "Resetar toda a jornada" },
  ];

  const desc =
    kind === "undo"
      ? "Apenas o check mais recente será desmarcado."
      : kind === "all"
        ? "Seu progresso volta para a fase 3. Seu histórico de sessões é mantido."
        : "Escolha a fase. O progresso volta para o início dela; o histórico de sessões é mantido.";

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {items.map(({ k, icon: Icon, label }) => (
          <li key={k}>
            <button
              onClick={() => setKind(k)}
              className="flex w-full items-center gap-4 px-5 py-5 text-left text-[15px] transition-colors duration-500 active:bg-accent"
            >
              <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.4} />
              {label}
            </button>
          </li>
        ))}
      </ul>

      <AlertDialog open={kind !== null} onOpenChange={(o) => !o && (setKind(null), setPhase(null))}>
        <AlertDialogContent className="rounded-3xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-light">Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>{desc}</AlertDialogDescription>
          </AlertDialogHeader>
          {kind === "phase" && (
            <div className="grid grid-cols-7 gap-2 py-2">
              {PHASES.filter((p) => p <= currentPhase).map((p) => (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={cn(
                    "aspect-square rounded-full border text-sm transition-colors duration-500",
                    phase === p ? "border-sage bg-sage text-primary-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (kind === "phase" && !phase)}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
              className="rounded-full"
            >
              {busy ? "Aguarde…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
