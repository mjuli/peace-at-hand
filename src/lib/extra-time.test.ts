import { describe, expect, it } from "vitest";
import { addedExtra, elapsedExtra, totalMinutes } from "./extra-time";

describe("tempo extra", () => {
  it("ignora menos de um minuto", () => expect(addedExtra(59)).toBe(0));
  it("adiciona por padrão a partir de um minuto", () => expect(addedExtra(60)).toBe(60));
  it("permite não adicionar", () => expect(addedExtra(240, false)).toBe(0));
  it("limita a 60 minutos", () => expect(elapsedExtra(1000, 4_001_000)).toBe(3600));
  it("cinco minutos mais quatro extras totalizam nove", () => expect(totalMinutes({ duracao_min: 5, planned_minutes: 5, extra_seconds: 240 })).toBe(9));
  it("preserva sessões antigas", () => expect(totalMinutes({ duracao_min: 7, planned_minutes: null, extra_seconds: 0 })).toBe(7));
  it("preserva segundos adicionados no total", () => expect(totalMinutes({ duracao_min: 5, planned_minutes: 5, extra_seconds: 90 })).toBe(6.5));
});