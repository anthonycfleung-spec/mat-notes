import { describe, expect, it } from "vitest";
import type { Program, Session } from "../db/types";
import { addDays, weekStart } from "./dates";
import { mostImproved, nextProgramIndex, problemHeat, programPosition, tally, weeklyRates } from "./stats";

const session = (date: string, items: [number | undefined, number, number][], extra: Partial<Session> = {}): Session => ({
  date,
  type: "Class",
  gi: true,
  title: "",
  items: items.map(([skillId, hit, tried], i) => ({ id: `${date}-${i}`, label: "x", skillId, target: 1, hit, tried })),
  ...extra,
});

describe("dates", () => {
  it("finds Monday of the week, including on Sunday", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Monday
  });
  it("adds days across months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("tally", () => {
  it("never counts fewer tries than hits", () => {
    expect(tally([session("2026-11-01", [[1, 3, 0]])])).toEqual({ hit: 3, tried: 3 });
  });
  it("filters by skill", () => {
    const s = [session("2026-11-01", [[1, 1, 2], [2, 4, 4]])];
    expect(tally(s, 1)).toEqual({ hit: 1, tried: 2 });
  });
});

describe("weeklyRates", () => {
  it("returns oldest-first weeks with null for empty weeks", () => {
    const rates = weeklyRates([session("2026-10-30", [[1, 1, 4]])], "2026-11-01", 3);
    expect(rates.map((r) => r.from)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(rates.map((r) => r.rate)).toEqual([null, null, 0.25]);
  });
});

describe("mostImproved", () => {
  const today = "2026-11-01";
  it("picks the biggest rise with enough tries in both windows", () => {
    const sessions = [
      session("2026-10-08", [[1, 1, 5], [2, 2, 4]]),
      session("2026-10-28", [[1, 4, 5], [2, 2, 4]]),
      session("2026-10-29", [[3, 5, 5]]), // no earlier data
    ];
    expect(mostImproved(sessions, today)).toEqual({ skillId: 1, before: 0.2, now: 0.8 });
  });
  it("returns null when nothing improved", () => {
    expect(mostImproved([session("2026-10-08", [[1, 2, 2]]), session("2026-10-28", [[1, 1, 2]])], today)).toBeNull();
  });
});

describe("programs", () => {
  const program: Program = {
    name: "p", goal: "", startDate: "2026-10-01", sessionsPerWeek: 5, weeks: ["a", "b", "c", "d"], rounds: [], active: true,
  };
  it("maps a session index to week and day", () => {
    expect(programPosition(program, 0)).toMatchObject({ week: 1, day: 1, finished: false });
    expect(programPosition(program, 7)).toMatchObject({ week: 2, day: 3 });
    expect(programPosition(program, 20)).toMatchObject({ finished: true, total: 20 });
  });
  it("continues after the highest used index", () => {
    const s = [session("2026-10-01", [], { program: { programId: 1, index: 0 } }), session("2026-10-02", [], { program: { programId: 1, index: 1 } }), session("2026-10-03", [], { program: { programId: 2, index: 5 } })];
    expect(nextProgramIndex(s, 1)).toBe(2);
    expect(nextProgramIndex(s, 3)).toBe(0);
  });
});

describe("problemHeat", () => {
  it("groups open problems by skill, weighted by times seen", () => {
    const heat = problemHeat(
      [
        { text: "a", skillId: 1, seen: ["x", "y"], status: "open", createdAt: "" },
        { text: "b", skillId: 1, seen: [], status: "open", createdAt: "" },
        { text: "c", seen: [], status: "open", createdAt: "" },
        { text: "d", skillId: 2, seen: ["x"], status: "solved", createdAt: "" },
      ],
      [{ id: 1, area: "Top", name: "Turtle", status: "ip", notes: "", createdAt: "" }],
    );
    expect(heat).toEqual([
      { skillId: 1, label: "Turtle", weight: 3 },
      { skillId: undefined, label: "General", weight: 1 },
    ]);
  });
});
