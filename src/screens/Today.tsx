import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { IntentionItem, Note, Program, Session } from "../db/types";
import { addDays, formatDay, formatShort, todayISO, weekStart } from "../lib/dates";
import { addToNextIntention, bumpHit, logPastDay, newItem, pendingItems, removeDay, restoreItem, startSession } from "../lib/actions";
import { nextProgramIndex, programPosition } from "../lib/stats";
import { Icon, Pips, Ring, Sheet, buzz, toast } from "../components/ui";

const MET_LABEL = { yes: "Yes", partly: "Partly", no: "No" } as const;

export default function Today() {
  const today = todayISO();
  const sessions = useLiveQuery(() => db.sessions.orderBy("date").toArray(), []);
  const programs = useLiveQuery(() => db.programs.toArray(), []);
  const notes = useLiveQuery(() => db.notes.where("kind").equals("didnt").toArray(), []);
  if (!sessions || !programs || !notes) return <main className="screen" />;

  const session = sessions.filter((s) => s.date === today).at(-1);
  const last = sessions.filter((s) => s.date < today).at(-1);
  const lastDidnt = last ? notes.filter((n) => n.sessionId === last.id) : [];
  const program = session?.program ? programs.find((p) => p.id === session.program!.programId) : programs.find((p) => p.active);
  const programIndex = session?.program?.index ?? (program?.id != null ? nextProgramIndex(sessions, program.id) : 0);

  return (
    <main className="screen">
      <div className="top">
        <span className="meta">{formatDay(today)}{session ? ` · ${session.gi ? "Gi" : "No-gi"} · ${session.type}` : ""}</span>
        {session && <Link className="btn small" to="/intention">Edit</Link>}
      </div>

      <WeekStrip sessions={sessions} today={today} />

      {session ? <Intention session={session} /> : <NoSession last={sessions.filter((s) => s.date < today && s.items.length > 0).at(-1)} />}

      {program && !(session && !session.program) && <ProgramCard program={program} index={programIndex} />}

      {session && (session.reflection ? (
        <Link to="/reflect" className="card quiet card-link" style={{ flexDirection: "row", alignItems: "center" }}>
          <span className="glyph" style={{ background: "var(--lime)", width: 36, height: 36 }}>{Icon.check("#0e0f12")}</span>
          <div className="grow">
            <div className="section-title">Reflected</div>
            <div className="label">Intention met: {MET_LABEL[session.reflection.met]} · Tap to edit</div>
          </div>
          {Icon.chevron("#8d919b")}
        </Link>
      ) : (
        <Link to="/reflect" className="btn primary big">Reflect on session</Link>
      ))}

      {lastDidnt.length > 0 && last && <FromLast notes={lastDidnt} last={last} session={session} />}
    </main>
  );
}

function WeekStrip({ sessions, today }: { sessions: Session[]; today: string }) {
  const [weeksBack, setWeeksBack] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const start = addDays(weekStart(today), -7 * weeksBack);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const trained = new Set(sessions.map((s) => s.date));
  const title = weeksBack === 0 ? "This week" : weeksBack === 1 ? "Last week" : `Week of ${formatShort(start)}`;
  return (
    <section className="stack" style={{ gap: 6 }}>
      <div className="week-head">
        <button className="icon-btn plain" aria-label="Previous week" onClick={() => setWeeksBack(weeksBack + 1)}>{Icon.chevron("#8d919b", 180)}</button>
        <span className="label">{title} · {days.filter((d) => trained.has(d)).length} trained</span>
        <button className="icon-btn plain" aria-label="Next week" disabled={weeksBack === 0} onClick={() => setWeeksBack(weeksBack - 1)}>{Icon.chevron("#8d919b")}</button>
      </div>
      <div className="week">
        {days.map((d, i) => (
          <button
            key={d}
            className={`d ${d === today ? "today" : ""}`}
            disabled={d > today}
            aria-label={`${formatDay(d)}, ${trained.has(d) ? "trained" : "not trained"}`}
            onClick={() => setPicked(d)}
          >
            <span>{"MTWTFSS"[i]}</span>
            <span className={`tile ${trained.has(d) ? "on" : ""}`} />
          </button>
        ))}
      </div>
      <DaySheet date={picked} today={today} sessions={sessions.filter((s) => s.date === picked)} onClose={() => setPicked(null)} />
    </section>
  );
}

