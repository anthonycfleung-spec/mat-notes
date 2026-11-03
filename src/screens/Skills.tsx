import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Area, Session, Skill, Status } from "../db/types";
import { AREAS, STATUS_LABEL } from "../db/types";
import { addDays, todayISO } from "../lib/dates";
import { setMainFocus } from "../lib/actions";
import { rate, tally, weeklyRates } from "../lib/stats";
import { AREA_COLOR, Glyph, Ring, Sheet, Sparkline, StatusTrack, toast } from "../components/ui";

const GROUPS: Status[] = ["ip", "ns", "pk", "dn"];
const AREA_KEY = "skills.area";

export default function Skills() {
  const [area, setAreaState] = useState<Area>(() => {
    try { return (localStorage.getItem(AREA_KEY) as Area) || "Bottom"; } catch { return "Bottom"; }
  });
  const setArea = (a: Area) => {
    setAreaState(a);
    try { localStorage.setItem(AREA_KEY, a); } catch { /* private mode */ }
  };
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const skills = useLiveQuery(() => db.skills.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const problems = useLiveQuery(() => db.problems.where("status").equals("open").toArray(), []);
  if (!skills || !sessions || !problems) return <main className="screen" />;

  const own = skills.filter((s) => s.area === area);
  const focus = mainFocus(own, sessions);
  const problemCount = (id?: number) => problems.filter((p) => p.skillId === id).length;

  return (
    <main className="screen">
      <div className="top" style={{ alignItems: "flex-end", minHeight: 56 }}>
        <h1 className="page-title">Skills</h1>
        <button className="icon-btn lime" aria-label="Add skill" onClick={() => setAdding(true)}>+</button>
      </div>

      <div className="scroll-x">
        {AREAS.map((a) => (
          <button key={a} className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>
            <span className="dot" style={{ background: AREA_COLOR[a].fg }} />
            {a} {skills.filter((s) => s.area === a).length}
          </button>
        ))}
      </div>

      {focus ? (
        <FocusCard skill={focus} sessions={sessions} onChange={() => setPicking(true)} />
      ) : own.length > 0 && (
        <button className="btn" onClick={() => setPicking(true)}>Choose a main focus</button>
      )}

      {GROUPS.map((status) => {
        const list = own.filter((s) => s.status === status && s.id !== focus?.id);
        if (!list.length) return null;
        return (
          <section key={status} className="stack">
            <div className="group-head">
              <h2 className="section-title">{STATUS_LABEL[status]}</h2>
              <span className="label">{list.length}</span>
            </div>
            {list.map((s) => {
              const n = problemCount(s.id);
              const r = rate(tally(sessions, s.id));
              return (
                <Link key={s.id} to={`/skills/${s.id}`} className={`skill-row ${s.status === "pk" ? "parked" : ""}`}>
                  <Glyph area={s.area} status={s.status} />
                  <div className="grow stack" style={{ gap: 6 }}>
                    <span className="name">{s.name}</span>
                    {s.status === "pk" ? (
                      s.parkedReason && <span className="label">{s.parkedReason}</span>
                    ) : (
                      <StatusTrack status={s.status} />
                    )}
                  </div>
                  {n > 0 && <span className="badge">{n} problem{n > 1 ? "s" : ""}</span>}
                  {n === 0 && r != null && s.status === "ip" && <span className="label" style={{ fontWeight: 700 }}>{Math.round(r * 100)}%</span>}
                </Link>
              );
            })}
          </section>
        );
      })}
      {own.length === 0 && <p className="empty">No {area.toLowerCase()} skills yet. Tap + to add one.</p>}

      <AddSkill open={adding} area={area} onClose={() => setAdding(false)} />
      <PickFocus open={picking} area={area} skills={own} current={focus} onClose={() => setPicking(false)} />
    </main>
  );
}

/** The skill you picked; otherwise the in-progress skill you've tried most in the last 4 weeks. */
function mainFocus(skills: Skill[], sessions: Session[]): Skill | undefined {
  const pinned = skills.find((s) => s.pinned && (s.status === "ip" || s.status === "ns"));
  if (pinned) return pinned;
  const ip = skills.filter((s) => s.status === "ip");
  const since = addDays(todayISO(), -27);
  const recent = sessions.filter((s) => s.date >= since);
  let best: Skill | undefined;
  let most = 0;
  for (const s of ip) {
    const t = tally(recent, s.id).tried;
    if (t > most) { most = t; best = s; }
  }
  return best ?? ip[0];
}

function FocusCard({ skill, sessions, onChange }: { skill: Skill; sessions: Session[]; onChange: () => void }) {
  const t = tally(sessions, skill.id);
  const r = rate(t);
  const trend = weeklyRates(sessions, todayISO(), 6, skill.id).map((w) => w.rate);
  return (
    <div className="focus-card">
      <div className="row" style={{ justifyContent: "space-between", margin: "-6px -6px -8px 0" }}>
        <span style={{ fontSize: 12, color: "var(--lime)", fontWeight: 600 }}>Main focus{skill.pinned ? "" : " · picked automatically"}</span>
        <button className="btn small ghost" style={{ minHeight: 36 }} onClick={onChange}>Change</button>
      </div>
      <Link to={`/skills/${skill.id}`} className="focus-link">
      <div className="row">
        <Glyph area={skill.area} size={48} />
        <div className="grow stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{skill.name}</span>
        </div>
        {r != null && (
          <Ring value={r} size={52} thickness={6} inner="#191d12" track="#2a2d35" label={`${t.hit} hits from ${t.tried} tries`}>
            <span style={{ fontSize: 12 }}>{Math.round(r * 100)}%</span>
          </Ring>
        )}
      </div>
      {trend.filter((v) => v != null).length > 1 && <Sparkline values={trend} height={40} fill={false} label="Hit rate over the last 6 weeks" />}
      <div className="row" style={{ gap: 8 }}>
        <StatusTrack status={skill.status} width="100%" />
        <span className="label" style={{ whiteSpace: "nowrap" }}>{STATUS_LABEL[skill.status]}</span>
      </div>
      </Link>
    </div>
  );
}

function PickFocus({ open, area, skills, current, onClose }: { open: boolean; area: Area; skills: Skill[]; current?: Skill; onClose: () => void }) {
  const choices = skills
    .filter((s) => s.status === "ip" || s.status === "ns")
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ip" ? -1 : 1));
  const pick = async (s: Skill) => {
    await setMainFocus(s, true);
    toast(`Main focus · ${s.name}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="Choose main focus">
      <h2 className="page-title" style={{ fontSize: 26 }}>Main focus · {area}</h2>
      <div className="stack" style={{ gap: 8, maxHeight: "55vh", overflowY: "auto" }}>
        {choices.map((s) => (
          <button key={s.id} className="choice pick-row" aria-pressed={current?.id === s.id && !!s.pinned} onClick={() => pick(s)}>
            <span className="grow" style={{ textAlign: "left" }}>{s.name}</span>
            <span className="label">{STATUS_LABEL[s.status]}</span>
          </button>
        ))}
        {choices.length === 0 && <p className="empty">No {area.toLowerCase()} skills are in progress or not started.</p>}
      </div>
      {current?.pinned && (
        <button className="btn" onClick={async () => { await setMainFocus(current, false); toast("Main focus picked automatically"); onClose(); }}>
          Pick automatically
        </button>
      )}
    </Sheet>
  );
}

function AddSkill({ open, area, onClose }: { open: boolean; area: Area; onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [where, setWhere] = useState<Area>(area);
  const save = async () => {
    if (!name.trim()) return;
    const id = await db.skills.add({ name: name.trim(), area: where, status: "ns", notes: "", createdAt: todayISO() });
    setName("");
    onClose();
    nav(`/skills/${id}`);
  };
  return (
    <Sheet open={open} onClose={onClose} label="Add skill">
      <h2 className="page-title" style={{ fontSize: 26 }}>Add skill</h2>
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} autoFocus placeholder="e.g. Double 50 entries" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>Area</span>
        <div className="choices">
          {AREAS.map((a) => (
            <button key={a} className="choice" aria-pressed={where === a} onClick={() => setWhere(a)}>{a}</button>
          ))}
        </div>
      </div>
      <button className="btn primary big" disabled={!name.trim()} onClick={save}>Add skill</button>
    </Sheet>
  );
}
