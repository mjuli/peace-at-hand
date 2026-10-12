import { describe, expect, it } from "vitest";
import { TOTAL_CHECKS, progressFromCount, nextCheck, nextDuration, checksBefore } from "./journey";

describe("jornada", () => {
  it("tem 462 checks no total", () => {
    expect(TOTAL_CHECKS).toBe(462);
  });
  it("começa na fase 3 com 0 checks", () => {
    expect(progressFromCount(0)).toMatchObject({ phase: 3, done: 0, complete: false });
    expect(nextCheck(0)).toEqual({ phase: 3, number: 1 });
  });
  it("avança para a fase 4 após 3 checks", () => {
    expect(progressFromCount(3)).toMatchObject({ phase: 4, done: 0 });
    expect(nextDuration(3)).toBe(4);
  });
  it("fase 7 começa após 3+4+5+6 = 18 checks", () => {
    expect(checksBefore(7)).toBe(18);
    expect(progressFromCount(21)).toMatchObject({ phase: 7, done: 3 });
  });
  it("completa a jornada e entra em manutenção com sessões de 30 min", () => {
    expect(progressFromCount(462)).toMatchObject({ complete: true, percent: 100 });
    expect(nextCheck(462)).toBeNull();
    expect(nextDuration(462)).toBe(30);
  });
  it("último check é o 30º da fase 30", () => {
    expect(nextCheck(461)).toEqual({ phase: 30, number: 30 });
  });
});
