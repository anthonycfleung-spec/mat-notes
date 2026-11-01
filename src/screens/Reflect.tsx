import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { IntentionItem, Met, NoteKind, Session, Skill } from "../db/types";
import { saveReflection, startSession, todaySession, uid } from "../lib/actions";
import { Back, toast } from "../components/ui";

interface NoteDraft {
  key: string;
  kind: NoteKind;
  text: string;
  skillId?: number;
}

const blank = (kind: NoteKind): NoteDraft => ({ key: uid(), kind, text: "" });

export default function Reflect() {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>();
  const [items, setItems] = useState<IntentionItem[]>([]);
  const [met, setMet] = useState<Met | null>(null);
  const [energy, setEnergy] = useState(3);
  const [focus, setFocus] = useState(3);
  const [notes, setNotes] = useState<NoteDraft[]>([blank("worked"), blank("didnt")]);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [newProblem, setNewProblem] = useState("");
  const [newProblemSkill, setNewProblemSkill] = useState<number | undefined>();
  const skills = useLiveQuery(() => db.skills.toArray(), []);
  const problems = useLiveQuery(() => db.problems.where("status").equals("open").toArray(), []);

  useEffect(() => {
    (async () => {
      const s = await todaySession();
      setSession(s ?? null);
      if (!s) return;
      setItems(s.items.map((i) => ({ ...i, tried: Math.max(i.tried, i.hit) })));
      if (s.reflection) {
        setMet(s.reflection.met);
        setEnergy(s.reflection.energy);
        setFocus(s.reflection.focus);
        const saved = await db.notes.where("sessionId").equals(s.id!).toArray();
        if (saved.length) setNotes(saved.map((n) => ({ key: uid(), kind: n.kind, text: n.text, skillId: n.skillId })));
        setSeen(new Set((await db.problems.toArray()).filter((p) => p.seen.includes(s.date)).map((p) => p.id!)));
      }
    })();
  }, []);

  if (session === undefined || !skills || !problems) return <main className="screen no-tabs" />;

  // Skills from today's intention come first when tagging notes.
  const todaySkillIds = new Set(items.map((i) => i.skillId).filter((x): x is number => x != null));
  const tagSkills = [...skills.filter((s) => todaySkillIds.has(s.id!)), ...skills.filter((s) => s.status === "ip" && !todaySkillIds.has(s.id!))];

  const setItem = (id: string, patch: Partial<IntentionItem>) =>
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      return { ...next, tried: Math.max(next.tried, next.hit) };
    }));
  const setNote = (key: string, patch: Partial<NoteDraft>) => setNotes(notes.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  const toggleSeen = (id: number) => {
    const next = new Set(seen);
    next.has(id) ? next.delete(id) : next.add(id);
    setSeen(next);
  };

  const save = async () => {
    if (!met) return;
    let s = session;
    if (!s) {
      const id = await startSession({ title: "", type: "Class", gi: true, items: [] });
      s = (await db.sessions.get(id))!;
    }
    await saveReflection(s, {
      items,
      reflection: { met, energy, focus },
      notes: notes.map(({ kind, text, skillId }) => ({ kind, text, skillId })),
      problemsSeen: [...seen],
      newProblem: newProblem.trim() ? { text: newProblem, skillId: newProblemSkill } : undefined,
    });
    toast("Session saved");
    nav("/");
  };

  const noteSection = (kind: NoteKind, title: string, color: string) => (
    <div className="field">
      <span style={{ color }}>{title}</span>
      {notes.filter((n) => n.kind === kind).map((n) => (
        <div key={n.key} className="card tight">
          <textarea className="textarea" style={{ minHeight: 72 }} value={n.text} placeholder={kind === "worked" ? "e.g. Matrix entry landed when I pinned the far knee" : "e.g. Got stacked out of the shotgun armbar"} aria-label={title} onChange={(e) => setNote(n.key, { text: e.target.value })} />
          <SkillTags skills={tagSkills} value={n.skillId} onChange={(skillId) => setNote(n.key, { skillId })} />
        </div>
      ))}
      <button className="btn ghost small" onClick={() => setNotes([...notes, blank(kind)])}>+ Another</button>
    </div>
  );

  return (
    <main className="screen no-tabs">
      <div className="top">
        <Back to="/" label="Today" />
      </div>
      <h1 className="page-title">Reflect</h1>
      {session?.title && <p className="muted" style={{ marginTop: -8 }}>{session.title}</p>}

      {items.length > 0 && (
        <div className="field">
          <span>How many did you try and hit?</span>
          {items.map((it) => (
            <div key={it.id} className="card tight" style={{ gap: 10 }}>
              <span className="section-title">{it.label}</span>
              <Counter label="Tried" value={it.tried} min={it.hit} onChange={(tried) => setItem(it.id, { tried })} />
              <Counter label="Hit" value={it.hit} min={0} onChange={(hit) => setItem(it.id, { hit })} accent />
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <span>Did you meet your intention?</span>
        <div className="choices">
          <button className="choice lime" aria-pressed={met === "yes"} onClick={() => setMet("yes")}>Yes</button>
          <button className="choice violet" aria-pressed={met === "partly"} onClick={() => setMet("partly")}>Partly</button>
          <button className="choice" aria-pressed={met === "no"} onClick={() => setMet("no")}>No</button>
        </div>
      </div>

      <Scale label="Energy" value={energy} onChange={setEnergy} low="Flat" high="Sharp" />
      <Scale label="Focus" value={focus} onChange={setFocus} low="Scattered" high="Locked in" />

      {noteSection("worked", "What worked", "var(--lime)")}
      {noteSection("didnt", "What didn't work", "var(--amber)")}

      <div className="field">
        <span>Problems that came up again</span>
        {problems.length === 0 && <p className="empty">No open problems.</p>}
        <div className="chips">
          {problems.map((p) => (
            <button key={p.id} className="chip" aria-pressed={seen.has(p.id!)} onClick={() => toggleSeen(p.id!)}>{p.text}</button>
          ))}
        </div>
        <input className="input" style={{ marginTop: 6 }} value={newProblem} placeholder="New problem (optional)" aria-label="New problem" onChange={(e) => setNewProblem(e.target.value)} />
        {newProblem.trim() && <SkillTags skills={tagSkills} value={newProblemSkill} onChange={setNewProblemSkill} />}
      </div>

      <button className="btn primary big" disabled={!met} onClick={save}>{met ? "Save reflection" : "Choose if you met your intention"}</button>
    </main>
  );
}

function Counter({ label, value, min, onChange, accent }: { label: string; value: number; min: number; onChange: (v: number) => void; accent?: boolean }) {
  return (
    <div className="row">
      <span className="grow muted" style={{ fontSize: 14 }}>{label}</span>
      <button className="icon-btn" aria-label={`${label} one less`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span style={{ fontWeight: 800, fontSize: 20, minWidth: 32, textAlign: "center", color: accent ? "var(--lime)" : undefined }} aria-live="polite">{value}</span>
      <button className="icon-btn" aria-label={`${label} one more`} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  // Colour steps from dim to lime so the rating reads at a glance.
  const tint = ["#3a3d46", "#5b6a2e", "#7f9a33", "#a4c63e", "#c8f04a"];
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choices" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            className="choice"
            role="radio"
            aria-checked={value === v}
            aria-label={`${label} ${v} of 5`}
            onClick={() => onChange(v)}
            style={{ background: v <= value ? tint[value - 1] : undefined, borderColor: v <= value ? tint[value - 1] : undefined, color: v <= value && value >= 4 ? "#0e0f12" : undefined, fontWeight: 800 }}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}><span className="label">{low}</span><span className="label">{high}</span></div>
    </div>
  );
}

function SkillTags({ skills, value, onChange }: { skills: Skill[]; value?: number; onChange: (id?: number) => void }) {
  return (
    <div className="scroll-x" aria-label="Tag a skill">
      <button className="chip" aria-pressed={value == null} onClick={() => onChange(undefined)}>General</button>
      {skills.map((s) => (
        <button key={s.id} className="chip" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>{s.name}</button>
      ))}
    </div>
  );
}
