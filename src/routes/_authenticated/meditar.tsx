import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { activeChecksQuery, completeJourneySession } from "@/lib/journey-data";
import { nextDuration } from "@/lib/journey";
import { playBell, unlockAudio } from "@/lib/bell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meditar")({
  head: () => ({ meta: [{ title: "Meditar · Bambu" }, { name: "description", content: "Sessão de meditação." }] }),
  component: Meditar,
});

const PREP_MS = 10_000;
type Phase = "prep" | "running" | "paused" | "saving" | "done" | "error";
type Result = { next: { phase: number; number: number } | null };

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* ignorado */
      }
    };
    void req();
    const onVis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [active]);
}

function Meditar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery(activeChecksQuery);
  const durationMin = data ? nextDuration(data.length) : null;

  const [phase, setPhase] = useState<Phase>("prep");
  const [now, setNow] = useState(() => Date.now());
  const prepEnd = useRef<number>(0);
  const endAt = useRef<number>(0);
  const remainingOnPause = useRef<number>(0);
  const [controls, setControls] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useWakeLock(phase === "prep" || phase === "running" || phase === "paused");

  // inicia preparação quando a duração for conhecida
  useEffect(() => {
    if (durationMin == null || prepEnd.current) return;
    unlockAudio();
    prepEnd.current = Date.now() + PREP_MS;
  }, [durationMin]);

  const finish = useCallback(async () => {
    if (durationMin == null) return;
    playBell();
    setPhase("saving");
    try {
      const r = await completeJourneySession(durationMin);
      await qc.invalidateQueries({ queryKey: ["checks"] });
      setResult({ next: r.next });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, [durationMin, qc]);

  // relógio baseado em timestamps
  useEffect(() => {
    if (phase !== "prep" && phase !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (phase === "prep" && prepEnd.current && t >= prepEnd.current && durationMin != null) {
        endAt.current = t + durationMin * 60_000;
        playBell();
        setPhase("running");
      } else if (phase === "running" && t >= endAt.current) {
        void finish();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, durationMin, finish]);

  function reveal() {
    unlockAudio();
    if (phase !== "running" && phase !== "paused" && phase !== "prep") return;
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  }

  function togglePause() {
    if (phase === "running") {
      remainingOnPause.current = endAt.current - Date.now();
      setPhase("paused");
    } else if (phase === "paused") {
      endAt.current = Date.now() + remainingOnPause.current;
      setNow(Date.now());
      setPhase("running");
    }
    reveal();
  }

  if (phase === "done" && result) return <PostSession result={result} onBack={() => navigate({ to: "/jornada" })} />;

  const display =
    phase === "prep"
      ? Math.max(0, Math.ceil((prepEnd.current - now) / 1000)).toString()
      : phase === "paused"
        ? fmt(remainingOnPause.current)
        : phase === "running"
          ? fmt(endAt.current - now)
          : "";

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col items-center justify-center bg-void text-foreground" onClick={reveal}>
      {phase === "prep" && (
        <p className="absolute top-[30%] text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-slow">Prepare-se</p>
      )}
      {(phase === "saving" || phase === "error") ? (
        <div className="px-8 text-center animate-fade-slow">
          {phase === "saving" ? (
            <p className="text-sm text-muted-foreground">Registrando…</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Não foi possível salvar a sessão.</p>
              <button onClick={() => void finish()} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">
                Tentar de novo
              </button>
            </>
          )}
        </div>
      ) : (
        <span
          className={cn(
            "font-sans font-[100] tabular-nums tracking-tight transition-opacity duration-1000",
            phase === "prep" ? "text-[9rem]" : "text-[5.5rem]",
            phase === "paused" && "opacity-50",
            durationMin == null && "opacity-0",
          )}
        >
          {display}
        </span>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex gap-3 px-6 pb-safe pt-6 transition-opacity duration-700",
          controls ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {phase !== "prep" && (
          <button onClick={togglePause} className="mb-6 flex-1 rounded-full border border-border py-4 text-sm text-muted-foreground">
            {phase === "paused" ? "Retomar" : "Pausar"}
          </button>
        )}
        <button
          onClick={() => {
            if (phase === "running") togglePause();
            setConfirmEnd(true);
          }}
          className="mb-6 flex-1 rounded-full border border-border py-4 text-sm text-muted-foreground"
        >
          Encerrar
        </button>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="rounded-3xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-light">Encerrar agora?</AlertDialogTitle>
            <AlertDialogDescription>Esta sessão não será contada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Continuar</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={() => navigate({ to: "/jornada" })}>
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostSession({ result, onBack }: { result: Result; onBack: () => void }) {
  const n = result.next;
  const phaseDone = n && n.number === n.phase;
  const journeyDone = n && n.phase === 30 && n.number === 30;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background px-8 text-center">
      {(phaseDone || journeyDone) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute h-56 w-56 rounded-full border border-sage animate-ripple"
              style={{ animationDelay: `${i * 1}s` }}
            />
          ))}
        </div>
      )}
      <div className="relative animate-rise">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-sage text-3xl text-sage glow-sage">
          ✓
        </div>
        {journeyDone ? (
          <>
            <h1 className="mt-10 font-display text-5xl font-light">Jornada completa</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              462 checks. De 3 a 30 minutos. Seu bambu cresceu inteiro.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Continue praticando com sessões de 30 minutos.</p>
          </>
        ) : n ? (
          <>
            <p className="mt-10 text-lg">
              Check {n.number} de {n.phase} da Fase {n.phase} ✓
            </p>
            {phaseDone && (
              <>
                <h1 className="mt-6 font-display text-4xl font-light">Fase {n.phase} concluída</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  A seguir: Fase {n.phase + 1} · {n.phase + 1} minutos
                </p>
              </>
            )}
          </>
        ) : (
          <p className="mt-10 text-lg">Sessão de 30 minutos registrada ✓</p>
        )}
      </div>
      <button
        onClick={onBack}
        className="fixed inset-x-6 bottom-10 mx-auto max-w-md rounded-full bg-primary py-4 text-base text-primary-foreground animate-fade-slow"
      >
        Voltar à Jornada
      </button>
    </div>
  );
}
