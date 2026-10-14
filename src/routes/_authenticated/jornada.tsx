import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { TabShell } from "@/components/TabShell";
import { CheckDots } from "@/components/CheckDots";
import { ResetActions } from "@/components/ResetActions";
import { FreeSessionSheet, ManualPracticeSheet, ReturnBanner } from "@/components/JourneyExtras";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { activeChecksQuery, resetAll } from "@/lib/journey-data";
import { PHASES, progressFromCount } from "@/lib/journey";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({
    meta: [
      { title: "Jornada · Bambu" },
      { name: "description", content: "Sua jornada de meditação, fase a fase." },
    ],
  }),
  component: Jornada,
});

function Jornada() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(activeChecksQuery);
  const p = progressFromCount(data?.length ?? 0);
  const [menu, setMenu] = useState(false);
  const [restart, setRestart] = useState(false);
  const [free, setFree] = useState(false);
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isLoading) currentRef.current?.scrollIntoView({ block: "center" });
  }, [isLoading]);

  const doneIn = (phase: number) => {
    if (p.complete || phase < p.phase) return phase;
    if (phase === p.phase) return p.done;
    return 0;
  };

  return (
    <TabShell>
      <header className="flex items-center justify-between px-6 pt-10">
        <span className="font-display text-2xl font-light tracking-wide">Bambu</span>
        <button aria-label="Opções" onClick={() => setMenu(true)} className="-mr-2 rounded-full p-2 text-muted-foreground">
          <MoreHorizontal className="h-6 w-6" strokeWidth={1.4} />
        </button>
      </header>

      {/* progresso geral */}
      <div className="px-6 pt-4">
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-sage transition-all duration-1000" style={{ width: `${p.percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{p.percent}% da jornada</p>
      </div>

      <ReturnBanner phase={p.phase} />

      {/* caule */}
      <section className="flex flex-col-reverse items-center gap-[3px] px-6 pt-10 pb-96">
        {PHASES.map((phase) => {
          const state = p.complete || phase < p.phase ? "done" : phase === p.phase ? "current" : "future";
          const open = selected === phase;
          return (
            <div key={phase} className="flex w-full flex-col items-center">
              <button
                ref={state === "current" ? currentRef : undefined}
                onClick={() => setSelected(open ? null : phase)}
                aria-label={`Fase ${phase}`}
                className={cn(
                  "relative flex w-16 items-center justify-center rounded-[14px] border transition-all duration-1000",
                  state === "done" && "border-sage bg-sage text-primary-foreground",
                  state === "current" && "animate-breathe border-sage bg-sage-soft text-sage",
                  state === "future" && "border-muted-foreground/25 text-muted-foreground/50",
                )}
                style={{ height: `${36 + phase * 1.6}px` }}
              >
                <span className="text-xs">{phase}</span>
              </button>
              {open && (
                <div className="my-3 w-full max-w-xs rounded-2xl bg-card px-5 py-4 text-center animate-rise">
                  <p className="text-sm">
                    Fase {phase} · {phase} minutos
                  </p>
                  <div className="mt-3 flex justify-center">
                    <CheckDots total={phase} done={doneIn(phase)} size="sm" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* card fixo da fase atual, ao alcance do polegar */}
      <div className="fixed inset-x-0 bottom-[76px] z-30 px-4">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/95 p-5 backdrop-blur-md animate-rise">
          {p.complete ? (
            <>
              <p className="font-display text-2xl font-light">Jornada completa</p>
              <p className="mt-1 text-sm text-muted-foreground">Modo manutenção · sessões de 30 minutos</p>
              <div className="mt-4 flex gap-3">
                <Link
                  to="/meditar"
                  search={{ tipo: "jornada" }}
                  className="flex-1 rounded-full bg-primary py-4 text-center text-base text-primary-foreground"
                >
                  Meditar
                </Link>
                <button onClick={() => setRestart(true)} className="rounded-full border border-border px-5 text-sm">
                  Recomeçar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <p className="font-display text-2xl font-light">
                  Fase {p.phase} · {p.phase} minutos
                </p>
                <span className="text-xs text-muted-foreground">
                  {p.done} de {p.phase}
                </span>
              </div>
              <div className="mt-3">
                <CheckDots total={p.phase} done={p.done} />
              </div>
              <Link
                to="/meditar"
                  search={{ tipo: "jornada" }}
                className="mt-5 block rounded-full bg-primary py-4 text-center text-base tracking-wide text-primary-foreground transition-opacity duration-500 active:opacity-80"
              >
                Meditar
              </Link>
            </>
          )}
          <div className="mt-3 flex justify-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => setFree(true)} className="py-2">Sessão livre</button>
            <span className="py-2 opacity-30">·</span>
            <button onClick={() => setManual(true)} className="py-2">Registrar prática manual</button>
          </div>
        </div>
      </div>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background px-4 pb-10">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-light">Opções</SheetTitle>
          </SheetHeader>
          <ResetActions currentPhase={p.phase} onDone={() => setMenu(false)} />
        </SheetContent>
      </Sheet>

      <FreeSessionSheet open={free} onOpenChange={setFree} />
      <ManualPracticeSheet open={manual} onOpenChange={setManual} activeCount={data?.length ?? 0} />

      <AlertDialog open={restart} onOpenChange={setRestart}>
        <AlertDialogContent className="rounded-3xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-light">Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>A jornada volta para a fase 3. Seu histórico de sessões é mantido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={async () => {
                await resetAll();
                await qc.invalidateQueries({ queryKey: ["checks"] });
              }}
            >
              Recomeçar a jornada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabShell>
  );
}
