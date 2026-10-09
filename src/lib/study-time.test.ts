import { describe, expect, it } from "vitest";
import { isSessionDone, sessionSeconds, splitSeconds, localDayEnd } from "./study-time";

const s = (ps: string, pe: string, as?: string, ae?: string) => ({
  planned_start: ps,
  planned_end: pe,
  actual_start: as ?? null,
  actual_end: ae ?? null,
});

describe("study-time", () => {
  it("räknar inte pass vars sluttid inte passerat", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    expect(isSessionDone(s("2026-10-09T11:00:00Z", "2026-10-09T13:00:00Z"), now)).toBe(false);
    expect(isSessionDone(s("2026-10-09T10:00:00Z", "2026-10-09T11:00:00Z"), now)).toBe(true);
  });
  it("använder faktisk tid före planerad", () => {
    expect(
      sessionSeconds(s("2026-10-09T10:00:00Z", "2026-10-09T12:00:00Z", "2026-10-09T10:30:00Z", "2026-10-09T11:00:00Z")),
    ).toBe(1800);
  });
  it("delar tid mellan uppgifter utan att tappa sekunder", () => {
    expect(splitSeconds(3601, 3)).toEqual([1201, 1200, 1200]);
  });
  it("terminens sista dag räknas med", () => {
    expect(localDayEnd("2026-01-18").getDate()).toBe(18);
    expect(localDayEnd("2026-01-18").getHours()).toBe(23);
  });
});
