// Referrals screen: KPI numbers, the referral tree and its layout, and the requests for the two suggestion lists the API sends.
// The KPI numbers and the tree come from the server; only the tree's layout is worked out here.
import type { ReferralValue } from "@kit/api/types";
import type { RefEdge, RefKpi, RefLayout, RefNode, RefPlaced, RefSuggestion, RefTone } from "./types";
import type { ReferralKpis } from "./types";
import { layout as layoutTokens, space } from "@kit/styles/tokens.json";
import type { ClaudeRequest } from "@kit/lib/askClaude";
import { lira, pct } from "@kit/lib/format";
import { m } from "./messages";

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
/** Page KPIs from the server's numbers: what referred people brought, the close rate against the rest, and how many people were introduced */
export function referralKpis(k: ReferralKpis, leaders: readonly ReferralValue[]): RefKpi[] {
  const rate = (s: { won: number; lost: number }) => (s.won + s.lost ? s.won / (s.won + s.lost) : null);
  return [
    { label: m.kpis.wonTitle, value: lira(k.referred_side.won_value), sub: m.kpis.wonSub, accent: true },
    { label: m.kpis.openTitle, value: lira(k.referred_side.open_value), sub: m.kpis.openSub },
    { label: m.kpis.rateTitle, value: pct(rate(k.referred_side)), sub: m.kpis.rateSub(pct(rate(k.other_side))) },
    { label: m.kpis.peopleTitle, value: String(k.referred), sub: m.kpis.peopleSub(leaders.length) },
  ];
}

// ------------------------------------------------------------ tree (the server builds it: see ReferralsApi.tree; the layout is drawn here)
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
  return { text: t === "won" ? lira(p.node.own.won) : t === "open" ? lira(p.node.own.open) : m.tree.none, tone: t };
}

// ------------------------------------------------------------ suggestion requests
export type RequestKind = "thanks" | "ask";

/** The request for Claude to write the draft (the task title is the one the API sent; the draft lands in Taslaklar) */
export const suggestionRequest = (kind: RequestKind, s: Pick<RefSuggestion, "person" | "request_title">): ClaudeRequest =>
  ({ title: s.request_title, target: { person_id: s.person.id }, ok: m.requestOk[kind], draft: true });
