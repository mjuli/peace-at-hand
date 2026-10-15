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
import { z } from "zod";
import { activeChecksQuery, recordSession, saveReflection } from "@/lib/journey-data";
import { syncAchievements } from "@/lib/history-data";
import type { AchievementDef } from "@/lib/achievements";
import { nextDuration } from "@/lib/journey";
import { playBell, startAmbient, unlockAudio, type AmbientHandle } from "@/lib/bell";
import { settingsQuery } from "@/lib/settings";
import { toast } from "sonner";
import { Frown, Meh, Smile, Annoyed, Laugh } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meditar")({
  head: () => ({ meta: [{ title: "Meditar · Bambu" }, { name: "description", content: "Sessão de meditação." }] }),
  validateSearch: z.object({
    tipo: z.enum(["jornada", "livre"]).catch("jornada").default("jornada"),
    min: z.coerce.number().int().min(1).max(120).optional().catch(undefined),
  }),
  component: Meditar,
});

type Phase = "prep" | "running" | "paused" | "saving" | "done" | "error";
type Result = { sessionId: string; tipo: "jornada" | "livre"; minutes: number; next: { phase: number; number: number } | null; unlocked: AchievementDef[] };

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
  const { tipo, min } = Route.useSearch();
  const { data } = useQuery(activeChecksQuery);
  const { data: settings } = useQuery(settingsQuery);
  const durationMin = !settings ? null : tipo === "livre" ? (min ?? 10) : data ? nextDuration(data.length) : null;
  const ambient = useRef<AmbientHandle | null>(null);
  useEffect(() => () => ambient.current?.stop(), []);

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
    prepEnd.current = Date.now() + (settings?.prep_seconds ?? 10) * 1000 + 1;
  }, [durationMin]);

  const finish = useCallback(async () => {
    if (durationMin == null) return;
    if (phase === "running") {
      playBell(settings?.bell_end, settings?.bell_volume);
      ambient.current?.stop();
      ambient.current = null;
    }
    setPhase("saving");
    try {
      const r = await recordSession({ tipo, durationMin });
      await qc.invalidateQueries({ queryKey: ["checks"] });
      await qc.invalidateQueries({ queryKey: ["sessions"] });
      const unlocked = await syncAchievements(qc).catch(() => [] as AchievementDef[]);
      setResult({ sessionId: r.sessionId, tipo, minutes: durationMin, next: r.next, unlocked });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, [durationMin, qc, tipo, settings, phase]);

  // relógio baseado em timestamps
  useEffect(() => {
    if (phase !== "prep" && phase !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (phase === "prep" && prepEnd.current && t >= prepEnd.current && durationMin != null) {
        endAt.current = t + durationMin * 60_000;
        playBell(settings?.bell_start, settings?.bell_volume);
        if (settings) ambient.current = startAmbient(settings.ambient, settings.ambient_volume);
        setPhase("running");
      } else if (phase === "running" && t >= endAt.current) {
        void finish();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, durationMin, finish, settings]);

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
      ambient.current?.pause();
      setPhase("paused");
    } else if (phase === "paused") {
      endAt.current = Date.now() + remainingOnPause.current;
      setNow(Date.now());
      ambient.current?.resume();
      setPhase("running");
    }
    reveal();
  }

  if (phase === "done" && result) return <PostSession result={result} onBack={() => navigate({ to: "/jornada" })} />;

  const display =
    phase === "prep"
      ? Math.max(0, Math.ceil((prepEnd.current - now) / 1000)).toString().replace(/^0$/, "")
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

const MOODS = [
  { v: 1, icon: Frown, label: "Difícil" },
  { v: 2, icon: Annoyed, label: "Inquieto" },
  { v: 3, icon: Meh, label: "Neutro" },
  { v: 4, icon: Smile, label: "Bem" },
  { v: 5, icon: Laugh, label: "Ótimo" },
];

function PostSession({ result, onBack }: { result: Result; onBack: () => void }) {
  const n = result.next;
  const phaseDone = n && n.number === n.phase;
  const journeyDone = n && n.phase === 30 && n.number === 30;
  const [showReflect, setShowReflect] = useState(false);
  const [humor, setHumor] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowReflect(true), 1800);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    if (humor == null && !nota.trim()) return onBack();
    setSaving(true);
    try {
      await saveReflection(result.sessionId, humor, nota.trim() || null);
      const extra = await syncAchievements().catch(() => [] as AchievementDef[]);
      extra.forEach((a) => toast(`Conquista desbloqueada: ${a.nome}`, { description: a.descricao }));
      onBack();
    } catch {
      toast.error("Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-background px-8 pt-[14vh] pb-40 text-center">
      {(phaseDone || journeyDone) && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
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
        {result.unlocked.length > 0 && (
          <div className="mx-auto mb-8 max-w-xs rounded-2xl border border-sage/40 px-4 py-3 text-sm animate-fade-slow">
            <p className="text-[11px] tracking-wide text-sage">Conquista desbloqueada</p>
            {result.unlocked.map((a) => (
              <p key={a.codigo} className="mt-1 font-display text-xl font-light">{a.nome}</p>
            ))}
          </div>
        )}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-sage text-3xl text-sage glow-sage">
          ✓
        </div>
        {journeyDone ? (
          <>
            <h1 className="mt-10 font-display text-5xl font-light">Jornada completa</h1>
            <p className="mt-4 text-sm text-muted-foreground">462 checks. De 3 a 30 minutos. Seu bambu cresceu inteiro.</p>
            <p className="mt-2 text-sm text-muted-foreground">Continue praticando com sessões de 30 minutos.</p>
          </>
        ) : result.tipo === "livre" ? (
          <p className="mt-10 text-lg">Sessão livre de {result.minutes} min registrada ✓</p>
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

      {showReflect && (
        <div className="relative mt-12 w-full max-w-sm animate-rise">
          <p className="text-sm text-muted-foreground">Como você se sente?</p>
          <div className="mt-4 flex justify-between">
            {MOODS.map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                aria-label={label}
                onClick={() => setHumor(humor === v ? null : v)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500",
                  humor === v ? "border-sage bg-sage-soft text-sage" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.3} />
              </button>
            ))}
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value.slice(0, 280))}
            placeholder="Uma nota curta (opcional)"
            rows={3}
            className="mt-6 w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-sage"
          />
        </div>
      )}

      <div className="fixed inset-x-6 bottom-8 mx-auto flex max-w-md gap-3 animate-fade-slow">
        <button onClick={onBack} className="flex-1 rounded-full border border-border py-4 text-base text-muted-foreground">
          Pular
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex-1 rounded-full bg-primary py-4 text-base text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
