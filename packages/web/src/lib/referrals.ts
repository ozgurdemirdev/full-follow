// Referrals screen: KPI numbers, the referral tree and its layout, and the requests for the two suggestion lists the API sends.
// The KPI numbers and the tree are derived here from the people and opportunities the page already loads.
import { run } from "../api/actions";
import type { Opportunity, Person, RefEdge, RefKpi, RefLayout, RefNode, RefNet, RefOwn, RefPlaced, RefSuggestion, RefTone, ReferralValue } from "../api/types";
import { layout as layoutTokens, space } from "../styles/tokens.json";
import { lira, pct, todayIso } from "./format";
import { OPEN_STAGES } from "./labels";

// ------------------------------------------------------------ tree geometry (percent of the tree width, px for the rows)
const px = (v: string) => parseInt(v, 10);
export const NODE_H = px(layoutTokens["referrals-node-h"]);
export const ROW_PITCH = px(layoutTokens["referrals-pitch"]);
/** Gap above a node inside its row */
const NODE_TOP = px(space["3"]);
/** Up to this many levels the board's fixed columns are used */
const BOARD_LEVELS = 3;
const BOARD_WIDTH = 29;
const BOARD_STEP = 35.5;
/** Space between two levels; deeper trees shrink the nodes and keep this gap */
const LEVEL_GAP = BOARD_STEP - BOARD_WIDTH;
const FULL = 100;
/** Edges are drawn in with a dash of at least the board's 400 px; a longer edge (a parent over many rows) gets a dash that covers it */
const EDGE_DASH_MIN = 400;
/** Upper bound of the tree box width per percent, to estimate an edge's length in px */
const PX_PER_PERCENT = 12;
const EDGE_DASH_SLACK = 1.25;

// ------------------------------------------------------------ values
const ZERO: RefOwn = { won: 0, open: 0 };
const isOpen = (o: Opportunity) => (OPEN_STAGES as string[]).includes(o.stage);

/** Won and open value each person brought as the contact of an opportunity */
export function ownValues(opps: readonly Opportunity[]): Map<number, RefOwn> {
  const out = new Map<number, RefOwn>();
  for (const o of opps) {
    const won = o.stage === "kazanildi";
    if (!won && !isOpen(o)) continue;
    const cur = out.get(o.person_id) ?? { won: 0, open: 0 };
    if (won) cur.won += o.estimated_value ?? 0;
    else cur.open += o.estimated_value ?? 0;
    out.set(o.person_id, cur);
  }
  return out;
}

/** Page KPIs: what referred people brought, the close rate against the rest, and how many people were introduced */
export function referralKpis(people: readonly Person[], opps: readonly Opportunity[], leaders: readonly ReferralValue[]): RefKpi[] {
  const referred = new Set(people.filter((p) => p.referred_by_id).map((p) => p.id));
  const side = { ref: { won: 0, lost: 0, wonValue: 0, openValue: 0 }, other: { won: 0, lost: 0, wonValue: 0, openValue: 0 } };
  for (const o of opps) {
    const s = referred.has(o.person_id) ? side.ref : side.other;
    if (o.stage === "kazanildi") { s.won++; s.wonValue += o.estimated_value ?? 0; }
    else if (o.stage === "kaybedildi") s.lost++;
    else if (isOpen(o)) s.openValue += o.estimated_value ?? 0;
  }
  const rate = (s: { won: number; lost: number }) => (s.won + s.lost ? s.won / (s.won + s.lost) : null);
  return [
    { label: "Referanstan kazanılan", value: lira(side.ref.wonValue), sub: "tüm ağ", accent: true },
    { label: "Açıkta", value: lira(side.ref.openValue), sub: "referansla gelen fırsatlar" },
    { label: "Kapanma oranı", value: pct(rate(side.ref)), sub: `diğer kaynaklar ${pct(rate(side.other))}` },
    { label: "Tanıtılan kişi", value: String(referred.size), sub: `${leaders.length} kişiden` },
  ];
}

// ------------------------------------------------------------ tree
const addNet = (a: RefNet, k: RefNode): RefNet => ({
  won: a.won + k.own.won + k.net.won,
  open: a.open + k.own.open + k.net.open,
  people: a.people + 1 + k.net.people,
  wonCount: a.wonCount + (k.own.won ? 1 : 0) + k.net.wonCount,
});

