import Dexie, { type EntityTable } from "dexie";
import type { GamePlan, Meta, Note, Problem, Program, Session, Skill } from "./types";
import { seed } from "./seed";

export class MatDB extends Dexie {
  skills!: EntityTable<Skill, "id">;
  sessions!: EntityTable<Session, "id">;
  notes!: EntityTable<Note, "id">;
  problems!: EntityTable<Problem, "id">;
  programs!: EntityTable<Program, "id">;
  gamePlans!: EntityTable<GamePlan, "id">;
  meta!: EntityTable<Meta, "key">;

  constructor(name = "mat-notes") {
    super(name);
    this.version(1).stores({
      skills: "++id, area, status",
      sessions: "++id, date",
      notes: "++id, kind, skillId, sessionId, date",
      problems: "++id, skillId, status",
      programs: "++id, active",
      gamePlans: "++id",
      meta: "key",
    });
    this.on("populate", (tx) => seed(tx));
  }
}

export const db = new MatDB();

/** Ask the browser not to clear our storage (matters most on iPhone). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
}
