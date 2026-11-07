import { describe, expect, it } from "vitest";
import { heatLevel, streaks, favoritePeriod, journeyEstimate, minutesByDay, type SessionRow } from "./stats";
import { earnedCodes } from "./achievements";

const s = (iso: string, min = 5, nota: string | null = null): SessionRow => ({
  id: iso, tipo: "jornada", duracao_min: min, concluida_em: iso, fase: 3, check_numero: 1, humor: null, nota,
});

describe("stats", () => {
  it("heat levels", () => {
    expect([0, 5, 15, 25, 45].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });
  it("calendário usa o total com tempo extra", () => {
    const session = { ...s("2026-10-01T12:00:00", 5), planned_minutes: 5, extra_seconds: 600 };
    const minutes = minutesByDay([session]).get("2026-10-01") ?? 0;
    expect(minutes).toBe(15);
    expect(heatLevel(minutes)).toBe(2);
  });
  it("streak continues if today not practiced yet", () => {
    const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-01"]);
    expect(streaks(days, new Date(2026, 9, 15))).toEqual({ current: 3, longest: 3 });
    expect(streaks(days, new Date(2026, 9, 16)).current).toBe(0);
  });
  it("period", () => {
    expect(favoritePeriod([s(new Date(2026, 0, 1, 7).toISOString()), s(new Date(2026, 0, 2, 8).toISOString())])).toBe("manhã");
  });
  it("estimate needs 3 days", () => {
    const today = new Date(2026, 9, 15);
    expect(journeyEstimate([new Date(2026, 9, 14).toISOString()], today)).toBeNull();
  });
  it("estimativa usa 465 e créditos reduzem restante sem aumentar frequência", () => {
    const today = new Date(2026, 9, 15);
    const dates = [12, 13, 14].map((day) => new Date(2026, 9, day).toISOString());
    const expected = new Date(2026, 9, 15 + 4590);
    expect(journeyEstimate(dates, today, 6)).toEqual(expected);
    expect(journeyEstimate(dates, today, 465)).toBeNull();
    expect(journeyEstimate([], today, 3)).toBeNull();
  });
});

describe("achievements", () => {
  it("conquistas por horas incluem o tempo extra", () => {
    const session = { ...s("2026-10-01T12:00:00", 5), planned_minutes: 5, extra_seconds: 3300 };
    expect(earnedCodes([session], []).has("horas_1")).toBe(true);
    expect(earnedCodes([{ ...session, extra_seconds: 3299 }], []).has("horas_1")).toBe(false);
  });
  it("first session, note, phase", () => {
    const c = earnedCodes([s("2026-10-01T10:00:00Z", 5, "oi")], [{ fase: 3, check_numero: 3 }]);
    expect(c.has("primeira_sessao")).toBe(true);
    expect(c.has("primeira_nota")).toBe(true);
    expect(c.has("primeira_fase")).toBe(true);
    expect(c.has("metade")).toBe(false);
  });
  it("metade exige 233 checks", () => {
    // checksBefore(22) = 231 → fase 22 check 2 = 233
    expect(earnedCodes([], [{ fase: 22, check_numero: 2 }]).has("metade")).toBe(true);
    expect(earnedCodes([], [{ fase: 22, check_numero: 1 }]).has("metade")).toBe(false);
  });
  it("créditos não criam conquistas de prática nem métricas de sessões", () => {
    const credits = [{ fase: 1, check_numero: 1, is_legacy_credit: true }, { fase: 2, check_numero: 1, is_legacy_credit: true }, { fase: 2, check_numero: 2, is_legacy_credit: true }];
    expect([...earnedCodes([], credits)]).toEqual([]);
    expect(minutesByDay([]).size).toBe(0);
    expect(streaks(new Set(), new Date(2026, 9, 15))).toEqual({ current: 0, longest: 0 });
  });
});
