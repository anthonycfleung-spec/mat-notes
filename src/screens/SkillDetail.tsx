import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { NoteKind, Skill } from "../db/types";
import { AREAS, STATUS_LABEL, STATUS_ORDER } from "../db/types";
import { formatShort, todayISO } from "../lib/dates";
import { addToNextIntention, setMainFocus, setSkillStatus } from "../lib/actions";
import { rate, tally, weeklyRates } from "../lib/stats";
import { AREA_COLOR, Back, Glyph, Icon, Ring, Sheet, Sparkline, toast } from "../components/ui";

export default function SkillDetail() {
  const id = Number(useParams().id);
  const skill = useLiveQuery(() => db.skills.get(id), [id]);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const notes = useLiveQuery(() => db.notes.where("skillId").equals(id).reverse().sortBy("date"), [id]);
  const problems = useLiveQuery(() => db.problems.where("skillId").equals(id).toArray(), [id]);
  const [noteKind, setNoteKind] = useState<NoteKind | null>(null);

  if (skill === null) return <main className="screen"><Back to="/skills" label="Skills" /><p className="empty">That skill was deleted.</p></main>;
  if (!skill || !sessions || !notes || !problems) return <main className="screen" />;

  const t = tally(sessions, id);
  const r = rate(t);
  const trend = weeklyRates(sessions, todayISO(), 6, id).map((w) => w.rate);

  return (
    <main className="screen">
      <div className="top"><Back to="/skills" label="Skills" /></div>

      <div className="row">
        <Glyph area={skill.area} status={skill.status} size={52} />
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="label" style={{ color: AREA_COLOR[skill.area].fg }}>{skill.area}</span>
          <NameField skill={skill} />
        </div>
      </div>

      <div className="field">
        <span>Status</span>
        <div className="choices" style={{ gridAutoFlow: "row", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={`choice ${s === "ip" ? "lime" : s === "dn" ? "violet" : ""}`}
              aria-pressed={skill.status === s}
              onClick={() => { setSkillStatus(skill, s); if (s === "dn") toast(`${skill.name} · Done`); }}
            >
              {s === "dn" && Icon.check()}{s === "pk" && Icon.pause()}{STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {skill.status === "pk" && (
          <input className="input" defaultValue={skill.parkedReason ?? ""} placeholder="Why it's parked (optional)" aria-label="Why it's parked" onBlur={(e) => db.skills.update(id, { parkedReason: e.target.value.trim() || undefined })} />
        )}
      </div>

      <div className="card" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {r != null ? (
          <>
            <Ring value={r} size={72} thickness={7} inner="var(--surface)" label={`${t.hit} hits from ${t.tried} tries`}>
              <span style={{ fontSize: 15 }}>{Math.round(r * 100)}%</span>
            </Ring>
            <div className="grow stack" style={{ gap: 4 }}>
              <span className="label">Hit rate · {t.hit} of {t.tried} tries</span>
              <Sparkline values={trend} height={44} fill={false} label="Hit rate over the last 6 weeks" />
            </div>
          </>
        ) : (
          <p className="empty">No tries logged yet. Add it to an intention to start tracking hits.</p>
        )}
      </div>
      {(skill.status === "ip" || skill.status === "ns") && (
        <button className="btn" aria-pressed={!!skill.pinned} style={skill.pinned ? { color: "var(--lime)", borderColor: "#3a4a14" } : undefined} onClick={() => { setMainFocus(skill, !skill.pinned); toast(skill.pinned ? "Main focus picked automatically" : `Main focus · ${skill.name}`); }}>
          {skill.pinned ? <>{Icon.check("var(--lime)")} Main focus for {skill.area}</> : `Make main focus for ${skill.area}`}
        </button>
      )}
      <button className="btn" onClick={async () => { const w = await addToNextIntention(skill.name, id); toast(w === "today" ? "Added to today" : "Added to your next intention"); }}>
        + Work on this next session
      </button>

      <NoteList title="What's working" color="var(--lime)" notes={notes.filter((n) => n.kind === "worked")} onAdd={() => setNoteKind("worked")} />
      <NoteList title="What's not working" color="var(--amber)" notes={notes.filter((n) => n.kind === "didnt")} onAdd={() => setNoteKind("didnt")} />

      <section className="stack">
        <h2 className="section-title">Problems</h2>
        {problems.length === 0 && <p className="empty">None linked. Add them when you reflect.</p>}
        {problems.map((p) => (
          <div key={p.id} className="note-row" style={{ alignItems: "center" }}>
            <p style={{ textDecoration: p.status === "solved" ? "line-through" : undefined, color: p.status === "solved" ? "var(--faint)" : undefined }}>
              {p.text}
              {p.seen.length > 0 && <span className="label"> · {p.seen.length}× · last {formatShort(p.seen[p.seen.length - 1])}</span>}
            </p>
            <button className="btn small ghost" onClick={() => db.problems.update(p.id!, { status: p.status === "open" ? "solved" : "open" })}>
              {p.status === "open" ? "Mark solved" : "Reopen"}
            </button>
          </div>
        ))}
      </section>

      <label className="field">
        <span>Notes</span>
        <textarea className="textarea" defaultValue={skill.notes} placeholder="Details, cues, links to instructionals…" onBlur={(e) => db.skills.update(id, { notes: e.target.value })} />
      </label>

      <SkillSettings skill={skill} />

      <AddNote skillId={id} kind={noteKind} onClose={() => setNoteKind(null)} />
    </main>
  );
}

function NameField({ skill }: { skill: Skill }) {
  const [name, setName] = useState(skill.name);
  useEffect(() => setName(skill.name), [skill.name]);
  return (
    <input
      className="input"
      value={name}
      aria-label="Skill name"
      style={{ fontSize: 22, fontWeight: 800, padding: "4px 0", border: 0, background: "transparent", minHeight: 0 }}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => name.trim() && name !== skill.name && db.skills.update(skill.id!, { name: name.trim() })}
    />
  );
}

function NoteList({ title, color, notes, onAdd }: { title: string; color: string; notes: { id?: number; text: string; date: string }[]; onAdd: () => void }) {
  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="section-title" style={{ color }}>{title}</h2>
        <button className="btn small ghost" onClick={onAdd}>+ Add</button>
      </div>
      {notes.length === 0 && <p className="empty">Nothing yet.</p>}
      {notes.map((n) => (
        <div key={n.id} className="note-row">
          <span className="kind-mark" style={{ background: color }} />
          <p>{n.text}</p>
          <span className="date">{formatShort(n.date)}</span>
        </div>
      ))}
    </section>
  );
}

function AddNote({ skillId, kind, onClose }: { skillId: number; kind: NoteKind | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const save = async () => {
    if (!kind || !text.trim()) return;
    await db.notes.add({ kind, skillId, text: text.trim(), date: todayISO() });
    setText("");
    onClose();
  };
  return (
    <Sheet open={kind != null} onClose={onClose} label="Add note">
      <h2 className="page-title" style={{ fontSize: 26 }}>{kind === "worked" ? "What's working" : "What's not working"}</h2>
      <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Note" />
      <button className="btn primary big" disabled={!text.trim()} onClick={save}>Save note</button>
    </Sheet>
  );
}

function SkillSettings({ skill }: { skill: Skill }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const remove = async () => {
    await db.transaction("rw", db.skills, db.notes, db.problems, async () => {
      await db.skills.delete(skill.id!);
      await db.notes.where("skillId").equals(skill.id!).modify({ skillId: undefined });
      await db.problems.where("skillId").equals(skill.id!).modify({ skillId: undefined });
    });
    nav("/skills");
  };
  return (
    <section className="stack" style={{ marginTop: 8 }}>
      <div className="field">
        <span>Area</span>
        <div className="choices">
          {AREAS.map((a) => (
            <button key={a} className="choice" aria-pressed={skill.area === a} onClick={() => db.skills.update(skill.id!, { area: a })}>{a}</button>
          ))}
        </div>
      </div>
      {confirm ? (
        <div className="row">
          <span className="grow muted" style={{ fontSize: 14 }}>Delete “{skill.name}”? Its notes and problems are kept.</span>
          <button className="btn small" onClick={() => setConfirm(false)}>Keep</button>
          <button className="btn small danger" onClick={remove}>Delete</button>
        </div>
      ) : (
        <button className="btn danger" onClick={() => setConfirm(true)}>Delete skill</button>
      )}
    </section>
  );
}
