export type Area = "Bottom" | "Top" | "Stand up";
export const AREAS: Area[] = ["Bottom", "Top", "Stand up"];

/** ns = Not started, ip = In progress, dn = Done, pk = Parked */
export type Status = "ns" | "ip" | "dn" | "pk";
export const STATUS_LABEL: Record<Status, string> = {
  ns: "Not started",
  ip: "In progress",
  dn: "Done",
  pk: "Parked",
};
export const STATUS_ORDER: Status[] = ["ns", "ip", "dn", "pk"];

export interface Skill {
  id?: number;
  area: Area;
  name: string;
  status: Status;
  parkedReason?: string;
  notes: string;
  createdAt: string;
  /** set when status changes; used for "moved to Done" stats */
  statusChangedAt?: string;
  /** chosen as the area's main focus on the Skills tab */
  pinned?: boolean;
}

export interface IntentionItem {
  id: string;
  label: string;
  skillId?: number;
  target: number;
  hit: number;
  /** attempts; filled in on Reflect, never below hit */
  tried: number;
}

export type Met = "yes" | "partly" | "no";

export interface Reflection {
  met: Met;
  energy: number; // 1–5
  focus: number; // 1–5
  doneAt: string;
}

export interface ProgramRef {
  programId: number;
  index: number; // 0-based session index within the program
}

export interface Session {
  id?: number;
  date: string; // yyyy-mm-dd
  type: string; // Class, Open mat, Drilling, Comp, Private
  gi: boolean;
  title: string;
  items: IntentionItem[];
  program?: ProgramRef;
  reflection?: Reflection;
}

export type NoteKind = "worked" | "didnt";

export interface Note {
  id?: number;
  kind: NoteKind;
  skillId?: number;
  sessionId?: number;
  text: string;
  date: string;
}

export interface Problem {
  id?: number;
  text: string;
  skillId?: number;
  /** dates (yyyy-mm-dd) it came up */
  seen: string[];
  status: "open" | "solved";
  createdAt: string;
}

export interface Round {
  title: string;
  sets: string;
  cues: string[];
}

export interface Program {
  id?: number;
  name: string;
  goal: string;
  goalDate?: string;
  startDate: string;
  sessionsPerWeek: number;
  /** one focus line per week; length = number of weeks */
  weeks: string[];
  /** the rounds every program session runs */
  rounds: Round[];
  active: boolean;
}

export interface PlanNode {
  id: string;
  label: string;
  /** the situation that leads here, e.g. "They post an arm" */
  when?: string;
  skillId?: number;
  status?: Status;
  children: PlanNode[];
}

export interface GamePlan {
  id?: number;
  name: string;
  nodes: PlanNode[];
}

export interface Meta {
  key: string;
  value: string;
}
