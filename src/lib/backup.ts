import { db } from "../db/db";
import { todayISO } from "./dates";

const TABLES = ["skills", "sessions", "notes", "problems", "programs", "gamePlans", "meta"] as const;
export const LAST_BACKUP_KEY = "lastBackup";

export async function exportData(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const file = { app: "mat-notes", version: 1, exportedAt: new Date().toISOString(), data };
  await db.meta.put({ key: LAST_BACKUP_KEY, value: todayISO() });
  return new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
}

/** Saves the backup through the share sheet on phones (Files, iCloud Drive…), or as a download. */
export async function saveBackup() {
  const blob = await exportData();
  const name = `mat-notes-${todayISO()}.json`;
  const file = new File([blob], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replaces everything on this phone with the backup's contents. */
export async function importData(text: string) {
  const file = JSON.parse(text);
  if (file?.app !== "mat-notes" || typeof file.data !== "object") throw new Error("This isn't a Mat Notes backup file.");
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = file.data[t];
      if (Array.isArray(rows)) await db.table(t).bulkAdd(rows);
    }
  });
}
