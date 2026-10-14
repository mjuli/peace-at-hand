import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LogOut, Play, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { TabShell } from "@/components/TabShell";
import { ResetActions } from "@/components/ResetActions";
import { Slider } from "@/components/ui/slider";
import { activeChecksQuery } from "@/lib/journey-data";
import { progressFromCount } from "@/lib/journey";
import { AMBIENTS, BELLS, playBell, previewAmbient, type AmbientHandle } from "@/lib/bell";
import { DEFAULT_SETTINGS, PREP_OPTIONS, saveSettings, settingsQuery, type Settings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · Bambu" }, { name: "description", content: "Sons, sessão e jornada." }] }),
  component: Ajustes,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <p className="mb-3 px-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

function OptionRow({
  label,
  selected,
  onSelect,
  onPreview,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}) {
  return (
    <li className="flex items-center">
      <button onClick={onSelect} className="flex flex-1 items-center gap-3 px-5 py-4 text-left text-[15px]">
        <span
          className={cn(
            "h-3 w-3 rounded-full border transition-colors duration-500",
            selected ? "border-sage bg-sage" : "border-muted-foreground/40",
          )}
        />
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      </button>
      {onPreview && (
        <button aria-label={`Ouvir ${label}`} onClick={onPreview} className="px-5 py-4 text-muted-foreground">
          <Play className="h-4 w-4" strokeWidth={1.4} />
        </button>
      )}
    </li>
  );
}

function Ajustes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(activeChecksQuery);
  const { data: s = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const progress = progressFromCount(data?.length ?? 0);
  const [preview, setPreview] = useState<AmbientHandle | null>(null);

  async function update(patch: Partial<Settings>) {
    const prev = qc.getQueryData<Settings>(["settings"]);
    qc.setQueryData<Settings>(["settings"], { ...s, ...patch });
    try {
      await saveSettings(patch);
    } catch {
      qc.setQueryData(["settings"], prev);
      toast.error("Não foi possível salvar o ajuste.");
    }
  }

  function playAmbient(kind: Settings["ambient"]) {
    preview?.stop();
    setPreview(previewAmbient(kind, s.ambient_volume));
  }

  async function signOut() {
    preview?.stop();
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const card = "divide-y divide-border overflow-hidden rounded-2xl bg-card";

  return (
    <TabShell>
      <div className="px-6 pt-14 pb-8 animate-fade-slow">
        <h1 className="font-display text-4xl font-light">Ajustes</h1>

        <Section title="Sons">
          <p className="mb-2 px-1 text-sm">Sino de início</p>
          <ul className={card}>
            {BELLS.map((b) => (
              <OptionRow
                key={b.id}
                label={b.label}
                selected={s.bell_start === b.id}
                onSelect={() => void update({ bell_start: b.id })}
                onPreview={() => playBell(b.id, s.bell_volume)}
              />
            ))}
          </ul>
          <p className="mt-6 mb-2 px-1 text-sm">Sino de fim</p>
          <ul className={card}>
            {BELLS.map((b) => (
              <OptionRow
                key={b.id}
                label={b.label}
                selected={s.bell_end === b.id}
                onSelect={() => void update({ bell_end: b.id })}
                onPreview={() => playBell(b.id, s.bell_volume)}
              />
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-card px-5 py-5">
            <p className="mb-4 text-sm text-muted-foreground">Volume dos sinos</p>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[s.bell_volume]}
              onValueChange={(v) => qc.setQueryData<Settings>(["settings"], { ...s, bell_volume: v[0] ?? 0.7 })}
              onValueCommit={(v) => void update({ bell_volume: v[0] ?? 0.7 })}
            />
          </div>

          <p className="mt-6 mb-2 px-1 text-sm">Som ambiente</p>
          <ul className={card}>
            {AMBIENTS.map((a) => (
              <OptionRow
                key={a.id}
                label={a.label}
                selected={s.ambient === a.id}
                onSelect={() => void update({ ambient: a.id })}
                onPreview={a.id === "silencio" ? undefined : () => playAmbient(a.id)}
              />
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-card px-5 py-5">
            <p className="mb-4 text-sm text-muted-foreground">Volume do som ambiente</p>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[s.ambient_volume]}
              onValueChange={(v) => qc.setQueryData<Settings>(["settings"], { ...s, ambient_volume: v[0] ?? 0.5 })}
              onValueCommit={(v) => void update({ ambient_volume: v[0] ?? 0.5 })}
            />
          </div>
        </Section>

        <Section title="Sessão">
          <div className="rounded-2xl bg-card px-5 py-5">
            <p className="mb-4 text-sm text-muted-foreground">Contagem de preparação</p>
            <div className="grid grid-cols-5 gap-2">
              {PREP_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => void update({ prep_seconds: sec })}
                  className={cn(
                    "rounded-full border py-3 text-sm transition-colors duration-500",
                    s.prep_seconds === sec ? "border-sage bg-sage text-primary-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Lembrete de retorno">
          <div className="flex items-center justify-between rounded-2xl bg-card px-5 py-4">
            <span className="text-sm">Sugerir retorno após</span>
            <div className="flex items-center gap-4">
              <button
                aria-label="Menos dias"
                onClick={() => void update({ return_days: Math.max(1, s.return_days - 1) })}
                className="rounded-full border border-border p-2"
              >
                <Minus className="h-4 w-4" strokeWidth={1.4} />
              </button>
              <span className="w-16 text-center text-sm tabular-nums">
                {s.return_days} {s.return_days === 1 ? "dia" : "dias"}
              </span>
              <button
                aria-label="Mais dias"
                onClick={() => void update({ return_days: Math.min(60, s.return_days + 1) })}
                className="rounded-full border border-border p-2"
              >
                <Plus className="h-4 w-4" strokeWidth={1.4} />
              </button>
            </div>
          </div>
        </Section>

        <Section title="Jornada">
          <ResetActions currentPhase={progress.phase} />
          <p className="mt-3 px-1 text-xs text-muted-foreground">Os resets nunca apagam suas sessões registradas.</p>
        </Section>

        <button
          onClick={signOut}
          className="mt-12 flex w-full items-center justify-center gap-3 rounded-2xl bg-card py-5 text-[15px] text-destructive"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.4} />
          Sair da conta
        </button>
      </div>
    </TabShell>
  );
}
