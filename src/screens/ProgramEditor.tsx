import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../db/db";
import type { Program, Round } from "../db/types";
import { Back, Icon, toast } from "../components/ui";

export default function ProgramEditor() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [p, setP] = useState<Program | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    db.programs.get(id).then((x) => setP(x ?? null));
  }, [id]);
  if (!p) return <main className="screen"><Back to="/programs" label="Programs" /></main>;

  const set = (patch: Partial<Program>) => setP({ ...p, ...patch });
  const setRound = (i: number, patch: Partial<Round>) => set({ rounds: p.rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const save = async () => {
    await db.transaction("rw", db.programs, async () => {
      // Only one program is active at a time.
      if (p.active) for (const o of await db.programs.toArray()) if (o.id !== id && o.active) await db.programs.update(o.id!, { active: false });
      await db.programs.put({ ...p, name: p.name.trim() || "Untitled program", weeks: p.weeks.map((w) => w.trim()) });
    });
    toast("Program saved");
    nav("/programs");
  };

  const remove = async () => {
    await db.programs.delete(id);
    nav("/programs");
  };

  return (
    <main className="screen">
      <div className="top">
        <Back to="/programs" label="Programs" />
        <button className="btn primary small" onClick={save}>Save</button>
      </div>

      <label className="field"><span>Name</span><input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="field"><span>Goal</span><input className="input" value={p.goal} placeholder="e.g. Make K-guard my main open guard" onChange={(e) => set({ goal: e.target.value })} /></label>
      <label className="field"><span>Goal date (optional)</span><input className="input" type="date" value={p.goalDate ?? ""} onChange={(e) => set({ goalDate: e.target.value || undefined })} /></label>

      <div className="field">
        <span>Sessions a week</span>
        <div className="row">
          <button className="icon-btn" aria-label="Fewer sessions" onClick={() => set({ sessionsPerWeek: Math.max(1, p.sessionsPerWeek - 1) })}>−</button>
          <span style={{ fontWeight: 800, fontSize: 20, minWidth: 32, textAlign: "center" }}>{p.sessionsPerWeek}</span>
          <button className="icon-btn" aria-label="More sessions" onClick={() => set({ sessionsPerWeek: Math.min(14, p.sessionsPerWeek + 1) })}>+</button>
        </div>
      </div>

      <div className="choices">
        <button className="choice lime" aria-pressed={p.active} onClick={() => set({ active: true })}>Active</button>
        <button className="choice" aria-pressed={!p.active} onClick={() => set({ active: false })}>Not active</button>
      </div>

      <div className="field">
        <span>Weekly focus</span>
        {p.weeks.map((w, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <span className="label" style={{ width: 40 }}>Wk {i + 1}</span>
            <input className="input grow" value={w} aria-label={`Week ${i + 1} focus`} onChange={(e) => set({ weeks: p.weeks.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button className="icon-btn plain" aria-label={`Remove week ${i + 1}`} disabled={p.weeks.length <= 1} onClick={() => set({ weeks: p.weeks.filter((_, j) => j !== i) })}>{Icon.x()}</button>
          </div>
        ))}
        <button className="btn" onClick={() => set({ weeks: [...p.weeks, ""] })}>+ Add week</button>
      </div>

      <div className="field">
        <span>Rounds each session</span>
        {p.rounds.map((r, i) => (
          <div key={i} className="card tight" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <input className="input grow" value={r.title} aria-label="Round" placeholder="Guard play" onChange={(e) => setRound(i, { title: e.target.value })} />
              <button className="icon-btn plain" aria-label={`Remove ${r.title}`} onClick={() => set({ rounds: p.rounds.filter((_, j) => j !== i) })}>{Icon.x()}</button>
            </div>
            <input className="input" value={r.sets} aria-label="Sets" placeholder="3 × 3 min" onChange={(e) => setRound(i, { sets: e.target.value })} />
            <label className="field">
              <span>Cues, one per line</span>
              <textarea className="textarea" value={r.cues.join("\n")} onChange={(e) => setRound(i, { cues: e.target.value.split("\n") })} onBlur={() => setRound(i, { cues: r.cues.map((c) => c.trim()).filter(Boolean) })} />
            </label>
          </div>
        ))}
        <button className="btn" onClick={() => set({ rounds: [...p.rounds, { title: "", sets: "3 × 3 min", cues: [] }] })}>+ Add round</button>
      </div>

      {confirm ? (
        <div className="row">
          <span className="grow muted" style={{ fontSize: 14 }}>Delete “{p.name}”? Past sessions stay.</span>
          <button className="btn small" onClick={() => setConfirm(false)}>Keep</button>
          <button className="btn small danger" onClick={remove}>Delete</button>
        </div>
      ) : (
        <button className="btn danger" onClick={() => setConfirm(true)}>Delete program</button>
      )}
    </main>
  );
}
