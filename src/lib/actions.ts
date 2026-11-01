import { db } from "../db/db";
import type { IntentionItem, Note, Reflection, Session, Skill, Status } from "../db/types";
import { todayISO } from "./dates";
import { nextProgramIndex, programPosition } from "./stats";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const newItem = (label: string, skillId?: number, target = 1): IntentionItem => ({
  id: uid(),
  label,
  skillId,
  target,
  hit: 0,
  tried: 0,
});

/** Items queued from Progress ("Add to next intention") before today's session exists. */
const PENDING_KEY = "pendingItems";

export async function pendingItems(): Promise<IntentionItem[]> {
  const row = await db.meta.get(PENDING_KEY);
  return row ? JSON.parse(row.value) : [];
}

export async function todaySession(): Promise<Session | undefined> {
  const list = await db.sessions.where("date").equals(todayISO()).toArray();
  return list.at(-1);
}

export async function lastSessionBefore(date: string): Promise<Session | undefined> {
  return db.sessions.where("date").below(date).last();
}

/** Starts today's session, linked to the next day of the active program. */
export async function startSession(fields: Pick<Session, "title" | "items" | "type" | "gi">): Promise<number> {
  return db.transaction("rw", db.sessions, db.programs, db.meta, async () => {
    const program = (await db.programs.toArray()).find((p) => p.active);
    let ref: Session["program"];
    if (program?.id != null) {
      const index = nextProgramIndex(await db.sessions.toArray(), program.id);
      if (!programPosition(program, index).finished) ref = { programId: program.id, index };
    }
    await db.meta.delete(PENDING_KEY);
    return (await db.sessions.add({ date: todayISO(), ...fields, program: ref })) as number;
  });
}

export async function addToNextIntention(label: string, skillId?: number) {
  const today = await todaySession();
  if (today && !today.reflection) {
    await db.sessions.update(today.id!, { items: [...today.items, newItem(label, skillId)] });
    return "today";
  }
  const items = [...(await pendingItems()), newItem(label, skillId)];
  await db.meta.put({ key: PENDING_KEY, value: JSON.stringify(items) });
  return "next";
}

export async function bumpHit(session: Session, itemId: string, delta: number) {
  const items = session.items.map((it) => {
    if (it.id !== itemId) return it;
    const hit = Math.max(0, it.hit + delta);
    return { ...it, hit, tried: Math.max(it.tried, hit) };
  });
  await db.sessions.update(session.id!, { items });
}

export interface ReflectInput {
  items: IntentionItem[];
  reflection: Omit<Reflection, "doneAt">;
  notes: Omit<Note, "id" | "sessionId" | "date">[];
  problemsSeen: number[];
  newProblem?: { text: string; skillId?: number };
}

export async function saveReflection(session: Session, input: ReflectInput) {
  const date = session.date;
  await db.transaction("rw", db.sessions, db.notes, db.problems, async () => {
    await db.sessions.update(session.id!, {
      items: input.items,
      reflection: { ...input.reflection, doneAt: new Date().toISOString() },
    });
    // Re-saving a reflection replaces that session's notes rather than duplicating them.
    await db.notes.where("sessionId").equals(session.id!).delete();
    await db.notes.bulkAdd(input.notes.filter((n) => n.text.trim()).map((n) => ({ ...n, text: n.text.trim(), sessionId: session.id, date })));
    for (const id of input.problemsSeen) {
      const p = await db.problems.get(id);
      if (p && !p.seen.includes(date)) await db.problems.update(id, { seen: [...p.seen, date], status: "open" });
    }
    if (input.newProblem?.text.trim()) {
      await db.problems.add({
        text: input.newProblem.text.trim(),
        skillId: input.newProblem.skillId,
        seen: [date],
        status: "open",
        createdAt: todayISO(),
      });
    }
  });
}

export async function setSkillStatus(skill: Skill, status: Status) {
  if (skill.status === status) return;
  await db.skills.update(skill.id!, { status, statusChangedAt: todayISO() });
}
