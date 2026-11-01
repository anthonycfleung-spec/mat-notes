import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { programPosition } from "../lib/stats";
import { Back } from "../components/ui";

export default function ProgramDay() {
  const params = useParams();
  const id = Number(params.id);
  const index = Number(params.index);
  const program = useLiveQuery(() => db.programs.get(id), [id]);
  if (!program) return <main className="screen"><Back /></main>;
  const pos = programPosition(program, index);

  return (
    <main className="screen">
      <div className="top"><Back /></div>
      <div className="stack" style={{ gap: 4 }}>
        <span className="label">{program.name} · Week {pos.week} · Day {pos.day}</span>
        <h1 className="page-title">{program.weeks[pos.week - 1] || "Today's rounds"}</h1>
      </div>

      {program.rounds.map((r, i) => (
        <section key={i} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title" style={{ fontSize: 17 }}>{r.title}</h2>
            <span className="round focus" style={{ fontSize: 13 }}>{r.sets}</span>
          </div>
          {r.cues.length > 0 && (
            <ol className="stack" style={{ margin: 0, paddingLeft: 22, gap: 6 }}>
              {r.cues.map((c, j) => <li key={j} style={{ fontSize: 15 }}>{c}</li>)}
            </ol>
          )}
        </section>
      ))}
      {program.rounds.length === 0 && <p className="empty">No rounds yet.</p>}
      <Link to={`/programs/${id}`} className="btn ghost">Edit program</Link>
    </main>
  );
}
