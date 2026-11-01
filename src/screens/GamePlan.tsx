import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { GamePlan as Plan, PlanNode, Status } from "../db/types";
import { STATUS_LABEL, STATUS_ORDER } from "../db/types";
import { uid } from "../lib/actions";
import { Icon, Sheet } from "../components/ui";

const STATUS_COLOR: Record<Status, string> = { ns: "#3a3d46", ip: "#c8f04a", dn: "#9b8cff", pk: "#8d919b" };

/** Immutable update helpers for the plan tree. */
function mapTree(nodes: PlanNode[], fn: (n: PlanNode) => PlanNode | null): PlanNode[] {
  return nodes.flatMap((n) => {
    const next = fn(n);
    return next ? [{ ...next, children: mapTree(next.children, fn) }] : [];
  });
}

type Editing = { mode: "add"; parentId: string | null } | { mode: "edit"; node: PlanNode };

export default function GamePlan() {
  const plans = useLiveQuery(() => db.gamePlans.toArray(), []);
  const [planId, setPlanId] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  if (!plans) return <main className="screen" />;

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const save = (nodes: PlanNode[]) => plan && db.gamePlans.put({ ...plan, nodes });
  const toggle = (id: string) => {
    const next = new Set(open);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpen(next);
  };
  const newPlan = async () => {
    const id = await db.gamePlans.add({ name: "New game plan", nodes: [] });
    setPlanId(id as number);
  };

  const renderNodes = (nodes: PlanNode[]) =>
    nodes.map((n) => {
      const expanded = open.has(n.id);
      return (
        <div key={n.id} className="stack">
          <div className="node">
            <span className="dot" style={{ background: STATUS_COLOR[n.status ?? "ns"], width: 12, height: 12 }} aria-label={STATUS_LABEL[n.status ?? "ns"]} role="img" />
            <button className="grow stack" style={{ gap: 1, background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => setEditing({ mode: "edit", node: n })}>
              {n.when && <span className="when">If {n.when.charAt(0).toLowerCase() + n.when.slice(1)}</span>}
              <span className="what">{n.label}</span>
            </button>
            {n.children.length > 0 ? (
              <button className="icon-btn plain" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} ${n.children.length} branches`} onClick={() => toggle(n.id)}>
                <span style={{ fontSize: 12, fontWeight: 700, marginRight: 2 }}>{n.children.length}</span>{Icon.chevron()}
              </button>
            ) : (
              <button className="icon-btn plain" aria-label={`Add a branch after ${n.label}`} onClick={() => { setEditing({ mode: "add", parentId: n.id }); setOpen(new Set(open).add(n.id)); }}>+</button>
            )}
          </div>
          {expanded && (
            <div className="children">
              {renderNodes(n.children)}
              <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setEditing({ mode: "add", parentId: n.id })}>+ Branch</button>
            </div>
          )}
        </div>
      );
    });

  return (
    <main className="screen">
      <div className="top" style={{ alignItems: "flex-end", minHeight: 56 }}>
        <h1 className="page-title">Game plan</h1>
        <button className="icon-btn lime" aria-label="New game plan" onClick={newPlan}>+</button>
      </div>
      {plans.length > 1 && (
        <div className="scroll-x">
          {plans.map((p) => <button key={p.id} className="chip" aria-pressed={p.id === plan?.id} onClick={() => setPlanId(p.id!)}>{p.name}</button>)}
        </div>
      )}
      {plan && <PlanName plan={plan} />}
      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
        {(["ip", "dn", "ns"] as Status[]).map((s) => (
          <span key={s} className="label row" style={{ gap: 6 }}><span className="dot" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>
        ))}
      </div>
      {plan && <div className="tree">{renderNodes(plan.nodes)}</div>}
      {plan && <button className="btn" onClick={() => setEditing({ mode: "add", parentId: null })}>+ Starting position</button>}

      {plan && editing && (
        <NodeSheet
          key={editing.mode === "edit" ? editing.node.id : `add-${editing.parentId}`}
          editing={editing}
          isRoot={editing.mode === "add" ? editing.parentId == null : plan.nodes.some((n) => n.id === editing.node.id)}
          onClose={() => setEditing(null)}
          onSave={(fields) => {
            if (editing.mode === "add") {
              const node: PlanNode = { id: uid(), children: [], ...fields };
              save(editing.parentId == null ? [...plan.nodes, node] : mapTree(plan.nodes, (n) => (n.id === editing.parentId ? { ...n, children: [...n.children, node] } : n)));
            } else {
              save(mapTree(plan.nodes, (n) => (n.id === editing.node.id ? { ...n, ...fields } : n)));
            }
            setEditing(null);
          }}
          onDelete={editing.mode === "edit" ? () => { save(mapTree(plan.nodes, (n) => (n.id === editing.node.id ? null : n))); setEditing(null); } : undefined}
        />
      )}
    </main>
  );
}

function PlanName({ plan }: { plan: Plan }) {
  return (
    <input
      className="input"
      key={plan.id}
      defaultValue={plan.name}
      aria-label="Game plan name"
      style={{ fontWeight: 700 }}
      onBlur={(e) => e.target.value.trim() && db.gamePlans.put({ ...plan, name: e.target.value.trim() })}
    />
  );
}

function NodeSheet({ editing, isRoot, onClose, onSave, onDelete }: {
  editing: Editing;
  isRoot: boolean;
  onClose: () => void;
  onSave: (f: Pick<PlanNode, "label" | "when" | "status">) => void;
  onDelete?: () => void;
}) {
  const start = editing.mode === "edit" ? editing.node : undefined;
  const [label, setLabel] = useState(start?.label ?? "");
  const [when, setWhen] = useState(start?.when ?? "");
  const [status, setStatus] = useState<Status>(start?.status ?? "ns");
  return (
    <Sheet open onClose={onClose} label={start ? "Edit step" : "Add step"}>
      <h2 className="page-title" style={{ fontSize: 26 }}>{start ? "Edit step" : isRoot ? "Starting position" : "Add a branch"}</h2>
      {!isRoot && (
        <label className="field"><span>If… (what they do)</span><input className="input" value={when} placeholder="They post an arm" onChange={(e) => setWhen(e.target.value)} /></label>
      )}
      <label className="field"><span>{isRoot ? "Position" : "I go to"}</span><input className="input" value={label} autoFocus placeholder={isRoot ? "K-Guard" : "Shotgun armbar"} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="field">
        <span>Status</span>
        <div className="choices" style={{ gridAutoFlow: "row", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {STATUS_ORDER.map((s) => <button key={s} className={`choice ${s === "ip" ? "lime" : s === "dn" ? "violet" : ""}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>)}
        </div>
      </div>
      <button className="btn primary big" disabled={!label.trim()} onClick={() => onSave({ label: label.trim(), when: isRoot ? undefined : when.trim() || undefined, status })}>Save</button>
      {onDelete && <button className="btn danger" onClick={onDelete}>Delete this step and its branches</button>}
    </Sheet>
  );
}
