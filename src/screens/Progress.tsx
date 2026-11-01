import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Note, Skill } from "../db/types";
import { addDays, daysBetween, formatShort, todayISO } from "../lib/dates";
import { addToNextIntention } from "../lib/actions";
import { LAST_BACKUP_KEY, importData, saveBackup } from "../lib/backup";
import { areaCounts, inRange, metCounts, mostImproved, problemHeat, rate, tally, weeklyRates } from "../lib/stats";
import { AREA_COLOR, Ring, Sparkline, toast } from "../components/ui";

const HEAT = [
  { bg: "#ffb36b", fg: "#2b1a08" },
  { bg: "#b97a3f", fg: "#1b1106" },
  { bg: "#4a3524", fg: "#ffd9b3" },
];

export default function Progress() {
  const today = todayISO();
  const from = addDays(today, -27);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const skills = useLiveQuery(() => db.skills.toArray(), []);
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const notes = useLiveQuery(() => db.notes.where("date").aboveOrEqual(from).toArray(), [from]);
  if (!sessions || !skills || !problems || !notes) return <main className="screen" />;

  const recent = inRange(sessions, from, today);
  const prev = inRange(sessions, addDays(from, -28), addDays(from, -1));
  const r = rate(tally(recent));
  const rPrev = rate(tally(prev));
  const weeks = weeklyRates(sessions, today, 6).map((w) => w.rate);
  const improved = mostImproved(sessions, today);
  const met = metCounts(recent);
  const metTotal = met.yes + met.partly + met.no;
  const heat = problemHeat(problems, skills);
  const maxHeat = Math.max(1, ...heat.map((h) => h.weight));
  const name = (id?: number) => skills.find((s) => s.id === id)?.name ?? "General";

  return (
    <main className="screen">
      <div className="top" style={{ alignItems: "flex-end", minHeight: 56 }}>
        <h1 className="page-title">Progress</h1>
        <span className="meta" style={{ fontSize: 13 }}>Last 4 weeks</span>
      </div>

      <div className="bento">
        <div className="card wide" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <div className="stack" style={{ gap: 2, minWidth: 110 }}>
            <span className="label">Hit rate</span>
            <span className="big-num">{r == null ? "–" : `${Math.round(r * 100)}%`}</span>
            {r != null && rPrev != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: r >= rPrev ? "var(--lime)" : "var(--amber)" }}>
                {r >= rPrev ? "▲" : "▼"} {Math.abs(Math.round((r - rPrev) * 100))} pts
              </span>
            )}
            <span className="label">{recent.length} sessions</span>
          </div>
          <div className="grow"><Sparkline values={weeks} label="Hit rate by week, last 6 weeks" /></div>
        </div>

        <div className="card tight">
          <span className="label">Most improved</span>
          {improved ? (
            <Link to={`/skills/${improved.skillId}`} className="card-link stack" style={{ gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{name(improved.skillId)}</span>
              <div className="row" style={{ gap: 8, alignItems: "flex-end", height: 58 }} role="img" aria-label={`Hit rate rose from ${Math.round(improved.before * 100)} to ${Math.round(improved.now * 100)} percent`}>
                <Bar value={improved.before} color="#2a2d35" text="var(--faint)" />
                <span className="faint" style={{ paddingBottom: 2 }}>→</span>
                <Bar value={improved.now} color="var(--lime)" text="var(--lime)" />
              </div>
              <span className="label">Hit rate, 4 weeks ago → now</span>
            </Link>
          ) : (
            <p className="empty">Shows up once a skill has tries in both halves of the month.</p>
          )}
        </div>

        <div className="card tight">
          <span className="label">Intention met</span>
          {metTotal > 0 ? (
            <div className="row" style={{ gap: 10 }}>
              <div role="img" aria-label={`${met.yes} yes, ${met.partly} partly, ${met.no} no`} className="ring" style={{ width: 64, height: 64, background: `conic-gradient(var(--lime) 0 ${(met.yes / metTotal) * 100}%, var(--violet) 0 ${((met.yes + met.partly) / metTotal) * 100}%, #3a3d46 0 100%)` }}>
                <div style={{ width: 40, height: 40, background: "var(--surface)" }} />
              </div>
              <div className="stack" style={{ gap: 3, fontSize: 12 }}>
                <span style={{ color: "var(--lime)" }}>{met.yes} yes</span>
                <span style={{ color: "var(--violet)" }}>{met.partly} partly</span>
                <span className="muted">{met.no} no</span>
              </div>
            </div>
          ) : (
            <p className="empty">Reflect after a session to fill this in.</p>
          )}
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">Skills by area</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, textAlign: "center" }}>
          {areaCounts(skills).map((a) => (
            <div key={a.area} className="stack" style={{ alignItems: "center", gap: 6 }}>
              <Ring value={a.total ? a.done / a.total : 0} size={70} thickness={8} color={AREA_COLOR[a.area].fg} track="#2a2d35" inner="var(--surface)" label={`${a.area}: ${a.done} of ${a.total} done, ${a.inProgress} in progress`}>
                <span style={{ fontSize: 14 }}>{a.done}/{a.total}</span>
              </Ring>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.area}</span>
              <span className="label">{a.inProgress} in progress</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Where problems happen</h2>
          <span className="label">{problems.filter((p) => p.status === "open").length} open</span>
        </div>
        {heat.length ? (
          <div className="heat">
            {heat.map((h) => {
              const tone = HEAT[h.weight / maxHeat > 0.66 ? 0 : h.weight / maxHeat > 0.33 ? 1 : 2];
              return <div key={h.label} style={{ background: tone.bg, color: tone.fg }}>{h.label}<strong>{h.weight}</strong></div>;
            })}
          </div>
        ) : (
          <p className="empty">No open problems.</p>
        )}
      </section>

      <NotesBySkill notes={notes} skills={skills} />
      <ProblemList problems={problems} name={name} />
      <Backup />
    </main>
  );
}

function Bar({ value, color, text }: { value: number; color: string; text: string }) {
  return (
    <div className="stack grow" style={{ alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 11, color: text, fontWeight: 700 }}>{Math.round(value * 100)}%</span>
      <span style={{ width: "100%", height: Math.max(6, value * 40), borderRadius: 5, background: color }} />
    </div>
  );
}

/** What worked and what didn't, grouped by skill, so it can feed the next intention. */
function NotesBySkill({ notes, skills }: { notes: Note[]; skills: Skill[] }) {
  const [kind, setKind] = useState<"didnt" | "worked">("didnt");
  const list = notes.filter((n) => n.kind === kind);
  const groups = new Map<number | undefined, Note[]>();
  for (const n of list) groups.set(n.skillId, [...(groups.get(n.skillId) ?? []), n]);
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const color = kind === "worked" ? "var(--lime)" : "var(--amber)";
  return (
    <section className="card">
      <h2 className="section-title">What worked · what didn't</h2>
      <div className="choices">
        <button className="choice amber" aria-pressed={kind === "didnt"} onClick={() => setKind("didnt")}>Didn't work</button>
        <button className="choice lime" aria-pressed={kind === "worked"} onClick={() => setKind("worked")}>Worked</button>
      </div>
      {sorted.length === 0 && <p className="empty">Nothing noted in the last 4 weeks.</p>}
      {sorted.map(([skillId, ns]) => {
        const skill = skills.find((s) => s.id === skillId);
        return (
          <div key={skillId ?? "none"} className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              {skill ? <Link to={`/skills/${skill.id}`} style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>{skill.name}</Link> : <span style={{ fontWeight: 700 }}>General</span>}
              <span className="label">{ns.length}×</span>
            </div>
            {ns.slice(0, 3).map((n) => (
              <div key={n.id} className="note-row" style={{ alignItems: "center" }}>
                <span className="kind-mark" style={{ background: color }} />
                <p>{n.text}</p>
                <span className="date">{formatShort(n.date)}</span>
              </div>
            ))}
            {kind === "didnt" && (
              <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={async () => {
                const w = await addToNextIntention(skill ? `Fix: ${ns[0].text}` : ns[0].text, skillId);
                toast(w === "today" ? "Added to today" : "Added to your next intention");
              }}>+ Add to next intention</button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function ProblemList({ problems, name }: { problems: { id?: number; text: string; skillId?: number; seen: string[]; status: "open" | "solved" }[]; name: (id?: number) => string }) {
  const [showSolved, setShowSolved] = useState(false);
  const open = problems.filter((p) => p.status === "open").sort((a, b) => b.seen.length - a.seen.length);
  const solved = problems.filter((p) => p.status === "solved");
  return (
    <section className="card">
      <h2 className="section-title">Problems</h2>
      {open.length === 0 && <p className="empty">No open problems.</p>}
      {open.map((p) => (
        <div key={p.id} className="row" style={{ alignItems: "center" }}>
          <div className="grow stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{p.text}</span>
            <span className="label">{name(p.skillId)}{p.seen.length ? ` · ${p.seen.length}× · last ${formatShort(p.seen[p.seen.length - 1])}` : ""}</span>
          </div>
          <button className="btn small" onClick={() => db.problems.update(p.id!, { status: "solved" })}>Mark solved</button>
        </div>
      ))}
      {solved.length > 0 && (
        <button className="btn small ghost" style={{ alignSelf: "flex-start" }} aria-expanded={showSolved} onClick={() => setShowSolved(!showSolved)}>
          {showSolved ? "Hide" : "Show"} {solved.length} solved
        </button>
      )}
      {showSolved && solved.map((p) => (
        <div key={p.id} className="row">
          <span className="grow faint" style={{ fontSize: 14, textDecoration: "line-through" }}>{p.text}</span>
          <button className="btn small ghost" onClick={() => db.problems.update(p.id!, { status: "open" })}>Reopen</button>
        </div>
      ))}
    </section>
  );
}

function Backup() {
  const last = useLiveQuery(() => db.meta.get(LAST_BACKUP_KEY), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const age = last ? daysBetween(last.value, todayISO()) : null;

  const restore = async () => {
    if (!confirmFile) return;
    try {
      await importData(await confirmFile.text());
      toast("Backup restored");
    } catch (e) {
      toast((e as Error).message || "Couldn't read that file");
    }
    setConfirmFile(null);
  };

  return (
    <section className="card">
      <h2 className="section-title">Backup</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Everything is stored on this phone only.{" "}
        {age == null ? "You haven't made a backup yet." : age === 0 ? "Last backup: today." : `Last backup: ${age} day${age > 1 ? "s" : ""} ago.`}
        {persisted === false && " Add the app to your Home Screen so the phone keeps your data."}
      </p>
      <button className={`btn ${age == null || age > 7 ? "primary" : ""}`} onClick={() => saveBackup()}>Back up now</button>
      <button className="btn ghost" onClick={() => input.current?.click()}>Restore from a backup file</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { setConfirmFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      {confirmFile && (
        <div className="stack" style={{ background: "var(--amber-bg)", padding: 12, borderRadius: 14 }}>
          <span style={{ fontSize: 14, color: "var(--amber-ink)" }}>Replace everything on this phone with “{confirmFile.name}”?</span>
          <div className="row">
            <button className="btn small grow" onClick={() => setConfirmFile(null)}>Cancel</button>
            <button className="btn small grow" style={{ background: "var(--amber)", color: "#261d10", border: 0, fontWeight: 800 }} onClick={restore}>Replace</button>
          </div>
        </div>
      )}
    </section>
  );
}
