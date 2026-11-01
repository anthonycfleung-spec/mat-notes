import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { Area, Status } from "../db/types";
import { STATUS_LABEL } from "../db/types";

export const AREA_COLOR: Record<Area, { fg: string; bg: string }> = {
  Bottom: { fg: "#c8f04a", bg: "#262d14" },
  Top: { fg: "#9b8cff", bg: "#2a2648" },
  "Stand up": { fg: "#ffb36b", bg: "#2b2013" },
};

/* ---------- icons ---------- */
export const Icon = {
  check: (c = "currentColor", s = 15) => (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  chevron: (c = "currentColor") => (
    <svg className="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  back: () => (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  x: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  bang: (c = "currentColor") => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v8M12 18h.01" stroke={c} strokeWidth="2.8" strokeLinecap="round" /></svg>
  ),
  pause: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9" stroke={c} strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
};

/* Position glyphs: a simple figure per area so lists read by shape and colour first. */
export function Glyph({ area, status, size = 40 }: { area: Area; status?: Status; size?: number }) {
  const { fg, bg } = AREA_COLOR[area];
  if (status === "dn") {
    return <span className="glyph" style={{ width: size, height: size, background: "#2a2648" }}>{Icon.check("#9b8cff", size * 0.45)}</span>;
  }
  if (status === "pk") {
    return <span className="glyph" style={{ width: size, height: size, background: "transparent", border: "1.5px dashed #2a2d35" }}>{Icon.pause("#8d919b")}</span>;
  }
  const s = size * 0.6;
  const path =
    area === "Bottom" ? (
      <><circle cx="7" cy="22" r="3" fill="none" stroke={fg} strokeWidth="2.4" /><path d="M10 23h9M19 23l5-9M19 23l7-4M4 27h24" fill="none" stroke={fg} strokeWidth="2.4" strokeLinecap="round" /></>
    ) : area === "Top" ? (
      <><circle cx="10" cy="9" r="3" fill="none" stroke={fg} strokeWidth="2.4" /><path d="M12 12l8 5M20 17l-3 9M20 17l6 8M4 27h24" fill="none" stroke={fg} strokeWidth="2.4" strokeLinecap="round" /></>
    ) : (
      <><circle cx="16" cy="6" r="3" fill="none" stroke={fg} strokeWidth="2.4" /><path d="M16 9v10M16 19l-5 8M16 19l5 8M10 14h12" fill="none" stroke={fg} strokeWidth="2.4" strokeLinecap="round" /></>
    );
  return (
    <span className="glyph" style={{ width: size, height: size, background: bg }}>
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">{path}</svg>
    </span>
  );
}

export function Ring({ value, size = 84, thickness = 8, color = "var(--lime)", track = "#23262e", inner = "var(--bg)", children, label }: {
  value: number; size?: number; thickness?: number; color?: string; track?: string; inner?: string; children?: ReactNode; label: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="img" aria-label={label} className="ring" style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${pct}%, ${track} ${pct}% 100%)` }}>
      <div style={{ width: size - thickness * 2, height: size - thickness * 2, background: inner }}>{children}</div>
    </div>
  );
}

/** Line chart of 0–1 values; nulls are skipped. */
export function Sparkline({ values, height = 72, fill = true, label }: { values: (number | null)[]; height?: number; fill?: boolean; label: string }) {
  const pts = values.map((v, i) => (v == null ? null : [(i / Math.max(values.length - 1, 1)) * 200, height - 6 - v * (height - 12)] as const)).filter((p): p is readonly [number, number] => p != null);
  // A trend needs two weeks of data; until then say so rather than drawing a lone dot.
  if (pts.length < 2) return <div className="label" style={{ flex: 1 }}>Trend shows after 2 weeks of hits</div>;
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={height} viewBox={`0 0 200 ${height}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ overflow: "visible" }}>
      {fill && <path d={`${line} L${last[0]} ${height} L${pts[0][0]} ${height} Z`} fill="rgba(200,240,74,.14)" />}
      <path d={line} fill="none" stroke="var(--lime)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 3-step track: Not started → In progress → Done. */
export function StatusTrack({ status, width = 90 }: { status: Status; width?: number | string }) {
  const lit = status === "ns" ? 0 : status === "ip" ? 2 : status === "dn" ? 3 : 0;
  const color = status === "dn" ? "var(--violet)" : "var(--lime)";
  return (
    <div className="track" style={{ width }} aria-label={`Status: ${STATUS_LABEL[status]}`} role="img">
      {[0, 1, 2].map((i) => <span key={i} style={i < lit ? { background: color } : undefined} />)}
    </div>
  );
}

export function Pips({ hit, target }: { hit: number; target: number }) {
  if (target > 6) return <span className="pip-count">{hit}/{target}</span>;
  return (
    <span className="pips" role="img" aria-label={`${hit} of ${target}`}>
      {Array.from({ length: target }, (_, i) => <span key={i} className={`pip ${i < hit ? "on" : ""}`} />)}
    </span>
  );
}

export function Back({ to, label = "Back" }: { to?: string; label?: string }) {
  const nav = useNavigate();
  return (
    <button className="back" onClick={() => (to ? nav(to) : nav(-1))}>
      {Icon.back()}
      {label}
    </button>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

/* Tiny global toast */
let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 1800);
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

/** Small haptic tap where supported (Android); iPhone ignores it. */
export const buzz = () => navigator.vibrate?.(12);

export function TabBar() {
  const tab = (to: string, label: string, icon: ReactNode) => (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
      {icon}
      {label}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {tab("/", "Today", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3.5 10h17" stroke="currentColor" strokeWidth="2" /></svg>)}
      {tab("/skills", "Skills", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></svg>)}
      {tab("/programs", "Programs", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>)}
      {tab("/gameplan", "Game plan", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2" fill="currentColor" /><circle cx="18" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="19" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M6 8v4h10M6 12c0 7 4 7 10 7" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>)}
      {tab("/progress", "Progress", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-7M12 20V8M19 20V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>)}
    </nav>
  );
}
