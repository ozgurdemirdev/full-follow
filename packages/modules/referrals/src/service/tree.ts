import { LOCALE, type Ctx, type ReferralKpis, type ReferralOwn, type ReferralSide, type ReferralTreeNode } from "@fullfollow/core";

const NO_OWN: ReferralOwn = { won: 0, open: 0 };
const side = (): ReferralSide => ({ won: 0, lost: 0, won_value: 0, open_value: 0 });

/** What the opportunities of the introduced people came to, against the opportunities of everyone else (the people module's tree tells who was introduced) */
export function referralKpis(ctx: Ctx): ReferralKpis {
  const people = ctx.mod("people")?.referralTree() ?? [];
  const stats = ctx.mod("pipeline")?.personStats() ?? new Map();
  const referred = new Set(people.filter((p) => p.referred_by_id).map((p) => p.id));
  const out: ReferralKpis = { referred: referred.size, referred_side: side(), other_side: side() };
  for (const [personId, s] of stats) {
    const to = referred.has(personId) ? out.referred_side : out.other_side;
    to.won += s.won;
    to.lost += s.lost;
    to.won_value += s.won_value;
    to.open_value += s.open_value;
  }
  return out;
}

/** The tree under one person: whoever has `referred_by_id` pointing up, each person once; bigger branches first */
export function referralTree(ctx: Ctx, rootId: number): ReferralTreeNode | null {
  const people = ctx.mod("people")?.referralTree() ?? [];
  const stats = ctx.mod("pipeline")?.personStats();
  const kids = new Map<number, typeof people>();
  let root: (typeof people)[number] | undefined;
  for (const p of people) {
    if (p.id === rootId) root = p;
    if (p.referred_by_id) kids.set(p.referred_by_id, [...(kids.get(p.referred_by_id) ?? []), p]);
  }
  if (!root) return null;
  const seen = new Set<number>([rootId]);
  const weight = (n: ReferralTreeNode) => n.own.won + n.own.open + n.net.won + n.net.open;
  const make = (p: (typeof people)[number]): ReferralTreeNode => {
    const children = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id));
    children.forEach((k) => seen.add(k.id));
    const sub = children.map(make).sort((a, b) => weight(b) - weight(a) || a.person.name.localeCompare(b.person.name, LOCALE));
    const s = stats?.get(p.id);
    const net = sub.reduce(
      (a, k) => ({ won: a.won + k.own.won + k.net.won, open: a.open + k.own.open + k.net.open, people: a.people + 1 + k.net.people, wonCount: a.wonCount + (k.own.won ? 1 : 0) + k.net.wonCount }),
      { won: 0, open: 0, people: 0, wonCount: 0 },
    );
    return { person: { id: p.id, name: p.name, company_name: p.company_name }, own: s ? { won: s.won_value, open: s.open_value } : NO_OWN, kids: sub, net };
  };
  return make(root);
}
