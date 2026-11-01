import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Program, Session } from "../db/types";
import { daysBetween, formatShort, todayISO } from "../lib/dates";
import { nextProgramIndex, programPosition } from "../lib/stats";
import { Icon } from "../components/ui";

export default function Programs() {
  const nav = useNavigate();
  const programs = useLiveQuery(() => db.programs.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  if (!programs || !sessions) return <main className="screen" />;

  const create = async () => {
    const id = await db.programs.add({
      name: "New program",
      goal: "",
      startDate: todayISO(),
      sessionsPerWeek: 5,
      weeks: ["", "", "", ""],
      rounds: [{ title: "Positional rounds", sets: "3 × 3 min", cues: [] }],
      active: false,
    });
    nav(`/programs/${id}`);
  };

  const active = programs.find((p) => p.active);
  const others = programs.filter((p) => !p.active);

  return (
    <main className="screen">
      <div className="top" style={{ alignItems: "flex-end", minHeight: 56 }}>
        <h1 className="page-title">Programs</h1>
        <button className="icon-btn lime" aria-label="New program" onClick={create}>+</button>
      </div>

      {active ? <ActiveProgram program={active} sessions={sessions} /> : <p className="empty">No active program. Open one and set it active to see it on Today.</p>}

      {others.length > 0 && (
        <section className="stack">
          <h2 className="section-title" style={{ marginTop: 6 }}>Other programs</h2>
          {others.map((p) => (
            <Link key={p.id} to={`/programs/${p.id}`} className="skill-row">
              <div className="grow stack" style={{ gap: 2 }}>
                <span className="name">{p.name}</span>
                <span className="label">{p.weeks.length} weeks · {p.sessionsPerWeek} a week{p.goal ? ` · ${p.goal}` : ""}</span>
              </div>
              {Icon.chevron("#8d919b")}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function ActiveProgram({ program, sessions }: { program: Program; sessions: Session[] }) {
  const today = todayISO();
  // Today's linked session is still "up next" until you've reflected on it.
  const todays = sessions.find((s) => s.date === today && s.program?.programId === program.id && !s.reflection);
  const index = todays?.program?.index ?? nextProgramIndex(sessions, program.id!);
  const pos = programPosition(program, index);
  const done = sessions.filter((s) => s.program?.programId === program.id && s !== todays);
  const doneIn = (w: number) => done.filter((s) => Math.floor(s.program!.index / program.sessionsPerWeek) === w).length;
  const countdown = program.goalDate ? daysBetween(today, program.goalDate) : null;

  return (
    <section className="focus-card" style={{ gap: 14 }}>
      <div className="row">
        <div className="grow stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--lime)", fontWeight: 600 }}>Active program</span>
          <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{program.name}</span>
          {program.goal && <span className="muted" style={{ fontSize: 14 }}>{program.goal}</span>}
        </div>
        <Link to={`/programs/${program.id}`} className="btn small">Edit</Link>
      </div>

      {countdown != null && (
        <div className="row" style={{ gap: 8 }}>
          <span className="big-num" style={{ fontSize: 30 }}>{Math.max(countdown, 0)}</span>
          <span className="muted" style={{ fontSize: 14 }}>{countdown >= 0 ? `days to go · ${formatShort(program.goalDate!)}` : "goal date passed"}</span>
        </div>
      )}

      <div className="stack" aria-label="Weeks">
        {program.weeks.map((focus, w) => {
          const done = doneIn(w);
          const current = !pos.finished && pos.week === w + 1;
          return (
            <div key={w} className="row" style={{ gap: 10 }}>
              <span className="label" style={{ width: 40, color: current ? "var(--lime)" : undefined, fontWeight: current ? 700 : 400 }}>Wk {w + 1}</span>
              <div className="grow stack" style={{ gap: 5 }}>
                <span style={{ fontSize: 14, fontWeight: current ? 700 : 500, color: done >= program.sessionsPerWeek ? "var(--faint)" : undefined }}>{focus || "No focus set"}</span>
                <div className="track" role="img" aria-label={`${done} of ${program.sessionsPerWeek} sessions done`}>
                  {Array.from({ length: program.sessionsPerWeek }, (_, i) => <span key={i} style={i < done ? { background: "var(--lime)" } : undefined} />)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pos.finished ? (
        <p className="muted">All {pos.total} sessions done.</p>
      ) : (
        <Link to={`/programs/${program.id}/day/${index}`} className="btn primary">{todays ? "Today" : "Next"}: Week {pos.week} · Day {pos.day}</Link>
      )}
    </section>
  );
}
