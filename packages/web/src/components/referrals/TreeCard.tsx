import { Link } from "wouter";
import type { RefLayout, RefPlaced } from "../../api/types";
import { PATHS } from "../../app/routes";
import { nodeTop, nodeValue } from "../../lib/referrals";
import { Avatar } from "../ui";

/** Depth where the nodes would get too narrow: the tree then keeps a minimum column width and scrolls inside its box */
const SCROLL_FROM_LEVELS = 4;

const href = (p: RefPlaced) => `${PATHS.people}/${p.node.person.id}`;

function TreeNode({ p, i, width }: { p: RefPlaced; i: number; width: number }) {
  const v = nodeValue(p);
  return (
    <Link href={href(p)} className="ref-node" data-root={p.level === 0 ? "" : undefined}
      style={{ left: `${p.x}%`, top: nodeTop(p), width: `${width}%`, ["--i" as string]: Math.min(i, 24) }}>
      <Avatar name={p.node.person.name} id={p.node.person.id} size="sm" />
      <span className="ref-who">
        <b>{p.node.person.name}</b>
        <span>{p.node.person.company_name ?? ""}</span>
      </span>
      <span className="ref-val" data-tone={v.tone}>{v.text}</span>
    </Link>
  );
}

/** The selected person's network: an SVG tree on wide screens (parent centred over its children), an indented list on phones */
export function TreeCard({ title, tree }: { title: string; tree: RefLayout }) {
  return (
    <section className="ref-tree-card" aria-label={title}>
      <div className="ref-tree-head">
        <h2>{title}</h2>
        <span className="ref-legend">
          <span><i data-tone="won" />kazanıldı</span>
          <span><i data-tone="open" />açık</span>
          <span><i data-tone="none" />iş yok</span>
        </span>
      </div>
      <div className="ref-tree-scroll">
        <div className="ref-tree" style={{ height: tree.height, minWidth: tree.depth >= SCROLL_FROM_LEVELS ? `calc(${tree.depth} * var(--spacing-referrals-col-min))` : undefined }}>
          <svg width="100%" height="100%" viewBox={`0 0 100 ${tree.height}`} preserveAspectRatio="none" aria-hidden="true">
            {tree.edges.map((e) => <path key={e.key} className="ref-edge" data-tone={e.tone} d={e.d} style={{ ["--len" as string]: e.len }} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
          </svg>
          {tree.nodes.map((p, i) => <TreeNode key={p.node.person.id} p={p} i={i} width={tree.width} />)}
        </div>
      </div>
      <div className="ref-tlist">
        {tree.nodes.map((p) => (
          <Link key={p.node.person.id} href={href(p)} className="ref-tl" style={{ ["--level" as string]: p.level }}>
            {p.level > 0 ? <span className="ref-tl-branch">└</span> : null}
            <Avatar name={p.node.person.name} id={p.node.person.id} size="sm" />
            <span className="ref-who">
              <b>{p.node.person.name}</b>
              <span>{p.node.person.company_name ?? ""}</span>
            </span>
            <span className="ref-val" data-tone={nodeValue(p).tone}>{nodeValue(p).text}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
