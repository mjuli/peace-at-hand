import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Frown, Meh, Smile, Annoyed, Laugh } from "lucide-react";
import { TabShell } from "@/components/TabShell";
import { allSessionsQuery } from "@/lib/history-data";
import { activeChecksQuery } from "@/lib/journey-data";
import { progressFromCount, TOTAL_CHECKS } from "@/lib/journey";
import { avgDaysPerWeek, dayKey, favoritePeriod, heatLevel, journeyEstimate, minutesByDay, streaks } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { formatMinutes, totalMinutes } from "@/lib/extra-time";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico · Bambu" }, { name: "description", content: "Seu histórico de práticas." }, { property: "og:title", content: "Histórico · Bambu" }, { property: "og:description", content: "Seu histórico de práticas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Historico,
});

const MOODS = [Frown, Annoyed, Meh, Smile, Laugh];
const TIPO: Record<string, string> = { jornada: "Jornada", livre: "Livre", manual: "Manual" };
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const LEVEL = ["bg-muted/40", "bg-sage/20", "bg-sage/40", "bg-sage/65", "bg-sage"];

function Historico() {
  const { data: sessions = [] } = useQuery(allSessionsQuery);
  const { data: checks = [] } = useQuery(activeChecksQuery);
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);
  const days = useMemo(() => new Set(byDay.keys()), [byDay]);
  const st = streaks(days, today);
  const totalMin = sessions.reduce((s, x) => s + totalMinutes(x), 0);
  const prog = progressFromCount(checks.length);
  const est = journeyEstimate(checks.filter((c) => !c.is_legacy_credit).map((c) => c.created_at), today, checks.length);
  const period = favoritePeriod(sessions);

  const first = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const daySessions = selected ? sessions.filter((s) => dayKey(new Date(s.concluida_em)) === selected) : [];

  return (
    <TabShell>
      <div className="px-6 pt-10 animate-fade-slow">
        <h1 className="font-display text-4xl font-light">Histórico</h1>

        <div className="mt-8 flex items-center justify-between">
          <button aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-2 text-muted-foreground">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.4} />
          </button>
          <p className="text-sm capitalize tracking-wide">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          <button aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-2 text-muted-foreground">
            <ChevronRight className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground">
          {WEEK.map((w, i) => <span key={i}>{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const k = dayKey(new Date(month.getFullYear(), month.getMonth(), d));
            const lvl = heatLevel(byDay.get(k) ?? 0);
            return (
              <button
                key={i}
                onClick={() => setSelected(k === selected ? null : k)}
                className={cn("aspect-square rounded-md text-[11px] transition-colors", LEVEL[lvl], lvl >= 3 ? "text-background" : "text-foreground/70", selected === k && "ring-1 ring-sage", k === dayKey(today) && "font-semibold")}
              >
                {d}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-5 rounded-2xl border border-border p-4 animate-fade-slow">
            <p className="text-xs text-muted-foreground">
              {new Date(selected + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {daySessions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma prática neste dia.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {daySessions.map((s) => {
                  const M = s.humor ? MOODS[s.humor - 1] : null;
                  return (
                    <li key={s.id} className="py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="min-w-0 flex-1">{TIPO[s.tipo] ?? s.tipo} · {(s.extra_seconds ?? 0) > 0 ? `${s.planned_minutes} min + ${formatMinutes((s.extra_seconds ?? 0) / 60)} min extra` : `${formatMinutes(totalMinutes(s))} min`}</span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {M && <M className="h-4 w-4 text-sage" strokeWidth={1.4} />}
                          {new Date(s.concluida_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {s.nota && <p className="mt-1 text-xs italic text-muted-foreground">“{s.nota}”</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Card label="Sequência atual" value={`${st.current} ${st.current === 1 ? "dia" : "dias"}`} />
          <Card label="Maior sequência" value={`${st.longest} ${st.longest === 1 ? "dia" : "dias"}`} />
          <Card label="Tempo total" value={`${formatMinutes(totalMin)} min`} sub={`${(totalMin / 60).toFixed(1).replace(".", ",")} horas`} />
          <Card label="Sessões" value={String(sessions.length)} />
          <Card label="Jornada" value={`${prog.percent}%`} sub={`${prog.totalDone} de ${TOTAL_CHECKS} checks`} />
          <Card label="Dias por semana" value={avgDaysPerWeek(days, today).toFixed(1).replace(".", ",")} sub="em média" />
          <Card label="Período preferido" value={period ? period.charAt(0).toUpperCase() + period.slice(1) : "—"} />
          <Card
            label={`Fase ${prog.phase}`}
            value={prog.complete ? "Completa" : est ? est.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            sub={prog.complete ? "Você chegou aos 30 min" : est ? "estimativa para os 30 min" : "Pratique mais alguns dias para ver a estimativa"}
          />
        </div>
      </div>
    </TabShell>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-[11px] tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-light">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
