import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { IntentionItem, Session } from "../db/types";
import { newItem, pendingItems, sessionBefore, sessionFromQuery, startSession } from "../lib/actions";
import { formatDay, todayISO } from "../lib/dates";
import { AREA_COLOR, Back, Icon, toast } from "../components/ui";

const TYPES = ["Class", "Open mat", "Drilling", "Private", "Comp"];

type Draft = Pick<Session, "title" | "type" | "gi" | "items">;

export default function IntentionEditor() {
  const nav = useNavigate();
  const { search } = useLocation();
  const [existing, setExisting] = useState<Session | undefined>();
  const [last, setLast] = useState<Session | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const skills = useLiveQuery(() => db.skills.where("status").equals("ip").toArray(), []);
  const lastDidnt = useLiveQuery(
    async () => (last?.id != null ? db.notes.where("sessionId").equals(last.id).filter((n) => n.kind === "didnt").toArray() : []),
    [last?.id],
  );

  useEffect(() => {
    (async () => {
      const s = await sessionFromQuery(search);
      const prev = await sessionBefore(s);
      setExisting(s);
      setLast(prev);
      setDraft(
        s
          ? { title: s.title, type: s.type, gi: s.gi, items: s.items }
          : { title: "", type: prev?.type ?? "Class", gi: prev?.gi ?? true, items: await pendingItems() },
      );
    })();
  }, [search]);

  if (!draft) return <main className="screen no-tabs" />;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setItem = (id: string, patch: Partial<IntentionItem>) =>
    set({ items: draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const has = (label: string) => draft.items.some((i) => i.label === label);
  const add = (label: string, skillId?: number) => !has(label) && set({ items: [...draft.items, newItem(label, skillId)] });

  const copyLast = () => {
    if (!last) return;
    set({ title: last.title, type: last.type, gi: last.gi, items: last.items.map((i) => newItem(i.label, i.skillId, i.target)) });
    toast("Copied last session");
  };

  const save = async () => {
    const clean = { ...draft, title: draft.title.trim(), items: draft.items.filter((i) => i.label.trim()) };
    if (existing?.id != null) await db.sessions.update(existing.id, clean);
    else await startSession(clean);
    nav("/");
  };

  return (
    <main className="screen no-tabs">
      <div className="top">
        <Back to="/" label="Today" />
        <button className="btn primary small" onClick={save}>Save</button>
      </div>
      <h1 className="page-title">{existing ? "Edit intention" : "Set intention"}</h1>
      {existing && existing.date !== todayISO() && <p className="muted" style={{ marginTop: -8 }}>{formatDay(existing.date)}</p>}

      <label className="field">
        <span>Focus</span>
        <input className="input" value={draft.title} placeholder="e.g. K-Guard" onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="field">
        <span>Session</span>
        <div className="scroll-x">
          {TYPES.map((t) => (
            <button key={t} className="chip" aria-pressed={draft.type === t} onClick={() => set({ type: t })}>{t}</button>
          ))}
        </div>
        <div className="choices" style={{ marginTop: 4 }}>
          <button className="choice" aria-pressed={draft.gi} onClick={() => set({ gi: true })}>Gi</button>
          <button className="choice" aria-pressed={!draft.gi} onClick={() => set({ gi: false })}>No-gi</button>
        </div>
      </div>

      <div className="field">
        <span>What I'll work on · times to hit</span>
        {draft.items.length === 0 && <p className="empty">Nothing yet. Add from your skills below.</p>}
        {draft.items.map((it) => (
          <div key={it.id} className="card tight" style={{ gap: 10 }}>
            <input className="input" value={it.label} aria-label="Item" onChange={(e) => setItem(it.id, { label: e.target.value })} />
            <div className="row">
              <span className="label grow">Times to hit</span>
              <button className="icon-btn" aria-label="Fewer" onClick={() => setItem(it.id, { target: Math.max(1, it.target - 1) })}>−</button>
              <span style={{ fontWeight: 800, fontSize: 18, minWidth: 32, textAlign: "center" }}>×{it.target}</span>
              <button className="icon-btn" aria-label="More" onClick={() => setItem(it.id, { target: it.target + 1 })}>+</button>
              <button className="icon-btn plain" aria-label={`Remove ${it.label}`} onClick={() => set({ items: draft.items.filter((i) => i.id !== it.id) })}>{Icon.x()}</button>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => set({ items: [...draft.items, newItem("")] })}>+ Add your own</button>
      </div>

      {lastDidnt && lastDidnt.length > 0 && (
        <div className="field">
          <span style={{ color: "var(--amber)" }}>Fix what didn't work last session</span>
          <div className="chips">
            {lastDidnt.map((n) => (
              <button key={n.id} className="chip" aria-pressed={has(n.text)} onClick={() => add(n.text, n.skillId)} style={{ borderColor: "#4a3524" }}>
                {has(n.text) ? Icon.check() : "+"} {n.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {skills && skills.length > 0 && (
        <div className="field">
          <span>Add from skills in progress</span>
          <div className="chips">
            {skills.map((s) => (
              <button key={s.id} className="chip" aria-pressed={has(s.name)} onClick={() => add(s.name, s.id)}>
                <span className="dot" style={{ background: AREA_COLOR[s.area].fg }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {last && <button className="btn ghost" onClick={copyLast}>Start from last session</button>}
    </main>
  );
}
