import { describe, expect, it } from "vitest";
import { heatLevel, streaks, favoritePeriod, journeyEstimate, type SessionRow } from "./stats";
import { earnedCodes } from "./achievements";

const s = (iso: string, min = 5, nota: string | null = null): SessionRow => ({
  id: iso, tipo: "jornada", duracao_min: min, concluida_em: iso, fase: 3, check_numero: 1, humor: null, nota,
});

describe("stats", () => {
  it("heat levels", () => {
    expect([0, 5, 15, 25, 45].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
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
});

describe("achievements", () => {
  it("first session, note, phase", () => {
    const c = earnedCodes([s("2026-10-01T10:00:00Z", 5, "oi")], [{ fase: 3, check_numero: 3 }]);
    expect(c.has("primeira_sessao")).toBe(true);
    expect(c.has("primeira_nota")).toBe(true);
    expect(c.has("primeira_fase")).toBe(true);
    expect(c.has("metade")).toBe(false);
  });
  it("half journey at check 231", () => {
    // checksBefore(21) = 228 → fase 21 check 3 = 231
    expect(earnedCodes([], [{ fase: 21, check_numero: 3 }]).has("metade")).toBe(true);
    expect(earnedCodes([], [{ fase: 21, check_numero: 2 }]).has("metade")).toBe(false);
  });
});
