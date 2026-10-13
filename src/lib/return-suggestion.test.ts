import { describe, expect, it } from "vitest";
import { previousPhase, shouldSuggestReturn } from "./return-suggestion";

const now = new Date("2026-10-20T12:00:00Z").getTime();

describe("sugestão de retorno", () => {
  it("aparece após 7 dias sem prática (padrão)", () => {
    expect(shouldSuggestReturn({ lastPracticeAt: "2026-10-13T11:00:00Z", dismissedAt: null, returnDays: 7, now })).toBe(true);
  });
  it("não aparece com 6 dias sem prática", () => {
    expect(shouldSuggestReturn({ lastPracticeAt: "2026-10-14T13:00:00Z", dismissedAt: null, returnDays: 7, now })).toBe(false);
  });
  it("some depois de dispensada", () => {
    expect(
      shouldSuggestReturn({ lastPracticeAt: "2026-10-01T00:00:00Z", dismissedAt: "2026-10-19T00:00:00Z", returnDays: 7, now }),
    ).toBe(false);
  });
  it("não aparece para quem nunca praticou", () => {
    expect(shouldSuggestReturn({ lastPracticeAt: null, dismissedAt: null, returnDays: 7, now })).toBe(false);
  });
  it("voltar uma fase não passa da fase 3", () => {
    expect(previousPhase(7)).toBe(6);
    expect(previousPhase(3)).toBe(3);
  });
});