function DaySheet({ date, today, sessions, onClose }: { date: string | null; today: string; sessions: Session[]; onClose: () => void }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const close = () => { setConfirm(false); onClose(); };
  if (!date) return null;
  const s = sessions.at(-1);
  const hasData = sessions.some((x) => x.items.length > 0 || x.reflection);
  const remove = async () => {
    await removeDay(date);
    toast(`${formatDay(date)} marked as not trained`);
    close();
  };
  return (
    <Sheet open onClose={close} label={formatDay(date)}>
      <h2 className="page-title" style={{ fontSize: 26 }}>{date === today ? "Today" : formatDay(date)}</h2>
      {s ? (
        <>
          <div className="card quiet tight">
            <span className="label">{s.gi ? "Gi" : "No-gi"} · {s.type}</span>
            <span className="section-title">{s.title || "No intention set"}</span>
            {s.items.length > 0 && (
              <span className="muted" style={{ fontSize: 14 }}>
                {s.items.filter((i) => i.hit >= i.target).length} of {s.items.length} hit{s.reflection ? ` · Intention met: ${MET_LABEL[s.reflection.met]}` : ""}
              </span>
            )}
          </div>
          {confirm ? (
            <div className="stack">
              <p className="muted" style={{ fontSize: 14 }}>This deletes the {formatDay(date)} session{hasData ? ", its intention, reflection and notes" : ""}.</p>
              <div className="row">
                <button className="btn grow" onClick={() => setConfirm(false)}>Keep it</button>
                <button className="btn danger grow" onClick={remove}>Remove session</button>
              </div>
            </div>
          ) : (
            <button className="btn danger" onClick={() => (hasData ? setConfirm(true) : remove())}>I didn't train this day</button>
          )}
        </>
      ) : date === today ? (
        <button className="btn primary big" onClick={() => { close(); nav("/intention"); }}>Set today's intention</button>
      ) : (
        <>
          <p className="muted">No session logged.</p>
          <button className="btn primary big" onClick={async () => { await logPastDay(date); toast(`${formatDay(date)} logged`); close(); }}>I trained this day</button>
        </>
      )}
    </Sheet>
  );
}

function Intention({ session }: { session: Session }) {
  const done = session.items.filter((i) => i.hit >= i.target).length;
  const total = session.items.length;
  const tap = async (it: IntentionItem, delta: number) => {
    buzz();
    await bumpHit(session, it.id, delta);
    toast(delta < 0 ? `${it.hit >= it.target ? "Unchecked" : "Removed a hit ·"} ${it.label}` : `Hit ${Math.min(it.hit + 1, 99)}/${it.target} · ${it.label}`, () => restoreItem(session.id!, it));
  };
  return (
    <>
      <div className="row" style={{ gap: 16 }}>
        <div className="grow stack" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 14 }}>Today I'm working on</span>
          <h1 className="hero-title">{session.title || "Today's session"}</h1>
        </div>
        {total > 0 && (
          <Ring value={done / total} label={`${done} of ${total} hit`}>
            <span style={{ fontSize: 22 }}>{done}/{total}</span>
          </Ring>
        )}
      </div>

      <div className="stack">
        {session.items.map((it) => {
          const isDone = it.hit >= it.target;
          return (
            <div key={it.id} className={`item ${isDone ? "done" : ""}`}>
              <button
                className="box"
                style={{ background: isDone ? "var(--lime)" : "transparent" }}
                aria-label={isDone ? `Uncheck ${it.label}` : `Add a hit on ${it.label}`}
                onClick={() => tap(it, isDone ? -it.hit : 1)}
              >
                {isDone && Icon.check("#0e0f12")}
              </button>
              <span className="text">{it.label}</span>
              {it.hit > 0 && !isDone ? (
                <button className="pips-btn" aria-label={`Remove a hit on ${it.label}`} onClick={() => tap(it, -1)}>
                  <Pips hit={it.hit} target={it.target} />
                </button>
              ) : (
                <Pips hit={it.hit} target={it.target} />
              )}
              {isDone ? (
                <button className="icon-btn plain" aria-label={`Add another hit on ${it.label}`} onClick={() => tap(it, 1)}>+</button>
              ) : (
                <button className="icon-btn" aria-label={`Add a hit on ${it.label}`} onClick={() => tap(it, 1)}>+</button>
              )}
            </div>
          );
        })}
        {total === 0 && (
          <Link to="/intention" className="card quiet card-link"><span className="muted">No items yet. Tap to add what you'll work on.</span></Link>
        )}
      </div>
    </>
  );
}

