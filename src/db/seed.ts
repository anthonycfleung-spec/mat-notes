import type { Transaction } from "dexie";
import type { Area, GamePlan, PlanNode, Problem, Program, Skill, Status } from "./types";
import { todayISO } from "../lib/dates";

/** Starting content, taken from the BJJ Log in Notion (skills, troubleshooting list, positional rounds). */
const SKILLS: [Area, string, Status, string?][] = [
  ["Bottom", "Kanard retention to K-guard", "ip"],
  ["Bottom", "Y-guard off-balance", "ip"],
  ["Bottom", "K-guard armbar", "ip"],
  ["Bottom", "Matrix", "ip"],
  ["Bottom", "Ankle lock 2.0 — left and right", "ip"],
  ["Bottom", "De La Riva refresher", "ip"],
  ["Bottom", "Pawel-style false reap", "ip"],
  ["Bottom", "Double 50", "ns"],
  ["Bottom", "Left-side K-guard", "ns"],
  ["Bottom", "Smash saddle recovery", "ns"],
  ["Bottom", "Facebolo system", "ns"],
  ["Bottom", "Bear trap", "ns"],
  ["Bottom", "Tariko", "ns"],
  ["Bottom", "RDLR", "ns"],
  ["Bottom", "Pinch headlock", "ns"],
  ["Bottom", "Seated guard: foot sweep and wrestle-up", "pk", "Build the K-guard game first"],
  ["Bottom", "Spiral ankle lock", "dn"],
  ["Bottom", "Back and turtle defence", "dn"],
  ["Bottom", "Lasso inversion to K", "dn"],
  ["Bottom", "Keymaster system", "dn"],
  ["Bottom", "Tren lock", "dn"],
  ["Bottom", "Canadian drag", "dn"],
  ["Bottom", "Woj lock", "dn"],
  ["Bottom", "Mateus Aoki from outside ashi", "dn"],
  ["Bottom", "Double outside ashi footlock", "dn"],
  ["Bottom", "De La Riva", "dn"],
  ["Bottom", "Shin bolo", "dn"],
  ["Bottom", "Failed shin bolo entry to saddle", "dn"],
  ["Bottom", "Top leglocks", "dn"],
  ["Bottom", "Lachy lock", "dn"],
  ["Bottom", "False reap", "dn"],
  ["Top", "Headquarters passing", "ip"],
  ["Top", "Stacking from over-under or thigh wrap, switching sides", "ip"],
  ["Top", "Attacking turtle", "ip"],
  ["Top", "Inside head clamping — high and low", "ip"],
  ["Top", "Hand fighting", "ip"],
  ["Top", "Half butterfly passing", "ip"],
  ["Top", "Split squat, tight waist and more", "ip"],
  ["Top", "North-south passing", "ns"],
  ["Stand up", "Defending and preventing collar ties", "ns"],
];

const OPEN_PROBLEMS: [string, string?][] = [
  ["Shoulder crunch when getting into half butterfly passing", "Half butterfly passing"],
  ["Getting stacked out of shotgun armbar", "K-guard armbar"],
  ["Taking the back from turtle", "Attacking turtle"],
  ["Overhooked forward shift in high tripod"],
];
const SOLVED_PROBLEMS = [
  "Not getting thrown from high tripod",
  "Heisting from half butterfly",
  "G-roll body lock counter",
  "Half guard to K-guard",
  "Shooting K-guard on a kneeling opponent",
  "K-guard to modified X or Y on the right leg",
];

export const STARTER_PROGRAM: Omit<Program, "id" | "startDate"> = {
  name: "K-Guard block",
  goal: "Make K-guard my main open guard",
  sessionsPerWeek: 5,
  weeks: [
    "K-Guard entries",
    "Matrix and crab ride",
    "Positional rounds (guard · passing · wrestling)",
    "Finishes: shotgun armbar, false reap",
  ],
  rounds: [
    {
      title: "Guard play",
      sets: "3 × 3 min",
      cues: [
        "Pull supine under my contour",
        "Make sticky connections",
        "Partner's hands to mat or butt to floor",
        "Secure inside position, two legs on one",
        "Isolate a foot to break",
        "Chest-to-back connections",
      ],
    },
    {
      title: "Passing",
      sets: "3 × 3 min",
      cues: [
        "Get purchase on the legs",
        "Flank to the side and get to J-point",
        "Dig for the underhook when it's there",
        "Chest to chest",
        "Pin",
      ],
    },
    {
      title: "Wrestling",
      sets: "3 × 3 min",
      cues: ["Isolate arms away from the body", "Circle around the leg", "Hands to mat"],
    },
  ],
  active: true,
};

let n = 0;
const node = (label: string, when: string | undefined, status: Status, children: PlanNode[] = []): PlanNode => ({
  id: `seed-${++n}`,
  label,
  when,
  status,
  children,
});

const STARTER_PLAN: Omit<GamePlan, "id"> = {
  name: "Open guard",
  nodes: [
    node("K-Guard", undefined, "ip", [
      node("Matrix", "They stay square", "ip", [
        node("Crab ride → back take", "Hips turn away", "ns"),
        node("Leg entry → saddle", "Leg stays heavy", "dn"),
      ]),
      node("Shotgun armbar", "They post an arm", "ip"),
      node("Pawel-style false reap", "They back-step", "ip", [
        node("Ankle lock 2.0", "Heel exposed", "ip"),
        node("Top leglocks", "They roll out", "dn"),
      ]),
    ]),
    node("Half guard", undefined, "dn", [
      node("Kanard retention → K-guard", "Knee shield up", "ip"),
      node("Heist from half butterfly", "They flatten me", "dn"),
    ]),
    node("Y-guard", undefined, "ip", [
      node("Off-balance backwards", "Weight forward", "ip"),
      node("Modified X on right leg", "They stand tall", "dn"),
    ]),
  ],
};

export async function seed(tx: Transaction) {
  const now = todayISO();
  const skills: Skill[] = SKILLS.map(([area, name, status, parkedReason]) => ({
    area,
    name,
    status,
    parkedReason,
    notes: "",
    createdAt: now,
  }));
  const ids = (await tx.table("skills").bulkAdd(skills, { allKeys: true })) as number[];
  const idOf = (name?: string) => (name ? ids[SKILLS.findIndex((s) => s[1] === name)] : undefined);

  const problems: Problem[] = [
    ...OPEN_PROBLEMS.map(([text, skill]) => ({
      text,
      skillId: idOf(skill),
      seen: [],
      status: "open" as const,
      createdAt: now,
    })),
    ...SOLVED_PROBLEMS.map((text) => ({ text, seen: [], status: "solved" as const, createdAt: now })),
  ];
  await tx.table("problems").bulkAdd(problems);
  await tx.table("programs").add({ ...STARTER_PROGRAM, startDate: now });
  await tx.table("gamePlans").add(STARTER_PLAN);
}
