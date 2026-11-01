import type { Area, Met, Problem, Program, Session, Skill } from "../db/types";
import { AREAS } from "../db/types";
import { addDays, weekStart } from "./dates";

export interface Tally {
  hit: number;
  tried: number;
}

export const rate = (t: Tally): number | null => (t.tried > 0 ? t.hit / t.tried : null);

/** Tries are never fewer than hits. */
export const triedOf = (item: { hit: number; tried: number }) => Math.max(item.tried, item.hit);

export function tally(sessions: Session[], skillId?: number): Tally {
  const t = { hit: 0, tried: 0 };
  for (const s of sessions) {
    for (const it of s.items) {
      if (skillId !== undefined && it.skillId !== skillId) continue;
      t.hit += it.hit;
      t.tried += triedOf(it);
    }
  }
  return t;
}

export const inRange = (sessions: Session[], from: string, to: string) =>
  sessions.filter((s) => s.date >= from && s.date <= to);

/** Hit rate for each of the last `weeks` weeks (oldest first), null when nothing was tried. */
export function weeklyRates(sessions: Session[], today: string, weeks = 6, skillId?: number) {
  const thisWeek = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(thisWeek, -7 * (weeks - 1 - i));
    const to = addDays(from, 6);
    return { from, rate: rate(tally(inRange(sessions, from, to), skillId)) };
  });
}

export interface Improvement {
  skillId: number;
  before: number;
  now: number;
}

/**
 * The skill whose hit rate rose most: days 15–28 ago vs the last 14 days.
 * Needs at least 2 tries in both windows so one lucky rep doesn't count.
 */
export function mostImproved(sessions: Session[], today: string): Improvement | null {
  const early = inRange(sessions, addDays(today, -27), addDays(today, -14));
  const late = inRange(sessions, addDays(today, -13), today);
  const ids = new Set(sessions.flatMap((s) => s.items.map((i) => i.skillId)).filter((x): x is number => x != null));
  let best: Improvement | null = null;
  for (const id of ids) {
    const a = tally(early, id);
    const b = tally(late, id);
    if (a.tried < 2 || b.tried < 2) continue;
    const before = a.hit / a.tried;
    const now = b.hit / b.tried;
    if (now > before && (!best || now - before > best.now - best.before)) best = { skillId: id, before, now };
  }
  return best;
}

export function metCounts(sessions: Session[]): Record<Met, number> {
  const c = { yes: 0, partly: 0, no: 0 };
  for (const s of sessions) if (s.reflection) c[s.reflection.met]++;
  return c;
}

export function areaCounts(skills: Skill[]) {
  return AREAS.map((area: Area) => {
    const own = skills.filter((s) => s.area === area);
    return {
      area,
      total: own.filter((s) => s.status !== "pk").length,
      done: own.filter((s) => s.status === "dn").length,
      inProgress: own.filter((s) => s.status === "ip").length,
    };
  });
}

/** Open problems grouped by skill; weight = how often they came up (at least 1 each). */
export function problemHeat(problems: Problem[], skills: Skill[]) {
  const groups = new Map<number | "none", number>();
  for (const p of problems) {
    if (p.status !== "open") continue;
    const key = p.skillId ?? "none";
    groups.set(key, (groups.get(key) ?? 0) + Math.max(p.seen.length, 1));
  }
  return [...groups.entries()]
    .map(([key, weight]) => ({
      skillId: key === "none" ? undefined : key,
      label: key === "none" ? "General" : skills.find((s) => s.id === key)?.name ?? "Skill",
      weight,
    }))
    .sort((a, b) => b.weight - a.weight);
}

export interface ProgramPosition {
  index: number;
  week: number; // 1-based
  day: number; // 1-based
  total: number;
  finished: boolean;
}

export function programPosition(program: Program, index: number): ProgramPosition {
  const total = program.weeks.length * program.sessionsPerWeek;
  return {
    index,
    week: Math.min(Math.floor(index / program.sessionsPerWeek) + 1, program.weeks.length),
    day: (index % program.sessionsPerWeek) + 1,
    total,
    finished: index >= total,
  };
}

/** The index the next program session would take: one past the highest one used so far. */
export function nextProgramIndex(sessions: Session[], programId: number): number {
  let next = 0;
  for (const s of sessions) if (s.program?.programId === programId) next = Math.max(next, s.program.index + 1);
  return next;
}
