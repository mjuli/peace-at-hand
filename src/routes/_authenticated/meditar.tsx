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
import { activeChecksQuery, recordSession, saveExtra, saveReflection } from "@/lib/journey-data";
import { MAX_EXTRA_SECONDS, addedExtra, elapsedExtra } from "@/lib/extra-time";
import { syncAchievements } from "@/lib/history-data";
import type { AchievementDef } from "@/lib/achievements";
import { nextDuration } from "@/lib/journey";
import { playBell, startAmbient, unlockAudio, type AmbientHandle } from "@/lib/bell";
import { settingsQuery } from "@/lib/settings";
import { toast } from "sonner";
import { Frown, Meh, Smile, Annoyed, Laugh } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meditar")({
  head: () => ({ meta: [{ title: "Meditar · Bambu" }, { name: "description", content: "Sessão de meditação." }, { property: "og:title", content: "Meditar · Bambu" }, { property: "og:description", content: "Sessão de meditação." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  validateSearch: z.object({
    tipo: z.enum(["jornada", "livre"]).catch("jornada").default("jornada"),
    min: z.coerce.number().int().min(1).max(120).optional().catch(undefined),
  }),
  component: Meditar,
});

type Phase = "prep" | "running" | "paused" | "extra" | "saving" | "done" | "error";
type Saved = { sessionId: string; tipo: "jornada" | "livre"; minutes: number; next: { phase: number; number: number } | null; unlocked: AchievementDef[] };
type Result = Saved & { extraSec: number };

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
  const saved = useRef<Promise<Saved> | null>(null);
  const extraSec = useRef(0);
  const completed = useRef(false);
  const sessionId = useRef<string | null>(null);
  const lockedDuration = useRef<number | null>(null);
  if (durationMin != null && lockedDuration.current == null) lockedDuration.current = durationMin;

  useWakeLock(phase === "prep" || phase === "running" || phase === "paused" || phase === "extra");

  // inicia preparação quando a duração for conhecida
  useEffect(() => {
    if (durationMin == null || prepEnd.current) return;
    unlockAudio();
    prepEnd.current = Date.now() + (settings?.prep_seconds ?? 10) * 1000 + 1;
  }, [durationMin]);

  const save = useCallback(() => {
    if (saved.current) return saved.current;
    const planned = lockedDuration.current;
    if (planned == null) return Promise.reject(new Error("sem duração"));
    saved.current = (async () => {
      sessionId.current ??= crypto.randomUUID();
      const r = await recordSession({ tipo, durationMin: planned, sessionId: sessionId.current, concluidaEm: new Date(endAt.current).toISOString() });
      await qc.invalidateQueries({ queryKey: ["checks"] }).catch(() => {});
      await qc.invalidateQueries({ queryKey: ["sessions"] }).catch(() => {});
      const unlocked = await syncAchievements(qc).catch(() => [] as AchievementDef[]);
      return { sessionId: r.sessionId, tipo, minutes: planned, next: r.next, unlocked };
    })();
    return saved.current;
  }, [durationMin, qc, tipo]);

  const conclude = useCallback(async () => {
    ambient.current?.stop();
    ambient.current = null;
    setPhase("saving");
    try {
      const r = await (saved.current ?? save());
      setResult({ ...r, extraSec: extraSec.current });
      setPhase("done");
    } catch {
      saved.current = null;
      setPhase("error");
    }
  }, [save]);

  const reachPlannedEnd = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    extraSec.current = settings?.count_up ? elapsedExtra(endAt.current, Date.now()) : 0;
    playBell(settings?.bell_end, settings?.bell_volume);
    const p = save();
    if (settings?.count_up ?? true) {
      setPhase("extra");
      p.catch(() => {
        saved.current = null;
        ambient.current?.stop();
        ambient.current = null;
        setPhase("error");
      });
    } else void conclude();
  }, [settings, save, conclude]);

  // relógio baseado em timestamps
  useEffect(() => {
    if (phase !== "prep" && phase !== "running" && phase !== "extra") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (phase === "prep" && prepEnd.current && t >= prepEnd.current && durationMin != null) {
        endAt.current = t + durationMin * 60_000;
        playBell(settings?.bell_start, settings?.bell_volume);
        if (settings) ambient.current = startAmbient(settings.ambient, settings.ambient_volume);
        setPhase("running");
      } else if (phase === "running" && t >= endAt.current) {
        reachPlannedEnd();
      } else if (phase === "extra") {
        extraSec.current = elapsedExtra(endAt.current, t);
        if (extraSec.current >= MAX_EXTRA_SECONDS) void conclude();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, durationMin, reachPlannedEnd, conclude, settings]);

  function reveal() {
    unlockAudio();
    if (phase !== "running" && phase !== "paused" && phase !== "prep" && phase !== "extra") return;
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
        : phase === "extra"
          ? `+${fmt(elapsedExtra(endAt.current, now) * 1000)}`
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
              <Button variant="ghost" onClick={() => void conclude()} className="h-auto mt-6 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">
                Tentar de novo
              </Button>
            </>
          )}
        </div>
      ) : (
        <span
          className={cn(
            "font-sans font-[100] tabular-nums tracking-tight transition-opacity duration-1000",
            phase === "prep" ? "text-[9rem]" : "text-[5.5rem]",
            phase === "paused" && "opacity-50",
            phase === "extra" && "text-muted-foreground",
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
        {phase === "extra" ? (
          <Button variant="ghost" onClick={() => void conclude()} className="h-auto mb-6 flex-1 rounded-full border border-border py-4 text-sm text-muted-foreground">
            Concluir
          </Button>
        ) : (
          <>
        {phase !== "prep" && (
          <Button variant="ghost" onClick={togglePause} className="h-auto mb-6 flex-1 rounded-full border border-border py-4 text-sm text-muted-foreground">
            {phase === "paused" ? "Retomar" : "Pausar"}
          </Button>
        )}
        <Button variant="ghost"
          onClick={() => {
            if (phase === "running") togglePause();
            setConfirmEnd(true);
          }}
          className="h-auto mb-6 flex-1 rounded-full border border-border py-4 text-sm text-muted-foreground"
        >
          Encerrar
        </Button>
          </>
        )}
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
  const extraMin = Math.floor(result.extraSec / 60);
  const [addExtra, setAddExtra] = useState(true);

  async function applyExtra() {
    const extra = addedExtra(result.extraSec, addExtra);
    if (extra > 0) await saveExtra(result.sessionId, result.minutes, extra);
  }

  useEffect(() => {
    const t = setTimeout(() => setShowReflect(true), 1800);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await applyExtra();
      if (humor != null || nota.trim()) await saveReflection(result.sessionId, humor, nota.trim() || null);
      const extra = await syncAchievements().catch(() => [] as AchievementDef[]);
      extra.forEach((a) => toast(`Conquista desbloqueada: ${a.nome}`, { description: a.descricao }));
      onBack();
    } catch {
      toast.error("Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    try {
      await applyExtra();
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
          {extraMin >= 1 && (
            <div className="mb-8 rounded-2xl border border-border p-4">
              <p className="text-sm">Você meditou mais {extraMin} min além do planejado. Adicionar ao total?</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <Button variant="ghost" key={String(v)} onClick={() => setAddExtra(v)} className={cn("h-auto rounded-full border py-3 text-sm", addExtra === v ? "border-sage bg-sage text-primary-foreground" : "border-border text-muted-foreground")}>
                    {v ? "Adicionar" : "Não adicionar"}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Como você se sente?</p>
          <div className="mt-4 flex justify-between">
            {MOODS.map(({ v, icon: Icon, label }) => (
              <Button variant="ghost"
                key={v}
                aria-label={label}
                onClick={() => setHumor(humor === v ? null : v)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500",
                  humor === v ? "border-sage bg-sage-soft text-sage" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.3} />
              </Button>
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
        <Button variant="ghost" onClick={() => void skip()} disabled={saving} className="h-auto flex-1 rounded-full border border-border py-4 text-base text-muted-foreground disabled:opacity-60">
          Pular
        </Button>
        <Button variant="ghost"
          onClick={() => void save()}
          disabled={saving}
          className="h-auto flex-1 rounded-full bg-primary py-4 text-base text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