/** The tree under one person: whoever has `referred_by_id` pointing up, each person once; bigger branches first */
export function buildTree(rootId: number, people: readonly Person[], own: ReadonlyMap<number, RefOwn>): RefNode | null {
  const kids = new Map<number, Person[]>();
  let root: Person | undefined;
  for (const p of people) {
    if (p.id === rootId) root = p;
    if (p.referred_by_id) kids.set(p.referred_by_id, [...(kids.get(p.referred_by_id) ?? []), p]);
  }
  if (!root) return null;
  const seen = new Set<number>([rootId]);
  const make = (p: Person): RefNode => {
    const children = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id));
    children.forEach((k) => seen.add(k.id));
    const sub = children.map(make);
    const weight = (n: RefNode) => n.own.won + n.own.open + n.net.won + n.net.open;
    sub.sort((a, b) => weight(b) - weight(a) || a.person.name.localeCompare(b.person.name, "tr"));
    return { person: { id: p.id, name: p.name, company_name: p.company_name }, own: own.get(p.id) ?? ZERO, kids: sub, net: sub.reduce(addNet, { won: 0, open: 0, people: 0, wonCount: 0 }) };
  };
  return make(root);
}

const toneOf = (n: RefNode): RefTone => (n.own.won ? "won" : n.own.open ? "open" : "none");

/** Leaves take consecutive rows, a parent sits at the middle of its children; edges are curves from the parent's right edge to the child's left edge */
export function layoutTree(root: RefNode): RefLayout {
  const placed: RefPlaced[] = [];
  const links: { from: RefPlaced; to: RefPlaced; node: RefNode }[] = [];
  let row = 0;
  const place = (node: RefNode, level: number): RefPlaced => {
    const me: RefPlaced = { node, level, y: 0, x: 0 };
    placed.push(me);
    const sub = node.kids.map((k) => {
      const c = place(k, level + 1);
      links.push({ from: me, to: c, node: k });
      return c;
    });
    me.y = sub.length ? (sub[0].y + sub[sub.length - 1].y) / 2 : row++ * ROW_PITCH;
    return me;
  };
  place(root, 0);
  const depth = placed.reduce((m, p) => Math.max(m, p.level + 1), 1);
  const width = depth <= BOARD_LEVELS ? BOARD_WIDTH : (FULL - LEVEL_GAP * (depth - 1)) / depth;
  const step = width + LEVEL_GAP;
  placed.forEach((p) => { p.x = p.level * step; });
  const mid = NODE_TOP + NODE_H / 2;
  const edges: RefEdge[] = links.map((l, key) => {
    const x1 = l.from.x + width, y1 = l.from.y + mid, x2 = l.to.x, y2 = l.to.y + mid, mx = (x1 + x2) / 2;
    const len = Math.max(EDGE_DASH_MIN, Math.ceil(Math.hypot(y2 - y1, (x2 - x1) * PX_PER_PERCENT) * EDGE_DASH_SLACK));
    return { key, d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, tone: toneOf(l.node), len };
  });
  return { nodes: placed, edges, width, height: row * ROW_PITCH, depth };
}

/** Top of a node inside the tree box */
export const nodeTop = (p: RefPlaced) => p.y + NODE_TOP;
/** Value text and tone of a node: the root shows the whole network's won value, the others their own */
export function nodeValue(p: RefPlaced): { text: string; tone: RefTone } {
  if (p.level === 0) return { text: lira(p.node.net.won), tone: "won" };
  const t = toneOf(p.node);
  return { text: t === "won" ? lira(p.node.own.won) : t === "open" ? lira(p.node.own.open) : "iş yok", tone: t };
}

// ------------------------------------------------------------ suggestion requests
export type RequestKind = "thanks" | "ask";
const REQUEST_OK: Record<RequestKind, string> = {
  thanks: "Claude teşekkür taslağını yazıyor, Taslaklar’a düşecek",
  ask: "Claude referans ricasını yazıyor, Taslaklar’a düşecek",
};

/** Ask Claude for the draft (a task for Claude with the title the API sent; the draft lands in Taslaklar) */
export const requestDraft = (kind: RequestKind, s: Pick<RefSuggestion, "person" | "request_title">) =>
  run("post", "/tasks", { title: s.request_title, assignee: "claude", due_date: todayIso(), person_id: s.person.id }, { ok: REQUEST_OK[kind] });
