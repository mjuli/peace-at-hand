import { describe, expect, it } from "vitest";
import { PHASES, TOTAL_CHECKS, progressFromCount, nextCheck, nextDuration, checksBefore } from "./journey";

describe("jornada", () => {
  it("tem 465 checks e 30 fases", () => {
    expect(TOTAL_CHECKS).toBe(465);
    expect(PHASES).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
  it("começa e reinicia na fase 1 com 0 checks", () => {
    expect(progressFromCount(0)).toMatchObject({ phase: 1, done: 0, complete: false });
    expect(nextCheck(0)).toEqual({ phase: 1, number: 1 });
  });
  it("avança após um check de 1 min e dois checks de 2 min", () => {
    expect(progressFromCount(1)).toMatchObject({ phase: 2, done: 0 });
    expect(nextDuration(1)).toBe(2);
    expect(progressFromCount(3)).toMatchObject({ phase: 3, done: 0 });
  });
  it("créditos das fases 1 e 2 preservam fase 7 check 3", () => {
    expect(checksBefore(7)).toBe(21);
    expect(progressFromCount(21 + 3)).toMatchObject({ phase: 7, done: 3 });
  });
  it("completa a jornada e entra em manutenção com sessões de 30 min", () => {
    expect(progressFromCount(465)).toMatchObject({ complete: true, percent: 100 });
    expect(nextCheck(465)).toBeNull();
    expect(nextDuration(465)).toBe(30);
  });
  it("último check é o 30º da fase 30", () => {
    expect(nextCheck(464)).toEqual({ phase: 30, number: 30 });
  });
  it("porcentagem usa 465 checks", () => {
    expect(progressFromCount(233).percent).toBe(50);
    expect(progressFromCount(462).complete).toBe(false);
  });
});
