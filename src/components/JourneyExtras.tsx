import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { lastPracticeQuery, recordSession, resetFromPhase } from "@/lib/journey-data";
import { saveSettings, settingsQuery } from "@/lib/settings";
import { previousPhase, shouldSuggestReturn } from "@/lib/return-suggestion";
import { nextCheck } from "@/lib/journey";

const sheetCls = "rounded-t-3xl border-border bg-background px-6 pb-10";
const inputCls =
  "w-full rounded-2xl border border-input bg-card px-4 py-4 text-base outline-none focus:border-sage [color-scheme:dark]";

export function FreeSessionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [min, setMin] = useState(10);
  const clamp = (v: number) => Math.max(1, Math.min(120, v));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={sheetCls}>
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-2xl font-light">Sessão livre</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground">Não conta para a jornada.</p>
        <div className="my-8 flex items-center justify-center gap-8">
          <button aria-label="Menos" onClick={() => setMin(clamp(min - 1))} className="rounded-full border border-border p-3">
            <Minus className="h-5 w-5" strokeWidth={1.4} />
          </button>
          <div className="w-28 text-center">
            <span className="text-6xl font-[200] tabular-nums">{min}</span>
            <p className="text-xs text-muted-foreground">minutos</p>
          </div>
          <button aria-label="Mais" onClick={() => setMin(clamp(min + 1))} className="rounded-full border border-border p-3">
            <Plus className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </div>
        <Slider min={1} max={120} step={1} value={[min]} onValueChange={(v) => setMin(v[0] ?? 10)} />
        <button
          onClick={() => navigate({ to: "/meditar", search: { tipo: "livre", min } })}
          className="mt-10 w-full rounded-full bg-primary py-4 text-base text-primary-foreground"
        >
          Começar
        </button>
      </SheetContent>
    </Sheet>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ManualPracticeSheet({
  open,
  onOpenChange,
  activeCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activeCount: number;
}) {
  const qc = useQueryClient();
  const d = new Date();
  const [date, setDate] = useState(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  const [time, setTime] = useState(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const [minutes, setMinutes] = useState(10);
  const [asCheck, setAsCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = nextCheck(activeCount);
  const effectiveMin = asCheck && next ? next.phase : minutes;

  async function submit() {
    const when = new Date(`${date}T${time}`);
    if (Number.isNaN(when.getTime())) { toast.error("Data ou horário inválido."); return; }
    if (when.getTime() > Date.now() + 60_000) { toast.error("A prática não pode estar no futuro."); return; }
    setBusy(true);
    try {
      await recordSession({ tipo: "manual", durationMin: effectiveMin, concluidaEm: when.toISOString(), countCheck: asCheck && !!next });
      await qc.invalidateQueries({ queryKey: ["checks"] });
      await qc.invalidateQueries({ queryKey: ["sessions"] });
      toast(asCheck && next ? `Check ${next.number} da Fase ${next.phase} registrado ✓` : "Prática registrada ✓");
      setAsCheck(false);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível registrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={sheetCls}>
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-2xl font-light">Registrar prática manual</SheetTitle>
        </SheetHeader>
        <div className="mt-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Data" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label="Horário" />
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-card px-4 py-4">
            <span className="text-sm">Duração (minutos)</span>
            <input
              type="number"
              min={1}
              max={300}
              disabled={asCheck && !!next}
              value={effectiveMin}
              onChange={(e) => setMinutes(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
              className="w-20 bg-transparent text-right text-base outline-none disabled:text-muted-foreground"
            />
          </label>
          {next && (
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-4">
              <span className="text-sm">
                Contar como próximo check da jornada
                <span className="block text-xs text-muted-foreground">
                  Check {next.number} da Fase {next.phase} · {next.phase} min
                </span>
              </span>
              <Switch checked={asCheck} onCheckedChange={setAsCheck} />
            </label>
          )}
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-8 w-full rounded-full bg-primary py-4 text-base text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Aguarde…" : "Registrar"}
        </button>
      </SheetContent>
    </Sheet>
  );
}

export function ReturnBanner({ phase }: { phase: number }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const { data: last } = useQuery(lastPracticeQuery);
  const [busy, setBusy] = useState(false);
  if (!settings || last === undefined) return null;
  if (!shouldSuggestReturn({ lastPracticeAt: last, dismissedAt: settings.return_dismissed_at, returnDays: settings.return_days }))
    return null;

  async function choose(action: "back" | "restart" | "continue") {
    setBusy(true);
    try {
      if (action === "back") await resetFromPhase(previousPhase(phase));
      if (action === "restart") await resetFromPhase(phase);
      await saveSettings({ return_dismissed_at: new Date().toISOString() });
      await qc.invalidateQueries({ queryKey: ["checks"] });
      await qc.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error("Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-full border border-border px-4 py-3 text-sm transition-colors duration-500 disabled:opacity-50";
  return (
    <div className="mx-6 mt-6 rounded-3xl border border-border bg-card p-5 animate-rise">
      <p className="font-display text-xl font-light">Que bom te ver de volta</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Faz um tempo desde a última prática. Se quiser, volte um pouco para retomar com calma.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {phase > 3 && (
          <button disabled={busy} onClick={() => void choose("back")} className={btn}>
            Voltar uma fase
          </button>
        )}
        <button disabled={busy} onClick={() => void choose("restart")} className={btn}>
          Recomeçar esta fase
        </button>
        <button disabled={busy} onClick={() => void choose("continue")} className={`${btn} border-sage text-sage`}>
          Continuar de onde parei
        </button>
      </div>
    </div>
  );
}