function NoSession({ last }: { last?: Session }) {
  const nav = useNavigate();
  const repeat = async () => {
    if (!last) return;
    const copied = last.items.map((i) => newItem(i.label, i.skillId, i.target));
    const queued = (await pendingItems()).filter((p) => !copied.some((c) => c.label === p.label));
    await startSession({ title: last.title, type: last.type, gi: last.gi, items: [...copied, ...queued] });
    toast("Copied last session");
  };
  return (
    <div className="stack-lg" style={{ marginTop: 8 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="muted" style={{ fontSize: 14 }}>Today I'm working on</span>
        <h1 className="hero-title" style={{ color: "var(--faint)" }}>Nothing set yet</h1>
      </div>
      <button className="btn primary big" onClick={() => nav("/intention")}>Set today's intention</button>
      {last && (
        <button className="btn big" onClick={repeat}>
          Repeat last session · {last.title || formatDay(last.date)}
        </button>
      )}
    </div>
  );
}

function ProgramCard({ program, index }: { program: Program; index: number }) {
  const pos = programPosition(program, index);
  if (pos.finished) {
    return (
      <Link to={`/programs/${program.id}`} className="card quiet card-link tight">
        <span className="label">Today's program</span>
        <span className="section-title">{program.name} is finished · plan the next one</span>
      </Link>
    );
  }
  return (
    <Link to={`/programs/${program.id}/day/${index}`} className="card quiet card-link tight" style={{ gap: 10, padding: "12px 14px" }}>
      <div className="row" style={{ gap: 10 }}>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="label">Today's program</span>
          <span className="section-title">{program.name} · Wk {pos.week} · Day {pos.day}</span>
        </div>
        {Icon.chevron("#8d919b")}
      </div>
      {program.rounds.length > 0 && (
        <div className="rounds">
          {program.rounds.slice(0, 3).map((r, i) => (
            <span key={i} className={`round ${i === 0 ? "focus" : ""}`}><span>{r.title}</span>{r.sets}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

function FromLast({ notes, last, session }: { notes: Note[]; last: Session; session?: Session }) {
  const [open, setOpen] = useState(false);
  const inToday = (n: Note) => !!session?.items.some((i) => i.label === n.text);
  const add = async (n: Note) => {
    const where = await addToNextIntention(n.text, n.skillId);
    toast(where === "today" ? "Added to today" : "Added to your next intention");
  };
  return (
    <section className="alert">
      <button className="alert-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="alert-icon">{Icon.bang("#261d10")}</span>
        <span className="grow stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)" }}>From last session · {notes.length}</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{open ? `What didn't work on ${formatDay(last.date)}` : notes[0].text}</span>
        </span>
        {Icon.chevron("#ffb36b")}
      </button>
      {open && (
        <div className="alert-list">
          {notes.map((n) => (
            <div key={n.id} className="alert-note">
              <p>{n.text}</p>
              {inToday(n) ? (
                <span className="tag" style={{ padding: "0 10px" }}>In today</span>
              ) : (
                <button className="btn small ghost" style={{ color: "var(--amber)", borderColor: "#4a3524" }} onClick={() => add(n)}>Work on it</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
